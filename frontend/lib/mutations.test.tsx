import { onlineManager, QueryClient, QueryClientProvider, type QueryClient as QC } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import {
  getAddSetMutationKey,
  getCreateRecordMutationKey,
  getDeleteRecordMutationKey,
  getDeleteSetMutationKey,
  getGetRecordQueryKey,
  getListExercisesQueryKey,
  type RecordDetailResponse,
} from '@/lib/api/generated';
import { ApiError } from '@/lib/api/api-error';
import { recordScopeId, registerRecordMutations, useRecordMutations } from './mutations';

vi.mock('@/lib/auth-client', () => ({
  authClient: { useSession: () => ({ data: { user: { id: 'u1' } }, isPending: false }) },
}));

// 偽物の fetch。呼ばれた順を記録し、応答は呼ぶ側のテストが決める。返事を遅らせたいときは hold で止める
type Call = { method: string; url: string; body?: Record<string, unknown> };
let calls: Call[] = [];
let respond: (call: Call) => { status: number; body?: unknown } | Promise<{ status: number; body?: unknown }>;

const REC = '11111111-1111-4111-8111-111111111111';
const SET1 = '22222222-2222-4222-8222-222222222222';
const SET2 = '33333333-3333-4333-8333-333333333333';
const EX = '44444444-4444-4444-8444-444444444444';
const NOW = '2026-11-02T10:00:00.000Z';

const makeClient = () => new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });

const wrapperFor = (client: QC) =>
  function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  };

const detailOf = (client: QC) => client.getQueryData<{ status: number; data: RecordDetailResponse }>(getGetRecordQueryKey(REC))?.data;
const seedDetail = (client: QC, data: RecordDetailResponse) =>
  client.setQueryData(getGetRecordQueryKey(REC), { status: 200, data, headers: new Headers() });

beforeEach(() => {
  calls = [];
  respond = () => ({ status: 200, body: {} });
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string, init?: RequestInit) => {
      const call: Call = { method: init?.method ?? 'GET', url, body: init?.body ? JSON.parse(String(init.body)) : undefined };
      calls.push(call);
      const { status, body } = await respond(call);
      return new Response(status === 204 ? null : JSON.stringify(body ?? {}), { status, headers: { 'Content-Type': 'application/json' } });
    }),
  );
});

afterEach(() => {
  onlineManager.setOnline(true);
  vi.unstubAllGlobals();
});

describe('registerRecordMutations（F-30 の形。docs/tech-stack.md）', () => {
  it('4つの書き込みに、送信処理と scope.id（利用者ごとに1つ）を登録する', () => {
    const client = makeClient();
    registerRecordMutations(client, 'u1');
    for (const key of [
      getCreateRecordMutationKey(),
      getAddSetMutationKey(),
      getDeleteSetMutationKey(),
      getDeleteRecordMutationKey(),
    ]) {
      const defaults = client.getMutationDefaults(key);
      expect(defaults.mutationFn, String(key)).toBeTypeOf('function');
      expect(defaults.scope?.id, String(key)).toBe(recordScopeId('u1'));
    }
  });

  it('scope.id は利用者ごとに違う', () => {
    expect(recordScopeId('u1')).not.toBe(recordScopeId('u2'));
  });
});

