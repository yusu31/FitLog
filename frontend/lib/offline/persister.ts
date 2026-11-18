import { createAsyncStoragePersister } from '@tanstack/query-async-storage-persister';
import type { QueryClient } from '@tanstack/react-query';
import type { PersistedClient, Persister } from '@tanstack/react-query-persist-client';
import { del, get, set } from 'idb-keyval';
import { getAddSetMutationKey, getCreateRecordMutationKey, getGetRecordQueryKey } from '@/lib/api/generated';
import { readCachedUser } from '@/lib/session-cache';

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

// 閲覧キャッシュ（S4）: 再訪したとき、前回の画面データをすぐ見せるための保存。
// 送信待ち（30日）と違い、古い表示を見せ続けないよう1日で捨てる。復元後は staleTime（30秒）を過ぎているので、
// 画面は写しを先に出し、裏で取り直して新しくする
export const BROWSE_MAX_AGE_MS = 24 * 60 * 60 * 1000;

// 保存してよい閲覧用の API（キーの先頭の URL）。許可リスト方式: 新しい API を足しても、足すまでは保存されない。
// 保存しないもの: 署名つき動画 URL（期限が切れる）・グループと招待（招待コードを含みうる）・未読数（古い数字が目立つ）
const BROWSE_PATHS = ['/api/feed', '/api/records', '/api/exercises', '/api/week', '/api/me/stats', '/api/me/heatmap', '/api/routines'];
export function isBrowseQueryKey(key: readonly unknown[]): boolean {
  const head = key[0];
  if (typeof head !== 'string' || head === '/api/feed/unread') return false;
  return BROWSE_PATHS.some((p) => head === p || head.startsWith(`${p}/`));
}

export function queueDehydrateOptions(client: QueryClient) {
  return {
    shouldDehydrateMutation: isQueuedMutation,
    // 保存するのは、送信待ちが触っている記録の詳細と、閲覧用の画面データ（上の許可リスト）。
    // 持ち主の確認・期限は createQueuePersister が保存と復元のときに行う
    shouldDehydrateQuery: (query: { queryKey: readonly unknown[]; state: { status: string } }): boolean => {
      if (query.state.status !== 'success') return false;
      if (isBrowseQueryKey(query.queryKey)) return true;
      const key = JSON.stringify(query.queryKey);
      return client
        .getMutationCache()
        .getAll()
        .some((m) => isQueuedMutation(m) && key === JSON.stringify(getGetRecordQueryKey(touchedRecordId(m) ?? '')));
    },
  };
}

type SavedMutation = { mutationKey?: readonly unknown[]; state: { status: string; variables?: unknown } };
// 送信待ちが触る記録の詳細のキー。閲覧キャッシュの持ち主・期限の判定から外す（送信待ちの表示に要るため）
function queuedDetailKeys(mutations: SavedMutation[]): Set<string> {
  const keys = new Set<string>();
  for (const m of mutations) {
    const like: MutationLike = { options: { mutationKey: m.mutationKey }, state: m.state };
    if (isQueuedMutation(like)) keys.add(JSON.stringify(getGetRecordQueryKey(touchedRecordId(like) ?? '')));
  }
  return keys;
}

export type PersisterOptions = {
  // いまログインしている人の id（端末の控え）。閲覧キャッシュの持ち主の確認に使う。ログアウト後は null
  getOwner?: () => string | null;
  now?: () => number;
};

type SavedClient = PersistedClient & { browseOwner?: string | null };

// 復元した送信は「止まっていない」状態にして戻す。TanStack Query は電波が戻ると止まっている送信を自分で送るが、
// ログインしている人を確かめる前に送らないよう、再送の開始は自分で行う（lib/offline/resume.ts）。
// 閲覧キャッシュは、保存した時点の持ち主と、いまの持ち主が同じで、1日以内のものだけ戻す
// （別の人がログインした端末に、前の人の記録を見せないため。機密性）
export function createQueuePersister(storage: QueueStorage = idbStorage, options: PersisterOptions = {}): Persister {
  const getOwner = options.getOwner ?? (() => readCachedUser()?.id ?? null);
  const now = options.now ?? Date.now;
  const base = createAsyncStoragePersister({ storage, key: QUEUE_STORAGE_KEY, throttleTime: 100 });
  return {
    persistClient: (client) => {
      const owner = getOwner();
      const keep = queuedDetailKeys(client.clientState.mutations);
      const queries = client.clientState.queries.filter(
        (q) => keep.has(JSON.stringify(q.queryKey)) || (owner !== null && isBrowseQueryKey(q.queryKey)),
      );
      const saved: SavedClient = { ...client, browseOwner: owner, clientState: { ...client.clientState, queries } };
      return base.persistClient(saved);
    },
    removeClient: base.removeClient,
    restoreClient: async () => {
      const restored: SavedClient | undefined = await base.restoreClient();
      if (!restored) return restored;
      const owner = getOwner();
      const sameOwner = owner !== null && restored.browseOwner === owner;
      const keep = queuedDetailKeys(restored.clientState.mutations);
      const queries = restored.clientState.queries.filter(
        (q) =>
          keep.has(JSON.stringify(q.queryKey)) ||
          (sameOwner && isBrowseQueryKey(q.queryKey) && now() - q.state.dataUpdatedAt <= BROWSE_MAX_AGE_MS),
      );
      return {
        ...restored,
        clientState: {
          ...restored.clientState,
          queries,
          mutations: restored.clientState.mutations.map((m) => ({ ...m, state: { ...m.state, isPaused: false } })),
        },
      };
    },
  };
}
