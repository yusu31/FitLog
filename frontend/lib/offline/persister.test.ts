import { dehydrate, QueryClient } from '@tanstack/react-query';
import type { PersistedClient } from '@tanstack/react-query-persist-client';
import { getAddSetMutationKey, getCreateRecordMutationKey, getDeleteSetMutationKey, getGetRecordQueryKey } from '@/lib/api/generated';
import {
  BROWSE_MAX_AGE_MS,
  createQueuePersister,
  idbStorage,
  isBrowseQueryKey,
  isQueuedMutation,
  queueDehydrateOptions,
  QUEUE_MAX_AGE_MS,
  QUEUE_STORAGE_KEY,
  type QueueStorage,
} from './persister';

function memory(): { store: Map<string, string>; storage: QueueStorage } {
  const store = new Map<string, string>();
  return {
    store,
    storage: {
      getItem: async (k) => store.get(k) ?? null,
      setItem: async (k, v) => void store.set(k, v),
      removeItem: async (k) => void store.delete(k),
    },
  };
}

// 送信待ち（終わっていない作成系）を、実際には送らずに QueryClient に積む（状態だけ作る）
function queued(client: QueryClient, key: readonly unknown[], variables: unknown, status: 'pending' | 'success' = 'pending') {
  const mutation = client.getMutationCache().build(client, { mutationKey: key, scope: { id: 'records:u1' } });
  (mutation as unknown as { state: unknown }).state = { ...mutation.state, status, variables, isPaused: false };
  return mutation;
}

describe('保存の対象（dehydrate）', () => {
  it('終わっていない作成系の送信と、それが触る記録の詳細だけを保存する', () => {
    const client = new QueryClient();
    queued(client, getCreateRecordMutationKey(), { data: { id: 'r1' } });
    queued(client, getAddSetMutationKey(), { id: 'r1', data: { id: 's1' } });
    queued(client, getAddSetMutationKey(), { id: 'r1', data: { id: 's0' } }, 'success'); // 届いたもの
    queued(client, getDeleteSetMutationKey(), { id: 'r1', setId: 's9' }); // 削除は対象外
    client.setQueryData(getGetRecordQueryKey('r1'), { status: 200, data: { id: 'r1' } });
    client.setQueryData(getGetRecordQueryKey('other'), { status: 200, data: { id: 'other' } }); // 送信待ちが触らない詳細
    client.setQueryData(['/api/week'], { status: 200 });

    client.setQueryData(['/api/videos/v1/url'], { status: 200 }); // 閲覧用でも、期限つきの署名 URL は対象外

    const d = dehydrate(client, queueDehydrateOptions(client));
    expect(d.mutations).toHaveLength(2);
    // 送信待ちが触る詳細（r1）に加え、閲覧用（S4）の記録の詳細・週は保存する。署名 URL は保存しない
    expect(d.queries.map((q) => q.queryKey)).toEqual([
      getGetRecordQueryKey('r1'),
      getGetRecordQueryKey('other'),
      ['/api/week'],
    ]);
  });

  it('送信待ちが無ければ、送信は保存しない。閲覧用の結果だけ保存する（境界: 0件）', () => {
    const client = new QueryClient();
    client.setQueryData(getGetRecordQueryKey('r1'), { status: 200 });
    client.setQueryData(['/api/groups/current'], { status: 200 }); // 招待コードを含みうるので保存しない
    const d = dehydrate(client, queueDehydrateOptions(client));
    expect(d.mutations).toHaveLength(0);
    expect(d.queries.map((q) => q.queryKey)).toEqual([getGetRecordQueryKey('r1')]);
  });

  it('isQueuedMutation は成功済み・作成系でないものを false にする', () => {
    const client = new QueryClient();
    expect(isQueuedMutation(queued(client, getCreateRecordMutationKey(), {}))).toBe(true);
    expect(isQueuedMutation(queued(client, getCreateRecordMutationKey(), {}, 'success'))).toBe(false);
    expect(isQueuedMutation(queued(client, getDeleteSetMutationKey(), {}))).toBe(false);
  });
});

describe('保存と復元（persister）', () => {
  const saved = (): PersistedClient => ({
    timestamp: Date.now(),
    buster: '',
    clientState: {
      queries: [],
      mutations: [
        {
          mutationKey: ['createRecord'],
          scope: { id: 'records:u1' },
          state: { status: 'pending', isPaused: true, variables: { data: { id: 'r1' } }, failureCount: 3 } as never,
        },
      ],
    },
  });

  it('保存したものがそのまま戻る', async () => {
    const p = createQueuePersister(memory().storage);
    await p.persistClient(saved());
    const back = await p.restoreClient();
    expect(back?.clientState.mutations).toHaveLength(1);
    expect(back?.clientState.mutations[0].mutationKey).toEqual(['createRecord']);
    expect(back?.clientState.mutations[0].scope).toEqual({ id: 'records:u1' });
  });

  it('復元した送信は止まっていない状態にする（再送の開始は自分で行うため）', async () => {
    const p = createQueuePersister(memory().storage);
    await p.persistClient(saved());
    const back = await p.restoreClient();
    expect(back?.clientState.mutations[0].state.isPaused).toBe(false);
  });

  it('何も保存していなければ undefined（境界: 初回）', async () => {
    const p = createQueuePersister(memory().storage);
    expect(await p.restoreClient()).toBeUndefined();
  });

  it('removeClient で消える', async () => {
    const { store, storage } = memory();
    const p = createQueuePersister(storage);
    await p.persistClient(saved());
    expect(store.has(QUEUE_STORAGE_KEY)).toBe(true);
    await p.removeClient();
    expect(store.has(QUEUE_STORAGE_KEY)).toBe(false);
  });

  it('保存の期限は、翌日以降に開いても残る長さ（既定の24時間より長い）', () => {
    expect(QUEUE_MAX_AGE_MS).toBeGreaterThan(24 * 60 * 60 * 1000);
  });
});

