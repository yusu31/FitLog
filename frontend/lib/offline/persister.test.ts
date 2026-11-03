import { dehydrate, QueryClient } from '@tanstack/react-query';
import type { PersistedClient } from '@tanstack/react-query-persist-client';
import { getAddSetMutationKey, getCreateRecordMutationKey, getDeleteSetMutationKey, getGetRecordQueryKey } from '@/lib/api/generated';
import {
  createQueuePersister,
  idbStorage,
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

    const d = dehydrate(client, queueDehydrateOptions(client));
    expect(d.mutations).toHaveLength(2);
    expect(d.queries.map((q) => q.queryKey)).toEqual([getGetRecordQueryKey('r1')]);
  });

  it('送信待ちが無ければ、何も保存しない（境界: 0件）', () => {
    const client = new QueryClient();
    client.setQueryData(getGetRecordQueryKey('r1'), { status: 200 });
    const d = dehydrate(client, queueDehydrateOptions(client));
    expect(d.mutations).toHaveLength(0);
    expect(d.queries).toHaveLength(0);
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

describe('idbStorage（IndexedDB が無い環境）', () => {
  it('jsdom には IndexedDB が無いので、何も保存せず、読むと null（エラーにしない）', async () => {
    expect(typeof indexedDB).toBe('undefined');
    await idbStorage.setItem('k', 'v');
    expect(await idbStorage.getItem('k')).toBeNull();
    await expect(idbStorage.removeItem('k')).resolves.toBeUndefined();
  });
});
