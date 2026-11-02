'use client';

// 記録の書き込み4つ（記録を作る・セットを足す・セットを消す・記録を消す）。F-30（オフライン記録）の形で書く。
// docs/tech-stack.md「オフライン記録（F-30）」:
//   ① 楽観的更新（onMutate で先に画面の元データを更新し、失敗したら戻す）
//   ② mutationKey ＋ setMutationDefaults（送信処理を登録する。再読み込みしても再送できる「形」）
//      ＋ scope.id（同じ scope の送信は1本ずつ順に実行される＝記録の作成 → セットの追加の順を守る）
// 端末への保存（IndexedDB）・送信待ちの帯・Serwist は 02-4 で足す。ここでは形だけを整える。
import { useMutation, useQueryClient, type QueryClient, type UseMutationResult } from '@tanstack/react-query';
import { useMemo } from 'react';
import { unwrap } from '@/lib/api/api-error';
import {
  addSet,
  createRecord,
  deleteRecord,
  deleteSet,
  getAddSetMutationKey,
  getCreateRecordMutationKey,
  getDeleteRecordMutationKey,
  getDeleteSetMutationKey,
  getGetRecordQueryKey,
  getListExercisesQueryKey,
  type AddSetMutationVariables,
  type CreateRecordMutationVariables,
  type DeleteRecordMutationVariables,
  type DeleteSetMutationVariables,
  type ExerciseResponse,
  type getRecordResponseSuccess,
  type RecordDetailResponse,
  type RecordedExercise,
} from '@/lib/api/generated';
import { authClient } from '@/lib/auth-client';
import { toLocalDate } from '@/lib/shared/local-date';

// 利用者ごとに1つの scope。同じ人の書き込みは、作った順に1本ずつ送られる
export const recordScopeId = (userId: string): string => `records:${userId}`;

// 失敗したときに戻すための、更新前の記録の詳細（無かったときは undefined）
type Snapshot = { previous: RecordDetailResponse | undefined };

const detailKey = (recordId: string) => getGetRecordQueryKey(recordId);

// キャッシュには、orval の useGetRecord と同じ形（{ status, data, headers }）で入れる。
// 形を変えると、同じキーを読む画面（記録の詳細など）が壊れるため
const readDetail = (client: QueryClient, recordId: string): RecordDetailResponse | undefined =>
  client.getQueryData<getRecordResponseSuccess>(detailKey(recordId))?.data;

const writeDetail = (
  client: QueryClient,
  recordId: string,
  update: RecordDetailResponse | undefined | ((old: RecordDetailResponse | undefined) => RecordDetailResponse | undefined),
): void => {
  const next = typeof update === 'function' ? update(readDetail(client, recordId)) : update;
  if (next) client.setQueryData<getRecordResponseSuccess>(detailKey(recordId), { status: 200, data: next, headers: new Headers() });
};

// 楽観的更新の前に、その記録の詳細の取得を止め、更新前の値を控える
async function snapshot(client: QueryClient, recordId: string): Promise<Snapshot> {
  await client.cancelQueries({ queryKey: detailKey(recordId) });
  return { previous: readDetail(client, recordId) };
}

// 更新前に戻す。無かったものは消す（setQueryData(undefined) は何もしないため）
function restore(client: QueryClient, recordId: string, snap: Snapshot | undefined) {
  if (!snap) return;
  if (snap.previous) writeDetail(client, recordId, snap.previous);
  else client.removeQueries({ queryKey: detailKey(recordId), exact: true });
}

// 種目名は、種目の一覧のキャッシュから引く（セットの送信内容には ID しか無いため）
function exerciseNameOf(client: QueryClient, exerciseId: string): string {
  const list = client.getQueryData<{ status: number; data: ExerciseResponse[] }>(getListExercisesQueryKey());
  return list?.status === 200 ? (list.data.find((e) => e.id === exerciseId)?.name ?? '') : '';
}