describe('書き込みの送信（API の形）', () => {
  it('記録を作る → POST /api/records に id・kind・recordedAt を送る', async () => {
    respond = () => ({ status: 201, body: { id: REC } });
    const client = makeClient();
    const { result } = renderHook(() => useRecordMutations(), { wrapper: wrapperFor(client) });
    await act(() => result.current.createRecord.mutateAsync({ data: { id: REC, kind: 'workout', recordedAt: NOW } }));
    expect(calls).toEqual([{ method: 'POST', url: '/api/records', body: { id: REC, kind: 'workout', recordedAt: NOW } }]);
  });

  it('セットを足す → POST /api/records/{id}/sets。応答の result・isPersonalBest が返る', async () => {
    respond = () => ({ status: 201, body: { id: SET1, setNo: 1, weightKg: 40, reps: 11, result: 'up', isPersonalBest: true } });
    const client = makeClient();
    const { result } = renderHook(() => useRecordMutations(), { wrapper: wrapperFor(client) });
    const res = await act(() =>
      result.current.addSet.mutateAsync({ id: REC, data: { id: SET1, exerciseId: EX, setNo: 1, weightKg: 40, reps: 11 } }),
    );
    expect(calls[0]).toMatchObject({ method: 'POST', url: `/api/records/${REC}/sets` });
    expect(res.data).toMatchObject({ result: 'up', isPersonalBest: true });
  });

  it('セットを消す・記録を消す → DELETE', async () => {
    respond = () => ({ status: 204 });
    const client = makeClient();
    const { result } = renderHook(() => useRecordMutations(), { wrapper: wrapperFor(client) });
    await act(() => result.current.deleteSet.mutateAsync({ id: REC, setId: SET1 }));
    await act(() => result.current.deleteRecord.mutateAsync({ id: REC }));
    expect(calls.map((c) => `${c.method} ${c.url}`)).toEqual([`DELETE /api/records/${REC}/sets/${SET1}`, `DELETE /api/records/${REC}`]);
  });

  it('2xx 以外はエラーにする（生成された関数は 4xx でも投げないため）。ApiError に状態コードと文言が入る', async () => {
    respond = () => ({ status: 409, body: { code: 'SET_NUMBER_TAKEN', message: 'そのセット番号は もう使われています' } });
    const client = makeClient();
    const { result } = renderHook(() => useRecordMutations(), { wrapper: wrapperFor(client) });
    const error = await act(() =>
      result.current.addSet
        .mutateAsync({ id: REC, data: { id: SET1, exerciseId: EX, setNo: 1, weightKg: 40, reps: 10 } })
        .catch((e: unknown) => e),
    );
    expect(error).toBeInstanceOf(ApiError);
    expect((error as ApiError).status).toBe(409);
    expect((error as ApiError).message).toBe('そのセット番号は もう使われています');
  });
});

describe('順番（scope.id。T-OFF-10・T-OFF-13）', () => {
  it('電波が無い間に 記録 → セット1 → セット2 を押すと、戻ったとき作った順に1本ずつ送る（前の応答を待つ）', async () => {
    let releaseCreate: () => void = () => {};
    respond = (call) =>
      call.url === '/api/records'
        ? new Promise((resolve) => {
            releaseCreate = () => resolve({ status: 201, body: { id: REC } });
          })
        : { status: 201, body: { id: SET1, setNo: 1, weightKg: 40, reps: 10, result: null, isPersonalBest: false } };

    const client = makeClient();
    const { result } = renderHook(() => useRecordMutations(), { wrapper: wrapperFor(client) });

    onlineManager.setOnline(false);
    act(() => {
      result.current.createRecord.mutate({ data: { id: REC, kind: 'workout', recordedAt: NOW } });
      result.current.addSet.mutate({ id: REC, data: { id: SET1, exerciseId: EX, setNo: 1, weightKg: 40, reps: 10 } });
      result.current.addSet.mutate({ id: REC, data: { id: SET2, exerciseId: EX, setNo: 2, weightKg: 40, reps: 10 } });
    });
    // 電波が無い間は何も送らない（送信待ち）
    expect(calls).toHaveLength(0);

    onlineManager.setOnline(true);
    await waitFor(() => expect(calls).toHaveLength(1));
    // 記録の作成の応答が返るまで、セットは送らない（親が先）
    await new Promise((r) => setTimeout(r, 30));
    expect(calls).toHaveLength(1);

    releaseCreate();
    await waitFor(() => expect(calls).toHaveLength(3));
    expect(calls.map((c) => c.url)).toEqual(['/api/records', `/api/records/${REC}/sets`, `/api/records/${REC}/sets`]);
    expect(calls.map((c) => c.body?.id)).toEqual([REC, SET1, SET2]);
  });
});

