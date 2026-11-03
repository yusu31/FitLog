import { createAsyncStoragePersister } from '@tanstack/query-async-storage-persister';
import type { QueryClient } from '@tanstack/react-query';
import type { Persister } from '@tanstack/react-query-persist-client';
import { del, get, set } from 'idb-keyval';
import { getAddSetMutationKey, getCreateRecordMutationKey, getGetRecordQueryKey } from '@/lib/api/generated';

// 送信待ちの端末への保存（IndexedDB。docs/tech-stack.md「オフライン記録（F-30）」の層②）。
// 保存するのは「作成系の送信（記録を作る・セットを足す）で、まだ API に届いていないもの」と、
// その画面表示に使う記録の詳細（楽観的更新のデータ）だけ。送信処理そのものは保存できないので、
// 再読み込み後は setMutationDefaults で登録し直した送信処理で送る（lib/mutations.ts・lib/offline/resume.ts）。
export type QueueStorage = {
  getItem: (key: string) => Promise<string | null | undefined>;
  setItem: (key: string, value: string) => Promise<void>;
  removeItem: (key: string) => Promise<void>;
};

export const QUEUE_STORAGE_KEY = 'fitlog-offline-queue';
// 送信待ちは、いつ開いても残す。既定の 24時間だと、翌日開いたときに記録が消える
export const QUEUE_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;

// IndexedDB が無い環境（サーバー側の書き出し・テスト）では何も保存しない
const hasIdb = () => typeof indexedDB !== 'undefined';
export const idbStorage: QueueStorage = {
  getItem: async (key) => (hasIdb() ? ((await get<string>(key)) ?? null) : null),
  setItem: async (key, value) => {
    if (hasIdb()) await set(key, value);
  },
  removeItem: async (key) => {
    if (hasIdb()) await del(key);
  },
};

const CREATE_KEY = JSON.stringify(getCreateRecordMutationKey());
const ADD_SET_KEY = JSON.stringify(getAddSetMutationKey());

type MutationLike = { options: { mutationKey?: readonly unknown[] }; state: { status: string; variables?: unknown } };
const keyOf = (m: MutationLike): string => JSON.stringify(m.options.mutationKey);

// 送信待ち＝作成系で、まだ終わっていない（電波待ち・再送待ち・順番待ち・送信中）もの
export const isQueuedMutation = (m: MutationLike): boolean =>
  (keyOf(m) === CREATE_KEY || keyOf(m) === ADD_SET_KEY) && m.state.status === 'pending';

// 送信待ちが触る記録の ID（記録の作成は data.id、セットの追加は親の id）
function touchedRecordId(m: MutationLike): string | undefined {
  const v = m.state.variables as { id?: string; data?: { id?: string } } | undefined;
  return keyOf(m) === ADD_SET_KEY ? v?.id : v?.data?.id;
}

export function queueDehydrateOptions(client: QueryClient) {
  return {
    shouldDehydrateMutation: isQueuedMutation,
    // 画面に出す記録の詳細は、送信待ちが触っているものだけ保存する（ほかの閲覧結果は保存しない）
    shouldDehydrateQuery: (query: { queryKey: readonly unknown[]; state: { status: string } }): boolean => {
      if (query.state.status !== 'success') return false;
      const key = JSON.stringify(query.queryKey);
      return client
        .getMutationCache()
        .getAll()
        .some((m) => isQueuedMutation(m) && key === JSON.stringify(getGetRecordQueryKey(touchedRecordId(m) ?? '')));
    },
  };
}

// 復元した送信は「止まっていない」状態にして戻す。TanStack Query は電波が戻ると止まっている送信を自分で送るが、
// ログインしている人を確かめる前に送らないよう、再送の開始は自分で行う（lib/offline/resume.ts）
export function createQueuePersister(storage: QueueStorage = idbStorage): Persister {
  const base = createAsyncStoragePersister({ storage, key: QUEUE_STORAGE_KEY, throttleTime: 100 });
  return {
    persistClient: base.persistClient,
    removeClient: base.removeClient,
    restoreClient: async () => {
      const restored = await base.restoreClient();
      if (!restored) return restored;
      return {
        ...restored,
        clientState: {
          ...restored.clientState,
          mutations: restored.clientState.mutations.map((m) => ({ ...m, state: { ...m.state, isPaused: false } })),
        },
      };
    },
  };
}