describe('閲覧キャッシュ（S4。前回の内容を端末に残す）', () => {
  const NOW = 1_800_000_000_000;
  const q = (key: readonly unknown[], dataUpdatedAt: number) => ({
    queryKey: key,
    queryHash: JSON.stringify(key),
    dehydratedAt: dataUpdatedAt,
    state: { status: 'success', data: { status: 200 }, dataUpdatedAt } as never,
  });
  const client = (queries: ReturnType<typeof q>[]): PersistedClient => ({
    timestamp: NOW,
    buster: '',
    clientState: { queries, mutations: [] },
  });
  const keys = (c: PersistedClient | undefined) => c?.clientState.queries.map((x) => x.queryKey);

  it('isBrowseQueryKey: 閲覧用の画面データだけ true（署名 URL・グループ・未読数は false）', () => {
    expect(isBrowseQueryKey(['/api/feed', { limit: '20' }])).toBe(true);
    expect(isBrowseQueryKey(['/api/records', { kind: 'workout' }])).toBe(true);
    expect(isBrowseQueryKey(['/api/exercises'])).toBe(true);
    expect(isBrowseQueryKey(['/api/exercises/e1/previous'])).toBe(true);
    expect(isBrowseQueryKey(['/api/me/stats'])).toBe(true);
    expect(isBrowseQueryKey(['/api/week'])).toBe(true);
    expect(isBrowseQueryKey(['/api/feed/unread'])).toBe(false);
    expect(isBrowseQueryKey(['/api/videos/v1/url'])).toBe(false);
    expect(isBrowseQueryKey(['/api/groups/current'])).toBe(false);
    expect(isBrowseQueryKey(['/api/exercisesX'])).toBe(false); // 前方一致の取り違え
    expect(isBrowseQueryKey([{ not: 'a string' }])).toBe(false);
  });

  it('同じ持ち主で開き直せば、閲覧結果が戻る', async () => {
    const p = createQueuePersister(memory().storage, { getOwner: () => 'u1', now: () => NOW });
    await p.persistClient(client([q(['/api/feed'], NOW - 1000)]));
    expect(keys(await p.restoreClient())).toEqual([['/api/feed']]);
  });

  it('保存から BROWSE_MAX_AGE_MS を過ぎた閲覧結果は戻さない。送信待ちは残る', async () => {
    const store = memory();
    let now = NOW;
    const p = createQueuePersister(store.storage, { getOwner: () => 'u1', now: () => now });
    const c = client([q(['/api/feed'], NOW), q(['/api/week'], NOW)]);
    c.clientState.mutations = [
      { mutationKey: ['createRecord'], scope: { id: 'records:u1' }, state: { status: 'pending', variables: {} } as never },
    ];
    await p.persistClient(c);
    now = NOW + BROWSE_MAX_AGE_MS + 1;
    const back = await p.restoreClient();
    expect(keys(back)).toEqual([]);
    expect(back?.clientState.mutations).toHaveLength(1);
  });

  it('持ち主が違えば（別の人がログインした端末）閲覧結果は戻さない。控えが無い（ログアウト後）ときも戻さない', async () => {
    const { storage } = memory();
    await createQueuePersister(storage, { getOwner: () => 'u1', now: () => NOW }).persistClient(
      client([q(['/api/feed'], NOW)]),
    );
    expect(keys(await createQueuePersister(storage, { getOwner: () => 'u2', now: () => NOW }).restoreClient())).toEqual([]);
    expect(keys(await createQueuePersister(storage, { getOwner: () => null, now: () => NOW }).restoreClient())).toEqual([]);
  });

  it('ログインしている人が分からないときは、閲覧結果を保存しない（保存の時点で除く）', async () => {
    const { store, storage } = memory();
    const p = createQueuePersister(storage, { getOwner: () => null, now: () => NOW });
    await p.persistClient(client([q(['/api/feed'], NOW)]));
    expect(store.get(QUEUE_STORAGE_KEY)).not.toContain('/api/feed');
  });

  it('記録の詳細は、送信待ちが触るものなら持ち主・期限に関係なく残る', async () => {
    const { storage } = memory();
    const c = client([q(getGetRecordQueryKey('r1') as readonly unknown[], NOW - BROWSE_MAX_AGE_MS * 3)]);
    c.clientState.mutations = [
      { mutationKey: getCreateRecordMutationKey(), scope: { id: 'records:u1' }, state: { status: 'pending', variables: { data: { id: 'r1' } } } as never },
    ];
    await createQueuePersister(storage, { getOwner: () => null, now: () => NOW }).persistClient(c);
    const back = await createQueuePersister(storage, { getOwner: () => null, now: () => NOW }).restoreClient();
    expect(keys(back)).toEqual([getGetRecordQueryKey('r1')]);
  });
});

describe('idbStorage（IndexedDB が無い環境）', () => {
  it('jsdom には IndexedDB が無いので、何も保存せず、読むと null（エラーにしない）', async () => {
    expect(typeof indexedDB).toBe('undefined');
    await idbStorage.setItem('k', 'v');
    expect(await idbStorage.getItem('k')).toBeNull();
    await expect(idbStorage.removeItem('k')).resolves.toBeUndefined();
  });
});