describe('楽観的更新（失敗したら元に戻す）', () => {
  const seedExercises = (client: QC) =>
    client.setQueryData(getListExercisesQueryKey(), {
      status: 200,
      data: [{ id: EX, name: 'ベンチプレス', bodyPart: 'chest', isCustom: false, trialWeightKg: 40, trialReps: 10 }],
    });

  it('記録を作った瞬間・セットを足した瞬間に、画面が見る記録の詳細へ先に反映する（電波が無くても）', async () => {
    const client = makeClient();
    seedExercises(client);
    const { result } = renderHook(() => useRecordMutations(), { wrapper: wrapperFor(client) });
    onlineManager.setOnline(false);
    act(() => {
      result.current.createRecord.mutate({ data: { id: REC, kind: 'workout', recordedAt: NOW } });
      result.current.addSet.mutate({ id: REC, data: { id: SET1, exerciseId: EX, setNo: 1, weightKg: 40, reps: 11 } });
    });
    await waitFor(() => expect(detailOf(client)?.exercises?.[0]?.sets).toHaveLength(1));
    expect(detailOf(client)).toMatchObject({
      id: REC,
      kind: 'workout',
      localDate: '2026-11-02',
      exercises: [{ exerciseId: EX, name: 'ベンチプレス', sets: [{ id: SET1, setNo: 1, weightKg: 40, reps: 11 }] }],
    });
    expect(calls).toHaveLength(0);
  });

  it('セットの送信が 400 などで失敗したら、先に出したセットを元に戻す', async () => {
    respond = (call) => (call.url === '/api/records' ? { status: 201, body: { id: REC } } : { status: 400, body: { message: '入力が正しくありません' } });
    const client = makeClient();
    seedExercises(client);
    const { result } = renderHook(() => useRecordMutations(), { wrapper: wrapperFor(client) });
    await act(() => result.current.createRecord.mutateAsync({ data: { id: REC, kind: 'workout', recordedAt: NOW } }));
    await act(() =>
      result.current.addSet.mutateAsync({ id: REC, data: { id: SET1, exerciseId: EX, setNo: 1, weightKg: 40, reps: 11 } }).catch(() => {}),
    );
    expect(detailOf(client)?.exercises?.flatMap((e) => e.sets) ?? []).toHaveLength(0);
  });

  it('セットを消した瞬間に詳細から外し、失敗したら戻す', async () => {
    respond = () => ({ status: 404, body: { message: '見つかりません' } });
    const client = makeClient();
    seedExercises(client);
    seedDetail(client, {
      id: REC,
      kind: 'workout',
      recordedAt: NOW,
      localDate: '2026-11-02',
      exercises: [{ exerciseId: EX, name: 'ベンチプレス', sets: [{ id: SET1, setNo: 1, weightKg: 40, reps: 10 }] }],
    });
    const { result } = renderHook(() => useRecordMutations(), { wrapper: wrapperFor(client) });
    let pending: Promise<unknown> = Promise.resolve();
    onlineManager.setOnline(false);
    act(() => {
      pending = result.current.deleteSet.mutateAsync({ id: REC, setId: SET1 }).catch(() => {});
    });
    await waitFor(() => expect(detailOf(client)?.exercises?.flatMap((e) => e.sets)).toHaveLength(0));
    onlineManager.setOnline(true);
    await act(() => pending);
    expect(detailOf(client)?.exercises?.[0]?.sets).toHaveLength(1);
  });

  it('記録を消すと、その記録の詳細をキャッシュから外す', async () => {
    respond = () => ({ status: 204 });
    const client = makeClient();
    seedDetail(client, { id: REC, kind: 'workout', recordedAt: NOW, localDate: '2026-11-02', exercises: [] });
    const { result } = renderHook(() => useRecordMutations(), { wrapper: wrapperFor(client) });
    await act(() => result.current.deleteRecord.mutateAsync({ id: REC }));
    expect(detailOf(client)).toBeUndefined();
  });
});