// 書き込み4つの送信処理と楽観的更新を、QueryClient に登録する。何度呼んでも同じ結果（登録し直すだけ）。
// 送信処理そのものは端末に保存できないので、再読み込みのあとは、保存した状態を戻す前にこれを呼ぶ（02-4）
export function registerRecordMutations(client: QueryClient, userId: string): void {
  const scope = { id: recordScopeId(userId) };

  client.setMutationDefaults(getCreateRecordMutationKey(), {
    scope,
    mutationFn: async (vars: CreateRecordMutationVariables) => unwrap(await createRecord(vars.data)),
    onMutate: async (vars: CreateRecordMutationVariables): Promise<Snapshot> => {
      const snap = await snapshot(client, vars.data.id);
      const { id, kind, recordedAt, run } = vars.data;
      writeDetail(client, id, {
        id,
        kind,
        recordedAt,
        localDate: toLocalDate(new Date(recordedAt)),
        ...(run ? { run } : {}),
        ...(kind === 'workout' ? { exercises: [] } : {}),
      });
      return snap;
    },
    onError: (_e: unknown, vars: CreateRecordMutationVariables, snap: Snapshot | undefined) => restore(client, vars.data.id, snap),
  });

  client.setMutationDefaults(getAddSetMutationKey(), {
    scope,
    mutationFn: async (vars: AddSetMutationVariables) => unwrap(await addSet(vars.id, vars.data)),
    onMutate: async (vars: AddSetMutationVariables): Promise<Snapshot> => {
      const snap = await snapshot(client, vars.id);
      const { id: setId, exerciseId, setNo, weightKg, reps } = vars.data;
      writeDetail(client, vars.id, (old) => {
        if (!old) return old; // 記録の作成が先に無い（別の流れ）ときは触らない
        const exercises: RecordedExercise[] = [...(old.exercises ?? [])];
        const at = exercises.findIndex((e) => e.exerciseId === exerciseId);
        const set = { id: setId, setNo, weightKg, reps };
        if (at < 0) {
          exercises.push({ exerciseId, name: exerciseNameOf(client, exerciseId), sets: [set] });
        } else {
          const sets = exercises[at].sets.filter((s) => s.id !== setId); // 同じ ID の再送で二重に並べない
          exercises[at] = { ...exercises[at], sets: [...sets, set].sort((a, b) => a.setNo - b.setNo) };
        }
        return { ...old, exercises };
      });
      return snap;
    },
    onError: (_e: unknown, vars: AddSetMutationVariables, snap: Snapshot | undefined) => restore(client, vars.id, snap),
  });

  client.setMutationDefaults(getDeleteSetMutationKey(), {
    scope,
    mutationFn: async (vars: DeleteSetMutationVariables) => unwrap(await deleteSet(vars.id, vars.setId)),
    onMutate: async (vars: DeleteSetMutationVariables): Promise<Snapshot> => {
      const snap = await snapshot(client, vars.id);
      writeDetail(client, vars.id, (old) =>
        old
          ? {
              ...old,
              exercises: (old.exercises ?? [])
                .map((e) => ({ ...e, sets: e.sets.filter((s) => s.id !== vars.setId) }))
                .filter((e) => e.sets.length > 0),
            }
          : old,
      );
      return snap;
    },
    onError: (_e: unknown, vars: DeleteSetMutationVariables, snap: Snapshot | undefined) => restore(client, vars.id, snap),
  });

  client.setMutationDefaults(getDeleteRecordMutationKey(), {
    scope,
    mutationFn: async (vars: DeleteRecordMutationVariables) => unwrap(await deleteRecord(vars.id)),
    onMutate: async (vars: DeleteRecordMutationVariables): Promise<Snapshot> => {
      const snap = await snapshot(client, vars.id);
      client.removeQueries({ queryKey: detailKey(vars.id), exact: true });
      return snap;
    },
    onError: (_e: unknown, vars: DeleteRecordMutationVariables, snap: Snapshot | undefined) => restore(client, vars.id, snap),
  });
}

type Ok<T extends { status: number; data: unknown }> = Extract<T, { status: 200 | 201 | 204 }>;
type Mut<TFn extends (...a: never[]) => Promise<{ status: number; data: unknown }>, V> = UseMutationResult<
  Ok<Awaited<ReturnType<TFn>>>,
  Error,
  V,
  Snapshot
>;

// 画面から使う入口。mutationKey だけを渡し、送信処理・scope・楽観的更新は登録したものが使われる
// （再読み込み後に再送される送信と、画面から押した送信が、同じ処理で動くようにするため）
export function useRecordMutations(): {
  createRecord: Mut<typeof createRecord, CreateRecordMutationVariables>;
  addSet: Mut<typeof addSet, AddSetMutationVariables>;
  deleteSet: Mut<typeof deleteSet, DeleteSetMutationVariables>;
  deleteRecord: Mut<typeof deleteRecord, DeleteRecordMutationVariables>;
} {
  const client = useQueryClient();
  const { data: session } = authClient.useSession();
  const userId = session?.user?.id ?? 'anonymous';
  // 登録は何度やっても同じ結果なので、描画の中で（利用者が変わったときだけ）行う
  useMemo(() => registerRecordMutations(client, userId), [client, userId]);

  const create = useMutation<Ok<Awaited<ReturnType<typeof createRecord>>>, Error, CreateRecordMutationVariables, Snapshot>({
    mutationKey: getCreateRecordMutationKey(),
  });
  const add = useMutation<Ok<Awaited<ReturnType<typeof addSet>>>, Error, AddSetMutationVariables, Snapshot>({
    mutationKey: getAddSetMutationKey(),
  });
  const delSet = useMutation<Ok<Awaited<ReturnType<typeof deleteSet>>>, Error, DeleteSetMutationVariables, Snapshot>({
    mutationKey: getDeleteSetMutationKey(),
  });
  const delRecord = useMutation<Ok<Awaited<ReturnType<typeof deleteRecord>>>, Error, DeleteRecordMutationVariables, Snapshot>({
    mutationKey: getDeleteRecordMutationKey(),
  });
  return { createRecord: create, addSet: add, deleteSet: delSet, deleteRecord: delRecord };
}
