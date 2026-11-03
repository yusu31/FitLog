import { onlineManager, useQueryClient, type QueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { SyncBanner } from '@/components/fitlog/sync-banner';
import { Providers } from '@/app/providers';
import { useRecordMutations } from '@/lib/mutations';
import { resetRejectedSends } from './rejected';
import { createQueuePersister, QUEUE_STORAGE_KEY, type QueueStorage } from './persister';
import { AUTH_RETRY_MS, PARENT_MISSING_MAX_RETRIES, RETRY_BACKOFF_MS } from './retry-policy';

// 送信待ちの端末への保存・再送・帯を、本物の Providers（保存・復元つき）と本物の帯で通して確かめる。
// 保存先は IndexedDB の代わりにメモリ（再読み込み＝Providers を作り直す）。時計は偽物にして、再送の間隔を進める。
// 対応表: T-OFF-07〜13（docs/testing-design.md）。各 it の名前に番号を入れた。
let session: { data: unknown; isPending: boolean } = { data: { user: { id: 'u1' } }, isPending: false };
vi.mock('@/lib/auth-client', () => ({ authClient: { useSession: () => session } }));
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn(), replace: vi.fn() }), usePathname: () => '/today/' }));

type Sent = { method: string; url: string; body: { id?: string } };
type Reply = number | 'network' | 'hang';
let sent: Sent[] = [];
// 送信ごとの応答を決める。応答が尽きたら最後のものを繰り返す。決めていない送信は 201
let replies: Record<string, Reply[]> = {};
function installFetch() {
  sent = [];
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string, init?: RequestInit) => {
      const method = init?.method ?? 'GET';
      const body = init?.body ? JSON.parse(String(init.body)) : {};
      sent.push({ method, url, body });
      const queue = replies[`${method} ${url}`];
      const r: Reply = queue ? (queue.length > 1 ? queue.shift()! : queue[0]) : 201;
      if (r === 'network') throw new TypeError('Failed to fetch');
      if (r === 'hang') return new Promise<Response>(() => undefined);
      return new Response(r === 204 ? null : JSON.stringify({ code: 'X', message: 'm' }), { status: r, headers: { 'Content-Type': 'application/json' } });
    }),
  );
}
const posts = (match?: string) => sent.filter((s) => s.method === 'POST' && (!match || s.url.includes(match)));

function memoryStorage() {
  const store = new Map<string, string>();
  const storage: QueueStorage = {
    getItem: async (k) => store.get(k) ?? null,
    setItem: async (k, v) => void store.set(k, v),
    removeItem: async (k) => void store.delete(k),
  };
  return { store, storage };
}
const persistedMutations = (store: Map<string, string>): { mutationKey: string[]; scope?: { id: string } }[] => {
  const raw = store.get(QUEUE_STORAGE_KEY);
  return raw ? JSON.parse(raw).clientState.mutations : [];
};

// 画面の外から書き込みを呼ぶための取っ手（描画のあとに受け取る）
const probe = {} as { api: ReturnType<typeof useRecordMutations>; client: QueryClient };
function Probe() {
  const api = useRecordMutations();
  const client = useQueryClient();
  useEffect(() => {
    probe.api = api;
    probe.client = client;
  });
  return null;
}
const NOW = '2026-11-04T03:00:00.000Z';

function mount(storage: QueueStorage) {
  return render(
    <Providers persister={createQueuePersister(storage)}>
      <Probe />
      <SyncBanner />
    </Providers>,
  );
}
const tick = (ms: number) => act(async () => void (await vi.advanceTimersByTimeAsync(ms)));
const record = (id = 'r1') => act(() => void probe.api.createRecord.mutate({ data: { id, kind: 'workout', recordedAt: NOW } }));
const addSet = (recordId: string, setId: string, setNo: number) =>
  act(() => void probe.api.addSet.mutate({ id: recordId, data: { id: setId, exerciseId: 'e1', setNo, weightKg: 40, reps: 10 } }));
const banner = () => screen.getByTestId('sync-banner');

beforeEach(() => {
  vi.useFakeTimers({ now: new Date(NOW) });
  session = { data: { user: { id: 'u1' } }, isPending: false };
  replies = {};
  resetRejectedSends();
  onlineManager.setOnline(true);
  installFetch();
});
afterEach(() => {
  onlineManager.setOnline(true);
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('送信待ちの保存と再送（F-30）', () => {
  it('送信待ちが0件のときは、帯を出さず、何も保存しない（境界: 0件）', async () => {
    const { store, storage } = memoryStorage();
    mount(storage);
    await tick(500);
    expect(banner()).toBeEmptyDOMElement();
    expect(persistedMutations(store)).toHaveLength(0);
  });

  it('T-OFF-08: 電波なしで記録 → 「送信待ち 1件」と端末への保存 → 何も送らない。電波が戻ると送って「1件 送ったよ」→ 3秒後に消える', async () => {
    const { store, storage } = memoryStorage();
    mount(storage);
    await tick(10);
    onlineManager.setOnline(false);
    await record();
    await tick(500);
    expect(banner()).toHaveTextContent('送信待ち 1件');
    expect(banner()).toHaveTextContent('この端末に保存ずみ');
    expect(persistedMutations(store)).toHaveLength(1);
    expect(posts()).toHaveLength(0);

    onlineManager.setOnline(true);
    await tick(500);
    expect(posts()).toHaveLength(1);
    expect(banner()).toHaveTextContent('1件 送ったよ');
    await tick(3000);
    expect(banner()).toBeEmptyDOMElement();
    expect(persistedMutations(store)).toHaveLength(0);
  });

  it('T-OFF-08: 再読み込み（Providers を作り直す）しても送信待ちが残り、戻ると1件ずつ送る。サーバーに届く記録はちょうど1件', async () => {
    const { store, storage } = memoryStorage();
    const first = mount(storage);
    await tick(10);
    onlineManager.setOnline(false);
    await record('r1');
    await addSet('r1', 's1', 1);
    await tick(500);
    first.unmount();

    mount(storage); // 再読み込み
    await tick(500);
    expect(banner()).toHaveTextContent('送信待ち 2件');
    expect(posts()).toHaveLength(0);

    onlineManager.setOnline(true);
    await tick(500);
    expect(posts().map((p) => p.url)).toEqual(['/api/records', '/api/records/r1/sets']);
    expect(posts().map((p) => p.body.id)).toEqual(['r1', 's1']);
    expect(banner()).toHaveTextContent('2件 送ったよ');
    await tick(500);
    expect(persistedMutations(store)).toHaveLength(0);
  });

  it('T-OFF-10: 多数の送信待ち（記録 → セット1 → セット2 → 別の記録）は、作った順に送る（境界: 多数）', async () => {
    const { storage } = memoryStorage();
    mount(storage);
    await tick(10);
    onlineManager.setOnline(false);
    await record('r1');
    await addSet('r1', 's1', 1);
    await addSet('r1', 's2', 2);
    await record('r2');
    await tick(300);
    expect(banner()).toHaveTextContent('送信待ち 4件');
    onlineManager.setOnline(true);
    await tick(1000);
    expect(posts().map((p) => p.body.id)).toEqual(['r1', 's1', 's2', 'r2']);
    expect(banner()).toHaveTextContent('4件 送ったよ');
  });

  it('同じ ID の二重送信: 届いたか分からないまま閉じた送信は、開き直すと同じ ID でもう一度送る（API は冪等なので1件のまま）', async () => {
    const { storage } = memoryStorage();
    replies['POST /api/records'] = ['hang'];
    const first = mount(storage);
    await tick(10);
    await record('r1'); // 送ったが応答が来ないまま閉じる
    await tick(500);
    expect(posts()).toHaveLength(1);
    first.unmount();

    replies['POST /api/records'] = [200]; // 2回目は「もうある」と 200 で返る（design.md 7章）
    mount(storage);
    await tick(500);
    expect(posts()).toHaveLength(2);
    expect(posts().map((p) => p.body.id)).toEqual(['r1', 'r1']);
    // 電波があって送れた（ふつうは1秒ほど）ので、帯は出さない
    expect(banner()).toBeEmptyDOMElement();
    expect(probe.client.getMutationCache().getAll().every((m) => m.state.status === 'success')).toBe(true);
  });

  describe('送れなかったとき（T-OFF-11・12・13・09）', () => {
    it.each<[string, Reply]>([
      ['500', 500],
      ['503', 503],
      ['408', 408],
      ['429', 429],
      ['通信の断（fetch が例外）', 'network'],
    ])('T-OFF-11: %s は送信待ちに残し、間隔を空けて再送する。戻ったら送って帯が消える', async (_label, bad) => {
      const { storage } = memoryStorage();
      replies['POST /api/records'] = [bad, bad, 201];
      mount(storage);
      await tick(10);
      await record();
      await tick(100);
      expect(posts()).toHaveLength(1);
      expect(banner()).toHaveTextContent('送信待ち 1件');
      expect(banner()).not.toHaveTextContent('送れなかった記録');
      await tick(RETRY_BACKOFF_MS[0]);
      expect(posts()).toHaveLength(2); // 1回目の再送
      await tick(RETRY_BACKOFF_MS[1]);
      expect(posts()).toHaveLength(3);
      expect(banner()).toHaveTextContent('1件 送ったよ');
    });

    it('T-OFF-11: 再送の途中で失敗しても、残りの順番は崩れない（記録は届き、セットは再送を繰り返して届く）', async () => {
      const { storage } = memoryStorage();
      replies['POST /api/records/r1/sets'] = [500, 201];
      mount(storage);
      await tick(10);
      onlineManager.setOnline(false);
      await record('r1');
      await addSet('r1', 's1', 1);
      await addSet('r1', 's2', 2);
      onlineManager.setOnline(true);
      await tick(200);
      expect(posts().map((p) => p.body.id)).toEqual(['r1', 's1']); // s1 が 500 で止まり、s2 は先に行かない
      expect(banner()).toHaveTextContent('送信待ち 2件');
      await tick(RETRY_BACKOFF_MS[0] + 200);
      expect(posts().map((p) => p.body.id)).toEqual(['r1', 's1', 's1', 's2']);
      expect(banner()).toHaveTextContent('3件 送ったよ');
    });

    it('T-OFF-11: 件数に上限はなく、再送の間隔は最後の間隔のまま続く（何度失敗しても外さない）', async () => {
      const { storage } = memoryStorage();
      replies['POST /api/records'] = [500];
      mount(storage);
      await tick(10);
      await record();
      await tick(10 * 60_000);
      expect(posts().length).toBeGreaterThan(RETRY_BACKOFF_MS.length + 3);
      expect(banner()).toHaveTextContent('送信待ち 1件');
      replies['POST /api/records'] = [201];
      await tick(RETRY_BACKOFF_MS[RETRY_BACKOFF_MS.length - 1] + 100);
      expect(probe.client.getMutationCache().getAll().every((m) => m.state.status === 'success')).toBe(true);
    });

    it.each([400, 403, 409])('T-OFF-12: %s は再送せず送信待ちから外し、「送れなかった記録があります」を1回だけ知らせる', async (status) => {
      const { store, storage } = memoryStorage();
      replies['POST /api/records'] = [status];
      mount(storage);
      await tick(10);
      await record();
      await tick(100);
      expect(banner()).toHaveTextContent('送れなかった記録があります');
      expect(banner()).not.toHaveTextContent('送信待ち');
      await tick(5 * 60_000); // 間隔を何度空けても再送しない
      expect(posts()).toHaveLength(1);
      expect(screen.getAllByText('送れなかった記録があります')).toHaveLength(1);
      expect(persistedMutations(store)).toHaveLength(0);
      fireEvent.click(screen.getByRole('button', { name: 'とじる' }));
      expect(banner()).toBeEmptyDOMElement(); // 知らせは1回だけ（繰り返さない）
    });

    it('取り除かれた送信待ちは、再送の順番が回ってきても送らない（再送待ちの途中で片づけられたとき）', async () => {
      const { storage } = memoryStorage();
      replies['POST /api/records'] = [500];
      mount(storage);
      await tick(10);
      await record();
      await tick(100);
      expect(posts()).toHaveLength(1);
      const cache = probe.client.getMutationCache();
      for (const m of cache.getAll()) cache.remove(m);
      await tick(60_000);
      expect(posts()).toHaveLength(1);
    });

    it('T-OFF-12: 外された記録は「送ったよ」に数えない（2件のうち1件が 400 なら「1件 送ったよ」）', async () => {
      const { storage } = memoryStorage();
      replies['POST /api/records'] = [201, 400];
      mount(storage);
      await tick(10);
      onlineManager.setOnline(false);
      await record('r1');
      await record('r2');
      onlineManager.setOnline(true);
      await tick(500);
      expect(banner()).toHaveTextContent('1件 送ったよ');
      expect(banner()).toHaveTextContent('送れなかった記録があります');
    });

    it('T-OFF-13: セットが 404（親の記録がまだ無い）なら、数回待って再送する。親が届けば送れる', async () => {
      const { storage } = memoryStorage();
      replies['POST /api/records/r1/sets'] = [404, 404, 201];
      mount(storage);
      await tick(10);
      await record('r1');
      await addSet('r1', 's1', 1);
      await tick(200);
      expect(banner()).not.toHaveTextContent('送れなかった記録');
      await tick(RETRY_BACKOFF_MS[0] + RETRY_BACKOFF_MS[1] + 200);
      expect(posts('/sets')).toHaveLength(3);
      expect(banner()).toHaveTextContent('1件 送ったよ'); // 記録の作成は帯が出る前に届いている
    });

    it('T-OFF-13: 404 が続くセットは、待つ回数の上限（境界: 上限ちょうど）を超えたら外して知らせる。記録の作成の 404 は待たずに外す', async () => {
      const { storage } = memoryStorage();
      replies['POST /api/records/r1/sets'] = [404];
      replies['POST /api/records'] = [404];
      mount(storage);
      await tick(10);
      await record('r1'); // 作成の 404 は親を待つ理由がないので、すぐ外す
      await tick(100);
      expect(posts('/api/records')).toHaveLength(1);
      expect(banner()).toHaveTextContent('送れなかった記録があります');
      fireEvent.click(screen.getByRole('button', { name: 'とじる' }));

      await addSet('r1', 's1', 1);
      await tick(2 * 60_000);
      expect(posts('/sets')).toHaveLength(1 + PARENT_MISSING_MAX_RETRIES); // 最初の1回 + 待った3回
      expect(banner()).toHaveTextContent('送れなかった記録があります');
    });

    it('T-OFF-13: ほかの人の流れ（別の scope）の送信は止めない。1本が 500 で止まっていても、別の記録の作成は同じ scope の順番に従う', async () => {
      // 同じ人の書き込みは同じ scope なので 1 本ずつ。止まっている間も、先頭が 500 の間は後ろに進まない（順番を守る）
      const { storage } = memoryStorage();
      replies['POST /api/records'] = [500, 201];
      mount(storage);
      await tick(10);
      await record('r1');
      await record('r2');
      await tick(200);
      expect(posts().map((p) => p.body.id)).toEqual(['r1']);
      await tick(RETRY_BACKOFF_MS[0] + 200);
      expect(posts().map((p) => p.body.id)).toEqual(['r1', 'r1', 'r2']);
    });

    it('T-OFF-09: 401 は送信待ちを捨てず、「ログイン」ボタンを出す。ログインし直したら送って帯が消える', async () => {
      const { store, storage } = memoryStorage();
      replies['POST /api/records'] = [401];
      mount(storage);
      await tick(10);
      await record();
      await tick(300);
      expect(banner()).toHaveTextContent('送信待ち 1件');
      expect(banner()).toHaveTextContent('記録は残ってるよ。ログインで送るね');
      expect(screen.getByRole('link', { name: 'ログイン' })).toHaveAttribute('href', expect.stringContaining('/login?next='));
      expect(persistedMutations(store)).toHaveLength(1);
      await tick(AUTH_RETRY_MS * 5); // ログインするまで、捨てずに確かめ続ける
      expect(persistedMutations(store)).toHaveLength(1);
      expect(banner()).toHaveTextContent('送信待ち 1件');
      replies['POST /api/records'] = [201]; // ログインし直した
      await tick(AUTH_RETRY_MS + 100);
      expect(banner()).toHaveTextContent('1件 送ったよ');
      expect(screen.queryByRole('link', { name: 'ログイン' })).not.toBeInTheDocument();
    });
  });

  describe('再読み込み後の再送の始まり', () => {
    it('ログインしている人が分かるまでは送らない（分かったら送る）', async () => {
      const { storage } = memoryStorage();
      const first = mount(storage);
      await tick(10);
      onlineManager.setOnline(false);
      await record();
      await tick(500);
      first.unmount();
      onlineManager.setOnline(true);

      session = { data: null, isPending: true };
      const second = mount(storage);
      await tick(500);
      expect(posts()).toHaveLength(0);
      session = { data: { user: { id: 'u1' } }, isPending: false };
      second.rerender(
        <Providers persister={createQueuePersister(storage)}>
          <Probe />
          <SyncBanner />
        </Providers>,
      );
      await tick(500);
      expect(posts()).toHaveLength(1);
    });

    it('別の人がログインした端末では、前の人の送信待ちを送らずに捨てる（その人の名前で保存されないように）', async () => {
      const { storage } = memoryStorage();
      const first = mount(storage);
      await tick(10);
      onlineManager.setOnline(false);
      await record();
      await tick(500);
      first.unmount();
      onlineManager.setOnline(true);

      session = { data: { user: { id: 'u2' } }, isPending: false };
      mount(storage);
      await tick(1000);
      expect(posts()).toHaveLength(0);
      expect(banner()).toBeEmptyDOMElement();
    });
  });

  it('電波なしで記録した画面の見え方は、保存・復元のあとも同じ（記録の詳細のキャッシュが戻る）', async () => {
    const { storage } = memoryStorage();
    const first = mount(storage);
    await tick(10);
    onlineManager.setOnline(false);
    await record('r1');
    await addSet('r1', 's1', 1);
    await tick(500);
    first.unmount();

    mount(storage);
    await tick(500);
    const detail = probe.client.getQueryData<{ data: { kind: string; exercises?: { sets: unknown[] }[] } }>(['/api/records/r1']);
    expect(detail?.data.kind).toBe('workout');
    expect(detail?.data.exercises?.[0].sets).toHaveLength(1);
  });
});
