import { onlineManager, QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { resetCopyPlan, setCopyPlan } from '@/lib/copy-plan';
import { bestCountOf, resetCurrentWorkout } from '@/lib/current-workout';
import { FORBIDDEN_WORDS } from '@/lib/forbidden-words';
import { GHOST_MESSAGES } from '@/lib/messages';
import { advanceSent, resetSentNotice } from '@/lib/offline/sent-notice';
import { RecordView } from './record-view';
import { trackClient } from '@/lib/test/fake-api';

let search = 'exercise=e-bench';
vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: vi.fn() }),
  usePathname: () => '/record/',
  useSearchParams: () => new URLSearchParams(search),
}));
vi.mock('@/lib/auth-client', () => ({
  authClient: { useSession: () => ({ data: { user: { id: 'u1' } }, isPending: false }) },
}));

const EXERCISES = [
  { id: 'e-bench', name: 'ベンチプレス', bodyPart: 'chest', isCustom: false, trialWeightKg: 40, trialReps: 10 },
  { id: 'e-mine', name: 'ケトルベルスイング', bodyPart: 'glutes', isCustom: true, trialWeightKg: null, trialReps: null },
  { id: 'e-pushup', name: '腕立て伏せ', bodyPart: 'chest', isCustom: false, trialWeightKg: 0, trialReps: 10 },
];
const PREVIOUS = {
  previous: {
    recordedAt: '2026-10-25T09:12:00.000Z',
    sets: [
      { setNo: 1, weightKg: 40, reps: 10 },
      { setNo: 2, weightKg: 40, reps: 10 },
      { setNo: 3, weightKg: 40, reps: 9 },
    ],
  },
  personalBest: { weightKg: 40, reps: 10, volume: 400 },
};
const AVATAR = { body: 'normal', hair: 1, hairColor: 'black', shirtColor: 'teal', pantsColor: 'gray' };
const NO_PREVIOUS = { previous: null, personalBest: null };
// 集計（F-20 の「今月◯日目」の材料）。今月3日動いていて、今日はまだ数えられていない
const STATS = {
  today: '2026-11-02',
  calendar: [
    { date: '2026-11-01', status: 'rec' },
    { date: '2026-11-02', status: 'none' },
  ],
  month: { month: '2026-11', activeDays: 3, restDays: 0, totalWeightKg: 0, runDistanceM: 0 },
  weekly: [],
  stamps: [],
};

type Call = { method: string; url: string; body?: Record<string, unknown> };
type Reply = { status: number; body?: unknown };
let calls: Call[] = [];
let handlers: Record<string, (call: Call) => Reply | Promise<Reply>> = {};

// セットの応答は、送った内容を返し、result・isPersonalBest だけテストが決める
let setReply: (call: Call) => Reply | Promise<Reply>;
const echoSet = (result: string | null, isPersonalBest = false) => (call: Call) => ({
  status: 201,
  body: { id: call.body?.id, setNo: call.body?.setNo, weightKg: call.body?.weightKg, reps: call.body?.reps, result, isPersonalBest },
});

beforeEach(() => {
  // 今は 2026-10-26 12:00（日本時間）。前回（10-25）から1日。休み明け（3日以上）にならない。Date だけ止め、タイマーは本物のまま
  vi.useFakeTimers({ toFake: ['Date'], shouldAdvanceTime: true });
  vi.setSystemTime(new Date('2026-10-26T03:00:00Z'));
  search = 'exercise=e-bench';
  calls = [];
  resetCurrentWorkout();
  resetCopyPlan();
  setReply = echoSet('same');
  handlers = {
    'GET /api/exercises': () => ({ status: 200, body: EXERCISES }),
    'GET /api/me/stats': () => ({ status: 200, body: STATS }),
    'GET /api/records': () => ({ status: 200, body: { items: [], nextCursor: null } }),
    'GET /api/groups/current': () => ({
      status: 200,
      body: {
        id: 'g1',
        name: 'チーム',
        members: [
          { id: 'u1', name: 'わたし', avatar: AVATAR },
          { id: 'u2', name: 'はなこ', avatar: AVATAR },
          { id: 'u3', name: 'たろう', avatar: AVATAR },
        ],
      },
    }),
    // 仲間(friendId 付き)は、はなこだけ前回がある
    'GET /api/exercises/e-bench/previous': (call) =>
      call.url.includes('friendId=u2')
        ? { status: 200, body: { previous: { recordedAt: '2026-10-26T09:00:00.000Z', sets: [{ setNo: 1, weightKg: 60, reps: 8 }] }, personalBest: null } }
        : call.url.includes('friendId=')
          ? { status: 200, body: NO_PREVIOUS }
          : { status: 200, body: PREVIOUS },
    'GET /api/exercises/e-mine/previous': () => ({ status: 200, body: NO_PREVIOUS }),
    'GET /api/exercises/e-pushup/previous': () => ({ status: 200, body: NO_PREVIOUS }),
    'POST /api/records': (call) => ({ status: 201, body: { id: call.body?.id, kind: 'workout', recordedAt: call.body?.recordedAt, localDate: '2026-11-02' } }),
    'POST /api/records/:id/sets': (call) => setReply(call),
    'DELETE /api/records/:id/sets/:setId': () => ({ status: 204 }),
  };
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string, init?: RequestInit) => {
      const method = init?.method ?? 'GET';
      const call: Call = { method, url, body: init?.body ? JSON.parse(String(init.body)) : undefined };
      calls.push(call);
      const path = url.split('?')[0];
      const key = path.replace(/^\/api\/records\/[^/]+\/sets\/[^/]+$/, '/api/records/:id/sets/:setId').replace(/^\/api\/records\/[^/]+\/sets$/, '/api/records/:id/sets').replace(/^\/api\/records\/[^/]+$/, '/api/records/:id').replace(/^\/api\/body\/calories\/[^/]+$/, '/api/body/calories/:id');
      const handler = handlers[`${method} ${key}`];
      if (!handler) throw new Error(`想定外の呼び出し: ${method} ${url}`);
      const { status, body } = await handler(call);
      return new Response(status === 204 ? null : JSON.stringify(body ?? {}), { status, headers: { 'Content-Type': 'application/json' } });
    }),
  );
});

afterEach(() => {
  resetSentNotice();
  vi.useRealTimers();
  onlineManager.setOnline(true);
  vi.unstubAllGlobals();
});

const renderView = () => {
  const client = trackClient(new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } }));
  return render(
    <QueryClientProvider client={client}>
      <RecordView />
    </QueryClientProvider>,
  );
};

const weight = () => screen.getByRole('spinbutton', { name: '重量（kg）' });
const reps = () => screen.getByRole('spinbutton', { name: '回数' });
const doneButton = () => screen.getByRole('button', { name: 'できた' });
const ready = async () => {
  await screen.findByRole('heading', { name: 'ベンチプレス' });
  await screen.findByRole('group', { name: '前回との くらべ' });
};
const openFriends = async () => userEvent.click(await screen.findByRole('button', { name: /仲間と くらべる/ }));
// 「…」のシート（休憩する・2秒動画。D3-7）を開く
const openMore = async () => userEvent.click(await screen.findByRole('button', { name: 'ほかの操作' }));
const sheet = () => screen.queryByTestId('result-sheet');
const setCalls = () => calls.filter((c) => c.method === 'POST' && /\/sets$/.test(c.url));

describe('RecordView（S-12 記録・筋トレ）', () => {
  describe('最初に入る値と前回のバー（features.md 2.3・2.5）', () => {
    it('種目名と、前回の同じセット番号（1セット目）の重量・回数が最初から入っている', async () => {
      renderView();
      await ready();
      expect(weight()).toHaveValue(40);
      expect(reps()).toHaveValue(10);
      expect(screen.getByText('いま 1セット目')).toBeInTheDocument();
    });

    it('D3-6 前回のバーは「前回 40kg × 10回 → 今回 40kg × 10回」の1行（3行にしない）', async () => {
      renderView();
      await ready();
      const bar = screen.getByRole('group', { name: '前回との くらべ' });
      expect(bar).toHaveTextContent('前回 40kg × 10回 今回 40kg × 10回');
      expect(bar.querySelectorAll('p')).toHaveLength(1);
      expect(within(bar).queryByText('前回のじぶん')).not.toBeInTheDocument();
    });

    it('D3 L12 入力欄は前回の同じ番号のセット（40×10）。目標（同じ1セット目から 40×11）は入力欄の横に小さく出す', async () => {
      renderView();
      await ready();
      expect(reps()).toHaveValue(10);
      expect(screen.getByTestId('target-hint')).toHaveTextContent('目標 40kg × 11回');
    });

    it('GET /api/exercises/{id}/previous に、画面を開いた時刻を before として渡す（今の記録を前回にしない）', async () => {
      renderView();
      await ready();
      const prev = calls.find((c) => c.url.startsWith('/api/exercises/e-bench/previous'));
      const before = new URL(prev!.url, 'http://x').searchParams.get('before');
      expect(Number.isNaN(Date.parse(before ?? ''))).toBe(false);
    });

    it('前回が無ければ、種目のお試し値が入り、「目安」の札が付く（A03-3）', async () => {
      handlers['GET /api/exercises/e-bench/previous'] = () => ({ status: 200, body: NO_PREVIOUS });
      renderView();
      await ready();
      expect(weight()).toHaveValue(40);
      expect(reps()).toHaveValue(10);
      expect(within(screen.getByRole('group', { name: '前回との くらべ' })).getByText('目安')).toBeInTheDocument();
    });

    it('前回もお試しも無い種目は、0kg × 10回から。比べる相手が無いと伝える', async () => {
      search = 'exercise=e-mine';
      renderView();
      await screen.findByRole('heading', { name: 'ケトルベルスイング' });
      await screen.findByText('前回の記録は まだないよ');
      expect(weight()).toHaveValue(0);
      expect(reps()).toHaveValue(10);
    });

    it('前回が3セットのとき、4セット目には前回の最後のセット（40×9）が入り、目標は 40×10 と出る', async () => {
      const user = userEvent.setup();
      renderView();
      await ready();
      for (let i = 0; i < 3; i++) await user.click(doneButton());
      await screen.findByText('いま 4セット目');
      expect(weight()).toHaveValue(40);
      expect(reps()).toHaveValue(9);
      expect(screen.getByTestId('target-hint')).toHaveTextContent('目標 40kg × 10回');
    });

    it('種目が見つからないときは、種目を選び直す案内を出す', async () => {
      search = 'exercise=nothing';
      renderView();
      expect(await screen.findByText(/種目が見つかりませんでした/)).toBeInTheDocument();
      expect(screen.getByRole('link', { name: '種目を選ぶ' })).toHaveAttribute('href', '/exercises');
    });
  });

  describe('＋/−（T-SET-06）', () => {
    it('回数は ±1、重量は ±2.5kg', async () => {
      const user = userEvent.setup();
      renderView();
      await ready();
      await user.click(screen.getByRole('button', { name: '回数を 1回 ふやす' }));
      expect(reps()).toHaveValue(11);
      await user.click(screen.getByRole('button', { name: '回数を 1回 へらす' }));
      await user.click(screen.getByRole('button', { name: '回数を 1回 へらす' }));
      expect(reps()).toHaveValue(9);
      await user.click(screen.getByRole('button', { name: '重量を 2.5kg ふやす' }));
      expect(weight()).toHaveValue(42.5);
      await user.click(screen.getByRole('button', { name: '重量を 2.5kg へらす' }));
      await user.click(screen.getByRole('button', { name: '重量を 2.5kg へらす' }));
      expect(weight()).toHaveValue(37.5);
    });

    it('範囲の端では、押しても超えない（回数 1・999、重量 0・500）', async () => {
      const user = userEvent.setup();
      renderView();
      await ready();
      await user.clear(reps());
      await user.type(reps(), '1');
      await user.click(screen.getByRole('button', { name: '回数を 1回 へらす' }));
      expect(reps()).toHaveValue(1);
      await user.clear(weight());
      await user.type(weight(), '500');
      await user.click(screen.getByRole('button', { name: '重量を 2.5kg ふやす' }));
      expect(weight()).toHaveValue(500);
    });

    it('数字を直接打てる。範囲の外の値は、入力欄から離れたときに範囲へ収める', async () => {
      const user = userEvent.setup();
      renderView();
      await ready();
      await user.clear(reps());
      await user.type(reps(), '1000');
      await user.tab();
      expect(reps()).toHaveValue(999);
    });
  });

  // T-REST-08（F-34）・D3 PR-4: 「できた」で休憩が自動で始まり、下の帯に出る（A03-2 を上書き）。きのうの分（あとから記録）には出さない
  describe('休憩タイマー', () => {
    beforeEach(() => localStorage.clear());

    it('「できた」で休憩が自動で始まり、大きなタイマーに切り替えられ、スキップで閉じる', async () => {
      const user = userEvent.setup();
      renderView();
      await ready();
      expect(screen.queryByRole('region', { name: '休憩タイマー' })).not.toBeInTheDocument();
      await user.click(doneButton());
      expect(await screen.findByRole('region', { name: '休憩タイマー' })).toBeInTheDocument();
      // D3 L8: 帯は1行（残り時間・＋30秒・スキップ）。進捗バー・±15秒は、帯を押した全画面にだけある
      const band = screen.getByRole('region', { name: '休憩タイマー' });
      expect(within(band).getByRole('button', { name: '休憩を30秒長くする' })).toBeInTheDocument();
      expect(within(band).queryByRole('button', { name: '休憩を15秒長くする' })).not.toBeInTheDocument();
      await user.click(screen.getByRole('button', { name: '大きなタイマーで見る' }));
      expect(screen.getByRole('button', { name: '小さくして下の帯にもどす' })).toHaveAttribute('aria-expanded', 'true');
      expect(screen.getByRole('button', { name: '休憩を15秒長くする' })).toBeInTheDocument();
      await user.click(screen.getByRole('button', { name: '休憩をスキップ' }));
      expect(screen.queryByRole('region', { name: '休憩タイマー' })).not.toBeInTheDocument();
    });

    it('端末に控えた長さで始まる', async () => {
      localStorage.setItem('fitlog:rest-seconds', '120');
      const user = userEvent.setup();
      renderView();
      await ready();
      await user.click(doneButton());
      expect(await screen.findByTestId('rest-remaining')).toHaveTextContent('2:00');
    });

    it('きのうの分（あとから記録）には「休憩する」を出さない', async () => {
      search = 'exercise=e-bench&day=yesterday';
      const user = userEvent.setup();
      renderView();
      await ready();
      await user.click(doneButton());
      await waitFor(() => expect(setCalls()).toHaveLength(1));
      expect(screen.queryByRole('button', { name: '休憩する' })).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'ほかの操作' })).not.toBeInTheDocument(); // きのうの分は休憩も動画も無いので「…」自体を出さない
      expect(screen.queryByRole('region', { name: '休憩タイマー' })).not.toBeInTheDocument();
    });
  });

  describe('「できた」', () => {
    it('B14b: 応答のあと推定消費カロリーを取り、出せるときだけ板に「約○kcal」を出す', async () => {
      handlers['GET /api/body/calories/:id'] = () => ({ status: 200, body: { recordId: 'r', kcal: 123, mets: 5, durationSec: 600, weightKg: 60, reason: null } });
      const user = userEvent.setup();
      renderView();
      await ready();
      await user.click(doneButton());
      expect(await screen.findByTestId('sheet-kcal')).toHaveTextContent('約 123 kcal');
    });

    it('B14b: 出せないとき（kcal が null）は板に出さない', async () => {
      handlers['GET /api/body/calories/:id'] = () => ({ status: 200, body: { recordId: 'r', kcal: null, mets: null, durationSec: null, weightKg: null, reason: 'NO_WEIGHT' } });
      const user = userEvent.setup();
      renderView();
      await ready();
      await user.click(doneButton());
      await waitFor(() => expect(calls.some((c) => c.url.startsWith('/api/body/calories/'))).toBe(true));
      expect(screen.queryByTestId('sheet-kcal')).not.toBeInTheDocument();
    });

    it('最初の「できた」で記録（kind=workout）を作り、そのあとセットを足す。2回目からは同じ記録にセットだけ足す', async () => {
      const user = userEvent.setup();
      renderView();
      await ready();
      await user.click(doneButton());
      await waitFor(() => expect(setCalls()).toHaveLength(1));
      await user.click(doneButton());
      await waitFor(() => expect(setCalls()).toHaveLength(2));

      const creates = calls.filter((c) => c.method === 'POST' && c.url === '/api/records');
      expect(creates).toHaveLength(1);
      const create = creates[0].body!;
      expect(create).toMatchObject({ kind: 'workout' });
      expect(create.id).toEqual(expect.stringMatching(/^[0-9a-f-]{36}$/));
      expect(Number.isNaN(Date.parse(String(create.recordedAt)))).toBe(false);

      const [first, second] = setCalls();
      expect(first.url).toBe(`/api/records/${create.id}/sets`);
      expect(second.url).toBe(first.url);
      expect(first.body).toMatchObject({ exerciseId: 'e-bench', setNo: 1, weightKg: 40, reps: 10 });
      expect(second.body).toMatchObject({ exerciseId: 'e-bench', setNo: 2, weightKg: 40, reps: 10 });
      expect(first.body!.id).not.toBe(second.body!.id);
      // 記録の作成 → セット1 → セット2 の順
      const order = calls.filter((c) => c.method === 'POST').map((c) => c.url.replace(/[0-9a-f]{8}-[0-9a-f-]{27}/, '{id}'));
      expect(order).toEqual(['/api/records', '/api/records/{id}/sets', '/api/records/{id}/sets']);
    });

    it('押した瞬間に、できたセットが一覧に並ぶ（API の応答を待たない）', async () => {
      handlers['POST /api/records/:id/sets'] = () => new Promise(() => {}); // 返事が来ない
      const user = userEvent.setup();
      renderView();
      await ready();
      await user.click(doneButton());
      const list = await screen.findByRole('list', { name: 'できたセット' });
      expect(within(list).getAllByRole('listitem')).toHaveLength(1);
      expect(list).toHaveTextContent('40kg × 10回');
    });

    it('1セット目で値を変えたら、2セット目以降はその値が入る', async () => {
      const user = userEvent.setup();
      renderView();
      await ready();
      await user.click(screen.getByRole('button', { name: '回数を 1回 ふやす' }));
      await user.click(screen.getByRole('button', { name: '回数を 1回 ふやす' }));
      await user.click(doneButton());
      await screen.findByText('いま 2セット目');
      expect(reps()).toHaveValue(12); // 前回の2セット目は 10 回だが、直した 12 回を引き継ぐ
    });

    it('同じ値のままなら、2セット目は前回の2セット目の値のまま', async () => {
      const user = userEvent.setup();
      renderView();
      await ready();
      await user.click(doneButton());
      await screen.findByText('いま 2セット目');
      expect(reps()).toHaveValue(10);
    });

    it('API が 400 などで受け付けなかったときは、先に出したセットを戻し、責めずに知らせる', async () => {
      setReply = () => ({ status: 400, body: { code: 'VALIDATION', message: '入力を もう一度 たしかめてください' } });
      const user = userEvent.setup();
      renderView();
      await ready();
      await user.click(doneButton());
      expect(await screen.findByRole('alert')).toHaveTextContent('入力を もう一度 たしかめてください');
      await waitFor(() => expect(screen.queryByRole('list', { name: 'できたセット' })).not.toBeInTheDocument());
    });
  });

  describe('結果シート（F-06。3秒・タップで飛ばせる）', () => {
    it('上回ったら「前回超え +N」を、API の応答を待たずに仮表示する', async () => {
      handlers['POST /api/records/:id/sets'] = () => new Promise(() => {});
      const user = userEvent.setup();
      renderView();
      await ready();
      expect(sheet()).not.toBeInTheDocument();
      await user.click(screen.getByRole('button', { name: '回数を 1回 ふやす' }));
      await user.click(doneButton());
      expect(sheet()).toHaveTextContent('前回超え +1');
      expect(sheet()).toHaveTextContent('ベンチプレス 40kg × 11回');
    });

    it('F-20 祝福に「今月 N 日目」を重ねる（今月3日動いていて今日が未計上なら 4 日目）。集計が取れなければ出さない', async () => {
      const user = userEvent.setup();
      renderView();
      await ready();
      await user.click(doneButton());
      await waitFor(() => expect(sheet()).toHaveTextContent('今月 4 日目'));
      await user.click(sheet()!);

      handlers['GET /api/me/stats'] = () => ({ status: 500, body: { code: 'X', message: 'x', details: null } });
      cleanup();
      renderView();
      await ready();
      await user.click(doneButton());
      expect(sheet()).toBeInTheDocument();
      expect(screen.queryByTestId('month-day')).not.toBeInTheDocument();
    });

    it('同じなら「前回と おなじ」、下回っても責めずに「ちゃんと 記録したよ。むりしない日もOK」', async () => {
      const user = userEvent.setup();
      renderView();
      await ready();
      await user.click(doneButton());
      expect(sheet()).toHaveTextContent(GHOST_MESSAGES.same);
      await user.click(sheet()!); // タップで飛ばす
      setReply = echoSet('down');
      await user.click(screen.getByRole('button', { name: '回数を 1回 へらす' }));
      await user.click(doneButton());
      expect(sheet()).toHaveTextContent(GHOST_MESSAGES.down);
    });

    it('読める長さ（2秒）はまだ出ていて、3秒たつと消える', async () => {
      const user = userEvent.setup();
      renderView();
      await ready();
      await user.click(doneButton());
      expect(sheet()).toBeInTheDocument();
      await new Promise((r) => setTimeout(r, 2000));
      expect(sheet()).toBeInTheDocument();
      await waitFor(() => expect(sheet()).not.toBeInTheDocument(), { timeout: 2000 });
    }, 10_000);

    it('タップすると、3秒を待たずに消える', async () => {
      const user = userEvent.setup();
      renderView();
      await ready();
      await user.click(doneButton());
      await user.click(sheet()!);
      expect(sheet()).not.toBeInTheDocument();
    });

    it('過去最大の 重量×回数 を超えたら「ベスト」の札を出す', async () => {
      setReply = echoSet('up', true);
      const user = userEvent.setup();
      renderView();
      await ready();
      await user.click(screen.getByRole('button', { name: '回数を 1回 ふやす' }));
      await user.click(doneButton());
      expect(within(sheet()!).getByText('ベスト')).toBeInTheDocument();
      // 一覧のそのセットにも札が付く
      expect(within(screen.getByRole('list', { name: 'できたセット' })).getByText('ベスト')).toBeInTheDocument();
    });

    it('過去最大と同じ（40×10）はベストにしない', async () => {
      const user = userEvent.setup();
      renderView();
      await ready();
      await user.click(doneButton());
      expect(within(sheet()!).queryByText('ベスト')).not.toBeInTheDocument();
    });

    it('API の応答が画面の仮の結果と違えば、API に合わせて直す（API が正）', async () => {
      let release: () => void = () => {};
      handlers['POST /api/records/:id/sets'] = (call) =>
        new Promise((resolve) => {
          release = () => resolve(echoSet('down', false)(call));
        });
      const user = userEvent.setup();
      renderView();
      await ready();
      await user.click(screen.getByRole('button', { name: '回数を 1回 ふやす' }));
      await user.click(doneButton());
      expect(sheet()).toHaveTextContent('前回超え +1'); // 仮表示
      expect(within(sheet()!).getByText('ベスト')).toBeInTheDocument();
      release();
      await waitFor(() => expect(sheet()).toHaveTextContent(GHOST_MESSAGES.down));
      expect(within(sheet()!).queryByText('ベスト')).not.toBeInTheDocument();
    });

    it('前回が無い（比べる相手がいない）ときは「記録したよ」', async () => {
      search = 'exercise=e-mine';
      setReply = echoSet(null);
      const user = userEvent.setup();
      renderView();
      await screen.findByText('前回の記録は まだないよ');
      await user.click(doneButton());
      expect(sheet()).toHaveTextContent('記録したよ');
      expect(within(sheet()!).queryByText('ベスト')).not.toBeInTheDocument();
    });

    describe('動きを減らす設定（prefers-reduced-motion）', () => {
      const stubMotion = (reduce: boolean) =>
        vi.stubGlobal('matchMedia', (query: string) => ({
          matches: reduce && query.includes('prefers-reduced-motion'),
          media: query,
          addEventListener: () => {},
          removeEventListener: () => {},
        }));
      afterEach(() => vi.unstubAllGlobals());

      it('設定が「減らす」なら、動かさず表示だけ（data-motion="reduced"・動きのクラスなし）', async () => {
        stubMotion(true);
        const user = userEvent.setup();
        renderView();
        await ready();
        await user.click(doneButton());
        expect(sheet()).toHaveAttribute('data-motion', 'reduced');
        expect(sheet()!.className).not.toMatch(/animate-|slide-in|transition/);
      });

      it('設定が無ければ、下から上がる動きをつける', async () => {
        stubMotion(false);
        const user = userEvent.setup();
        renderView();
        await ready();
        await user.click(doneButton());
        expect(sheet()).toHaveAttribute('data-motion', 'full');
        expect(sheet()!.className).toMatch(/fade-in/);
      });
    });
  });

  describe('セットの削除（「…」メニュー。確認ダイアログつき・電波があるときだけ）', () => {
    const recordOne = async (user: ReturnType<typeof userEvent.setup>) => {
      await ready();
      await user.click(doneButton());
      await user.click(await screen.findByTestId('result-sheet')); // シートを飛ばす
      await waitFor(() => expect(setCalls()).toHaveLength(1));
    };

    it('「…」→「削除」→確認で DELETE /api/records/{id}/sets/{setId} を送り、一覧から消える', async () => {
      const user = userEvent.setup();
      renderView();
      await recordOne(user);
      await user.click(screen.getByRole('button', { name: 'セット1の メニュー' }));
      await user.click(screen.getByRole('menuitem', { name: '削除' }));
      const dialog = screen.getByRole('alertdialog', { name: 'このセットを 消しますか？' });
      expect(dialog).toHaveTextContent('40kg × 10回');
      await user.click(within(dialog).getByRole('button', { name: '削除する' }));

      await waitFor(() => expect(calls.some((c) => c.method === 'DELETE')).toBe(true));
      const del = calls.find((c) => c.method === 'DELETE')!;
      expect(del.url).toBe(`/api/records/${setCalls()[0].url.split('/')[3]}/sets/${setCalls()[0].body!.id}`);
      await waitFor(() => expect(screen.queryByRole('list', { name: 'できたセット' })).not.toBeInTheDocument());
    });

    it('確認で「やめる」を選ぶと、何も送らず、セットも残る', async () => {
      const user = userEvent.setup();
      renderView();
      await recordOne(user);
      await user.click(screen.getByRole('button', { name: 'セット1の メニュー' }));
      await user.click(screen.getByRole('menuitem', { name: '削除' }));
      await user.click(within(screen.getByRole('alertdialog')).getByRole('button', { name: 'やめる' }));
      expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
      expect(calls.some((c) => c.method === 'DELETE')).toBe(false);
      expect(screen.getByRole('list', { name: 'できたセット' })).toBeInTheDocument();
    });

    it('電波が無いあいだは「削除」を押せず、理由を添える', async () => {
      const user = userEvent.setup();
      renderView();
      await recordOne(user);
      act(() => onlineManager.setOnline(false));
      await user.click(screen.getByRole('button', { name: 'セット1の メニュー' }));
      const item = screen.getByRole('menuitem', { name: /削除/ });
      expect(item).toBeDisabled();
      expect(screen.getByRole('menu')).toHaveTextContent('電波があるときだけ');
    });

    it('消して穴があいても、次のセット番号は重ならない（1・2のうち1を消すと次は3）', async () => {
      const user = userEvent.setup();
      renderView();
      await recordOne(user);
      await user.click(doneButton());
      await waitFor(() => expect(setCalls()).toHaveLength(2));
      await user.click(await screen.findByTestId('result-sheet'));
      await user.click(screen.getByRole('button', { name: 'セット1の メニュー' }));
      await user.click(screen.getByRole('menuitem', { name: '削除' }));
      await user.click(within(screen.getByRole('alertdialog')).getByRole('button', { name: '削除する' }));
      await waitFor(() => expect(within(screen.getByRole('list', { name: 'できたセット' })).getAllByRole('listitem')).toHaveLength(1));
      await user.click(doneButton());
      await waitFor(() => expect(setCalls()).toHaveLength(3));
      expect(setCalls()[2].body).toMatchObject({ setNo: 3 });
    });
  });

  describe('電波が無いとき（F-30。端末への保存・再送は lib/offline/offline-flow.test.tsx）', () => {
    it('電波があるときは、結果のシートに「この端末に保存したよ」を足さない', async () => {
      const user = userEvent.setup();
      renderView();
      await ready();
      await user.click(doneButton());
      expect(sheet()).toBeInTheDocument();
      expect(sheet()).not.toHaveTextContent('この端末に保存したよ');
    });

    it('押した瞬間に画面へ反映し、何も送らず待つ。戻ると 記録 → セット の順に送る', async () => {
      const user = userEvent.setup();
      renderView();
      await ready();
      act(() => onlineManager.setOnline(false));
      await user.click(doneButton());
      expect(screen.getByRole('list', { name: 'できたセット' })).toHaveTextContent('40kg × 10回');
      expect(sheet()).toBeInTheDocument();
      expect(sheet()).toHaveTextContent('この端末に保存したよ。電波が戻ったら送るね');
      expect(calls.filter((c) => c.method === 'POST')).toHaveLength(0);

      act(() => onlineManager.setOnline(true));
      await waitFor(() => expect(calls.filter((c) => c.method === 'POST')).toHaveLength(2));
      expect(calls.filter((c) => c.method === 'POST').map((c) => c.url.includes('/sets'))).toEqual([false, true]);
    });
  });

  describe('きのうの分（F-21 あとから記録。?day=yesterday）', () => {
    beforeEach(() => {
      // 日付だけ固定する（待ち時間のタイマーは本物のまま）。日本時間 11/13 09:00 → きのうは 11/12
      vi.useFakeTimers({ toFake: ['Date'] });
      vi.setSystemTime(new Date('2026-11-13T09:00:00+09:00'));
    });
    afterEach(() => vi.useRealTimers());

    it('最初の「できた」で、きのうの12:00（日本時間）の日時と late:true つきで記録を作る', async () => {
      search = 'exercise=e-bench&day=yesterday';
      renderView();
      await ready();
      await userEvent.click(doneButton());
      await waitFor(() => expect(setCalls()).toHaveLength(1));
      const create = calls.find((c) => c.method === 'POST' && c.url === '/api/records')!.body!;
      expect(create).toMatchObject({ kind: 'workout', recordedAt: '2026-11-12T03:00:00.000Z', late: true });
    });

    it('今日の記録には late を付けない（付け忘れ・付けすぎの両方を防ぐ）', async () => {
      renderView();
      await ready();
      await userEvent.click(doneButton());
      await waitFor(() => expect(setCalls()).toHaveLength(1));
      const create = calls.find((c) => c.method === 'POST' && c.url === '/api/records')!.body!;
      expect(create).not.toHaveProperty('late');
    });

    it('前回は「きのうの12:00より前」から探す（きのうの時点の前回。今日の記録を前回にしない）', async () => {
      search = 'exercise=e-bench&day=yesterday';
      renderView();
      await ready();
      const prev = calls.find((c) => c.url.startsWith('/api/exercises/e-bench/previous'))!;
      expect(new URL(prev.url, 'http://x').searchParams.get('before')).toBe('2026-11-12T03:00:00.000Z');
    });

    it('「きのうの分を記録しています」の帯を出す。今日のときは出さない', async () => {
      search = 'exercise=e-bench&day=yesterday';
      renderView();
      await ready();
      expect(screen.getByText('きのうの分を 記録しています')).toBeInTheDocument();
      cleanup();
      search = 'exercise=e-bench';
      renderView();
      await ready();
      expect(screen.queryByText('きのうの分を 記録しています')).not.toBeInTheDocument();
    });

    it('動画の入口は出さない（その日のうちの記録にだけ付けられる）', async () => {
      vi.stubGlobal('MediaRecorder', { isTypeSupported: (m: string) => m === 'video/mp4' });
      Object.defineProperty(navigator, 'mediaDevices', { configurable: true, value: { getUserMedia: vi.fn() } });
      search = 'exercise=e-bench&day=yesterday';
      renderView();
      await ready();
      await userEvent.click(doneButton());
      await waitFor(() => expect(setCalls()).toHaveLength(1));
      expect(screen.queryByRole('button', { name: '2秒動画を撮る' })).not.toBeInTheDocument();
    });
  });

  describe('2秒動画の入口（F-13）', () => {
    const stubCamera = () => {
      vi.stubGlobal('MediaRecorder', { isTypeSupported: (m: string) => m === 'video/mp4' });
      Object.defineProperty(navigator, 'mediaDevices', { configurable: true, value: { getUserMedia: vi.fn() } });
    };
    const entry = () => screen.queryByRole('button', { name: '2秒動画を撮る' });

    it('撮れる端末で、1セット できた後に出る。最初は出ない', async () => {
      stubCamera();
      renderView();
      await ready();
      expect(screen.queryByRole('button', { name: 'ほかの操作' })).not.toBeInTheDocument();
      await userEvent.click(doneButton());
      await openMore();
      expect(await screen.findByRole('button', { name: '2秒動画を撮る' })).toBeInTheDocument();
    });

    it('撮れない端末（MediaRecorder なし）では出さない', async () => {
      vi.stubGlobal('MediaRecorder', undefined);
      renderView();
      await ready();
      await userEvent.click(doneButton());
      await waitFor(() => expect(setCalls()).toHaveLength(1));
      await openMore();
      expect(entry()).not.toBeInTheDocument();
      expect(screen.getByRole('button', { name: '休憩する' })).toBeInTheDocument(); // 休憩は出る
    });

    it('電波がないときは出さない（署名付き URL をもらえないため）', async () => {
      stubCamera();
      renderView();
      await ready();
      await userEvent.click(doneButton());
      await openMore();
      await screen.findByRole('button', { name: '2秒動画を撮る' });
      act(() => onlineManager.setOnline(false));
      await waitFor(() => expect(entry()).not.toBeInTheDocument());
    });
  });

  // D3-7: 副ボタンは「次の種目へ」「今日はここまで」の2つ。休憩・2秒動画は「…」のシートへ
  describe('「…」のシート（D3-7）', () => {
    it('「できた」の下の副ボタンは2つ（次の種目へ・今日はここまで）と「…」だけ。休憩する・2秒動画は最初から並べない', async () => {
      vi.stubGlobal('MediaRecorder', { isTypeSupported: (m: string) => m === 'video/mp4' });
      Object.defineProperty(navigator, 'mediaDevices', { configurable: true, value: { getUserMedia: vi.fn() } });
      renderView();
      await ready();
      await userEvent.click(doneButton());
      await screen.findByRole('link', { name: '次の種目へ' });
      expect(screen.getByRole('link', { name: /今日はここまで/ })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'ほかの操作' })).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: '休憩する' })).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: '2秒動画を撮る' })).not.toBeInTheDocument();
    });

    it('「…」を開くと「休憩する」があり、押すと休憩の帯が出てシートは閉じる', async () => {
      const user = userEvent.setup();
      renderView();
      await ready();
      await user.click(doneButton());
      await user.click(await screen.findByRole('button', { name: '休憩をスキップ' })); // 「できた」で始まった休憩を閉じる
      await openMore();
      await user.click(screen.getByRole('button', { name: '休憩する' }));
      expect(screen.getByRole('region', { name: '休憩タイマー' })).toBeInTheDocument();
      expect(screen.queryByRole('dialog', { name: 'ほかの操作' })).not.toBeInTheDocument();
    });
  });

  // D3 L1: 記録画面にも送信待ちの帯（「N件 送ったよ」）を置く
  it('D3 L1 送れたあとに開いた記録画面にも「N件 送ったよ」を出す', async () => {
    advanceSent(2, true, 0);
    advanceSent(0, false, 0);
    renderView();
    await ready();
    expect(screen.getByTestId('sync-banner')).toHaveTextContent('2件 送ったよ');
  });

  describe('仲間のゴースト（F-16）', () => {
    it('同じグループの仲間のボタンが出る。記録の無い仲間はグレーで押せず「まだ記録なし」', async () => {
      renderView();
      await ready();
      await openFriends();
      const hanako = await screen.findByRole('button', { name: /はなこ/ });
      await waitFor(() => expect(screen.getByRole('button', { name: /たろう/ })).toBeDisabled());
      expect(screen.getByRole('button', { name: /たろう/ })).toHaveTextContent('まだ記録なし');
      expect(hanako).toBeEnabled();
      expect(screen.queryByRole('button', { name: /わたし/ })).not.toBeInTheDocument(); // 自分は出さない
    });

    it('仲間を選ぶと、バーに仲間のアイコンと数字（60kg×8）が出て、もう一度押すと消える', async () => {
      const user = userEvent.setup();
      renderView();
      await ready();
      expect(screen.queryByTestId('friend-marker-u2')).not.toBeInTheDocument();
      await openFriends();
      const hanako = await screen.findByRole('button', { name: /はなこ/ });
      await waitFor(() => expect(hanako).toBeEnabled());
      await user.click(hanako);
      expect(screen.getByTestId('friend-marker-u2')).toHaveTextContent('60kg×8');
      await user.click(hanako);
      expect(screen.queryByTestId('friend-marker-u2')).not.toBeInTheDocument();
    });

    it('仲間の前回は friendId つきで取りに行く（自分の前回の問い合わせには friendId を付けない）', async () => {
      renderView();
      await ready();
      await openFriends();
      await screen.findByRole('button', { name: /はなこ/ });
      const previousCalls = calls.filter((c) => /\/previous/.test(c.url));
      expect(previousCalls.some((c) => c.url.includes('friendId=u2'))).toBe(true);
      expect(previousCalls.some((c) => !c.url.includes('friendId='))).toBe(true);
    });
  });

  describe('メニューのコピー（F-24。「やる予定」で始める）', () => {
    const plan = () => setCopyPlan({ fromUserId: 'u2', fromName: 'はなこ', items: [{ exerciseId: 'e-bench', name: 'ベンチプレス', sets: [{ weightKg: 70, reps: 5 }] }] });

    it('やる予定の値が最初に入り、「はなこさんの メニューから」が出る。記録はまだ作られない', async () => {
      plan();
      search = 'exercise=e-bench&plan=1';
      renderView();
      await screen.findByRole('heading', { name: 'ベンチプレス' });
      expect(await screen.findByText('はなこさんの メニューから')).toBeInTheDocument();
      await waitFor(() => expect(weight()).toHaveValue(70));
      expect(reps()).toHaveValue(5);
      expect(calls.filter((c) => c.method === 'POST')).toHaveLength(0);
    });

    it('「できた」で初めて記録を作り、copiedFromUserId を付ける。2回目のセットでは付けない', async () => {
      plan();
      search = 'exercise=e-bench&plan=1';
      renderView();
      await screen.findByText('はなこさんの メニューから');
      await userEvent.click(doneButton());
      await waitFor(() => expect(setCalls()).toHaveLength(1));
      const creates = calls.filter((c) => c.method === 'POST' && c.url === '/api/records');
      expect(creates).toHaveLength(1);
      expect(creates[0].body).toMatchObject({ kind: 'workout', copiedFromUserId: 'u2' });
    });

    it('いつものメニューから始めたとき（F3）は「いつものメニュー「胸の日」から」が出て、記録に copiedFromUserId を付けない', async () => {
      setCopyPlan({ fromUserId: null, fromName: null, routineName: '胸の日', items: [{ exerciseId: 'e-bench', name: 'ベンチプレス', sets: [{ weightKg: 70, reps: 5 }] }] });
      search = 'exercise=e-bench&plan=1';
      renderView();
      expect(await screen.findByText('いつものメニュー「胸の日」から')).toBeInTheDocument();
      await waitFor(() => expect(weight()).toHaveValue(70));
      await userEvent.click(doneButton());
      await waitFor(() => expect(setCalls()).toHaveLength(1));
      const create = calls.find((c) => c.method === 'POST' && c.url === '/api/records');
      expect(create?.body).not.toHaveProperty('copiedFromUserId');
    });

    it('コピーでないとき（plan なし）は copiedFromUserId を付けない', async () => {
      renderView();
      await ready();
      await userEvent.click(doneButton());
      await waitFor(() => expect(setCalls()).toHaveLength(1));
      const create = calls.find((c) => c.method === 'POST' && c.url === '/api/records');
      expect(create?.body).not.toHaveProperty('copiedFromUserId');
    });
  });

  // E1: 重量は ±2.5kg ずつで、20→60kg は16回押す。±10kg を足す
  describe('重量を大きく動かす（E1）', () => {
    it('「10kg ふやす／へらす」で重量が10kg動く（0kg の下には行かない）', async () => {
      const user = userEvent.setup();
      renderView();
      await ready();
      expect(weight()).toHaveValue(40);
      await user.click(screen.getByRole('button', { name: '重量を 10kg ふやす' }));
      expect(weight()).toHaveValue(50);
      await user.click(screen.getByRole('button', { name: '重量を 10kg へらす' }));
      await user.click(screen.getByRole('button', { name: '重量を 10kg へらす' }));
      expect(weight()).toHaveValue(30);
      for (let i = 0; i < 4; i++) await user.click(screen.getByRole('button', { name: '重量を 10kg へらす' }));
      expect(weight()).toHaveValue(0);
    });

    it('回数のほうには、大きい動かし方は付けない（1回ずつ）', async () => {
      renderView();
      await ready();
      expect(screen.queryByRole('button', { name: /回数を 10回/ })).not.toBeInTheDocument();
    });
  });

  describe('重さの単位 lb（D6-5）', () => {
    beforeEach(() => localStorage.setItem('fitlog-prefs', JSON.stringify({ unit: 'lb' })));
    afterEach(() => localStorage.removeItem('fitlog-prefs'));

    it('lb のときは lb で出し、5lb ずつ動き、保存は kg（0.5 刻み）に直して送る', async () => {
      const user = userEvent.setup();
      renderView();
      await ready();
      const lb = () => screen.getByRole('spinbutton', { name: '重量（lb）' });
      expect(lb()).toHaveValue(88.2); // 40kg
      await user.click(screen.getByRole('button', { name: '重量を 5lb ふやす' }));
      expect(lb()).toHaveValue(90.4); // 90lb → 41kg（0.5kg 刻みに丸めた値を lb に戻した表示）
      await user.click(doneButton());
      await waitFor(() => expect(setCalls()).toHaveLength(1));
      expect(setCalls()[0].body).toMatchObject({ weightKg: 41, reps: 10 });
    });

    it('lb で数字を直接打つと、kg に直して持つ（135lb → 61kg）', async () => {
      const user = userEvent.setup();
      renderView();
      await ready();
      const input = screen.getByRole('spinbutton', { name: '重量（lb）' });
      await user.clear(input);
      await user.type(input, '135');
      await user.tab();
      await user.click(doneButton());
      await waitFor(() => expect(setCalls()).toHaveLength(1));
      expect(setCalls()[0].body).toMatchObject({ weightKg: 61 });
    });

    it('前回のバー・できたセットも lb で出す', async () => {
      const user = userEvent.setup();
      renderView();
      await ready();
      expect(screen.getByRole('group', { name: '前回との くらべ' })).toHaveTextContent('88.2lb');
      await user.click(doneButton());
      expect(await screen.findByRole('list', { name: 'できたセット' })).toHaveTextContent('88.2lb × 10回');
    });
  });

  // N3: 記録画面に「次の種目へ」が無く、×で閉じて種目を選び直す4手以上だった
  describe('次の種目へ（N3）', () => {
    const TODAY_JST = '2026-10-26'; // 固定した「今」（beforeEach で Date を止めた日）と同じ日
    const todayRec = {
      id: 'srv-rec',
      kind: 'workout',
      recordedAt: '2026-10-26T03:00:00.000Z',
      localDate: TODAY_JST,
      active: true,
      exercises: [{ exerciseId: 'e-bench', name: 'ベンチプレス', sets: [{ id: 's-1', setNo: 1, weightKg: 40, reps: 10 }] }],
    };
    const prevRec = {
      id: 'prev',
      kind: 'workout',
      recordedAt: '2026-10-01T03:00:00.000Z',
      localDate: '2026-10-01',
      exercises: [
        { exerciseId: 'e-bench', name: 'ベンチプレス', sets: [{ id: 'p-1', setNo: 1, weightKg: 40, reps: 10 }] },
        { exerciseId: 'e-mine', name: 'ケトルベルスイング', sets: [{ id: 'p-2', setNo: 1, weightKg: 16, reps: 15 }] },
      ],
    };
    beforeEach(() => {
      handlers['GET /api/records'] = () => ({ status: 200, body: { items: [todayRec, prevRec], nextCursor: null } });
      handlers['GET /api/records/:id'] = () => ({ status: 200, body: todayRec });
    });

    it('1セット以上できたら、まだの種目（今日のメニューの次）へのリンクを出す', async () => {
      renderView();
      await ready();
      const link = await screen.findByRole('link', { name: '次の種目へ' });
      expect(link).toHaveAttribute('href', '/record?exercise=e-mine');
    });

    it('まだの種目がなければ、種目の一覧へ（きのうの分は day を引き継ぐ）', async () => {
      handlers['GET /api/records'] = () => ({ status: 200, body: { items: [todayRec], nextCursor: null } });
      renderView();
      await ready();
      expect(await screen.findByRole('link', { name: '次の種目へ' })).toHaveAttribute('href', '/exercises');
    });

    it('まだ1セットもできていないあいだは出さない', async () => {
      handlers['GET /api/records'] = () => ({ status: 200, body: { items: [], nextCursor: null } });
      renderView();
      await ready();
      expect(screen.queryByRole('link', { name: '次の種目へ' })).not.toBeInTheDocument();
    });
  });

  // N2: ページを読み直すとメモリの「いまの記録」は消える。サーバーが「記録中」と返した記録を続きにする
  describe('読み直したあとも、同じ記録に足す（N2）', () => {
    const TODAY_JST = '2026-10-26'; // 固定した「今」（beforeEach で Date を止めた日）と同じ日
    const serverActive = {
      id: 'srv-rec',
      kind: 'workout',
      recordedAt: '2026-10-26T03:00:00.000Z',
      localDate: TODAY_JST,
      active: true,
      exercises: [{ exerciseId: 'e-bench', name: 'ベンチプレス', sets: [{ id: 's-1', setNo: 1, weightKg: 40, reps: 10 }] }],
    };

    beforeEach(() => {
      handlers['GET /api/records'] = () => ({ status: 200, body: { items: [serverActive], nextCursor: null } });
      handlers['GET /api/records/:id'] = () => ({ status: 200, body: serverActive });
    });

    it('サーバーの記録中の記録のセットを出し、次は2セット目になる', async () => {
      renderView();
      await ready();
      expect(await screen.findByText('いま 2セット目')).toBeInTheDocument();
      expect(screen.getByRole('list', { name: /できたセット/ })).toBeInTheDocument();
    });

    it('D3 L12 続きの記録を開いたときは「続きから（1セット済み）」と言い、始めたばかりの「できた」と分ける。足すと「いま1セット できた」が付く', async () => {
      const user = userEvent.setup();
      renderView();
      await ready();
      await screen.findByText('いま 2セット目');
      expect(screen.getByTestId('set-progress')).toHaveTextContent('続きから（1セット済み）');
      expect(screen.getByTestId('set-progress')).not.toHaveTextContent('1セット できた');
      await user.click(doneButton());
      await waitFor(() => expect(screen.getByTestId('set-progress')).toHaveTextContent('続きから（1セット済み）・いま1セット できた'));
    });

    it('「できた」は、新しい記録を作らず、その記録にセットを足す', async () => {
      const user = userEvent.setup();
      renderView();
      await ready();
      await screen.findByText('いま 2セット目');
      await user.click(doneButton());
      await waitFor(() => expect(setCalls()).toHaveLength(1));
      expect(setCalls()[0].url).toBe('/api/records/srv-rec/sets');
      expect(calls.filter((c) => c.method === 'POST' && c.url === '/api/records')).toHaveLength(0);
    });

    it('サーバーが「記録中」でない（終えた）なら、新しい記録を作る', async () => {
      handlers['GET /api/records'] = () => ({ status: 200, body: { items: [{ ...serverActive, active: false }], nextCursor: null } });
      const user = userEvent.setup();
      renderView();
      await ready();
      await user.click(doneButton());
      await waitFor(() => expect(calls.filter((c) => c.method === 'POST' && c.url === '/api/records')).toHaveLength(1));
    });

    it('きのうの分では、サーバーの記録中を使わない（今日の記録に混ざらない）', async () => {
      search = 'exercise=e-bench&day=yesterday';
      const user = userEvent.setup();
      renderView();
      await ready();
      await user.click(doneButton());
      await waitFor(() => expect(calls.filter((c) => c.method === 'POST' && c.url === '/api/records')).toHaveLength(1));
    });
  });

  // N1: 終了のまとめに「自己ベスト◯回」を出すため、自己ベストが出た回数を記録ごとに数える
  it('自己ベストが出たセットを、記録ごとに数える（終了のまとめ用）', async () => {
    setReply = echoSet('up', true);
    const user = userEvent.setup();
    renderView();
    await ready();
    await user.click(doneButton());
    await waitFor(() => expect(setCalls()).toHaveLength(1));
    const rid = calls.find((c) => c.method === 'POST' && c.url === '/api/records')!.body!.id as string;
    await waitFor(() => expect(bestCountOf(rid)).toBe(1));
  });

  // B04（記録中の分かりやすさ）。台帳 ID を題に付ける
  describe('B04 記録中', () => {
    const TWO_SETS = {
      previous: {
        recordedAt: '2026-10-25T09:12:00.000Z',
        sets: [
          { setNo: 1, weightKg: 40, reps: 10 },
          { setNo: 2, weightKg: 40, reps: 8 },
        ],
      },
      personalBest: { weightKg: 40, reps: 10, volume: 400 },
    };
    beforeEach(() => {
      handlers['GET /api/exercises/e-bench/previous'] = () => ({ status: 200, body: TWO_SETS });
    });

    it('A02-5・D3 L12 入力の初期値は前回の1セット目（40×10）。目標（同じ1セット目から 40×11）は横に出す。休み明けでなければ理由の1行は出さない', async () => {
      renderView();
      await ready();
      expect(weight()).toHaveValue(40);
      expect(reps()).toHaveValue(10);
      expect(screen.getByTestId('target-hint')).toHaveTextContent('目標 40kg × 11回');
      expect(screen.queryByTestId('rest-return-note')).not.toBeInTheDocument();
    });

    it('A02-5 前回から3日以上あいたら、目標は前回の同じセットと同じ値（40×10）にして、責めずに理由を1行出す', async () => {
      vi.setSystemTime(new Date('2026-10-30T03:00:00Z'));
      renderView();
      await ready();
      expect(screen.getByTestId('target-hint')).toHaveTextContent('目標 40kg × 10回');
      expect(screen.getByTestId('rest-return-note')).toHaveTextContent('しばらく あいたので');
    });

    it('A02-11 「仲間と くらべる」は最初は畳まれ、開くと仲間が出る', async () => {
      const user = userEvent.setup();
      renderView();
      await ready();
      const toggle = await screen.findByRole('button', { name: /仲間と くらべる/ });
      expect(toggle).toHaveAttribute('aria-expanded', 'false');
      expect(screen.queryByRole('button', { name: /はなこ/ })).not.toBeInTheDocument();
      await user.click(toggle);
      expect(toggle).toHaveAttribute('aria-expanded', 'true');
      expect(await screen.findByRole('button', { name: /はなこ/ })).toBeInTheDocument();
    });

    it('A03-1・A11-3 結果の板は画面の下に固定せず、「できた」の下に流す（入力欄を覆わない）', async () => {
      const user = userEvent.setup();
      renderView();
      await ready();
      await user.click(doneButton());
      const box = sheet()!;
      expect(box.closest('.fixed')).toBeNull();
      expect(doneButton().compareDocumentPosition(box) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    });

    it('A12-3 「できた」は画面下に固定せず、入力欄のあとに置く', async () => {
      renderView();
      await ready();
      expect(doneButton().closest('.sticky')).toBeNull();
      expect(reps().compareDocumentPosition(doneButton()) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    });

    it('A03-2 「できた」のあとに「今日はここまで」が出る（今日の画面へ）', async () => {
      const user = userEvent.setup();
      renderView();
      await ready();
      expect(screen.queryByRole('link', { name: /今日はここまで/ })).not.toBeInTheDocument();
      await user.click(doneButton());
      const stop = await screen.findByRole('link', { name: /今日はここまで/ });
      expect(stop).toHaveAttribute('href', '/today');
    });

    it('D3-6/7/10 前回の数字は1回だけ・できたセットは副ボタンより上・副ボタンは同じ形', async () => {
      const user = userEvent.setup();
      renderView();
      await ready();
      const bar = screen.getByRole('group', { name: '前回との くらべ' });
      expect((bar.textContent ?? '').split('40kg × 10回').length - 1).toBe(2); // 1行に「前回」と「今回」の2つだけ（見出しには出さない）
      await user.click(doneButton());
      const list = await screen.findByRole('list', { name: 'できたセット' });
      const next = await screen.findByRole('link', { name: '次の種目へ' });
      expect(list.compareDocumentPosition(next) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
      expect(next.className).toBe(screen.getByRole('link', { name: /今日はここまで/ }).className.replace('text-fg', 'text-brand'));
    });

    it('A03-3 バーに「前回」「今回」の文字と値、札は「お試し」でなく「目安」', async () => {
      handlers['GET /api/exercises/e-bench/previous'] = () => ({ status: 200, body: NO_PREVIOUS });
      renderView();
      await ready();
      const bar = screen.getByRole('group', { name: '前回との くらべ' });
      expect(within(bar).getByText('目安')).toBeInTheDocument();
      expect(within(bar).queryByText('お試し')).not.toBeInTheDocument();
      expect(bar).toHaveTextContent('目安 40kg × 10回 今回 40kg × 10回');
    });

    it('A03-4 前回を読み込み中は「できた」が押せず、理由を1行出す。進み具合は文字でも出す', async () => {
      handlers['GET /api/exercises/e-bench/previous'] = () => new Promise<Reply>(() => {});
      renderView();
      await screen.findByRole('heading', { name: 'ベンチプレス' });
      expect(doneButton()).toBeDisabled();
      expect(screen.getByText(/前回の記録を 読み込んでいます/)).toBeInTheDocument();
      expect(screen.getByTestId('set-progress')).toHaveTextContent('0セット できた');
    });

    it('A03-4 進み具合の文字は、できたセットに合わせて変わる', async () => {
      const user = userEvent.setup();
      renderView();
      await ready();
      expect(screen.getByTestId('set-progress')).toHaveTextContent('0セット できた（前回は2セット）');
      await user.click(doneButton());
      await waitFor(() => expect(screen.getByTestId('set-progress')).toHaveTextContent('1セット できた'));
    });

    it('A03-5 セットがあるとき ✕ を押すと「記録は残ります」と確認。「つづける」で戻り、「とじる」は今日の画面へ', async () => {
      const user = userEvent.setup();
      renderView();
      await ready();
      await user.click(doneButton());
      await user.click(await screen.findByRole('button', { name: 'とじる' }));
      const dialog = screen.getByRole('alertdialog');
      expect(dialog).toHaveTextContent('記録は 残ります');
      expect(within(dialog).getByRole('link', { name: 'とじる' })).toHaveAttribute('href', '/today');
      await user.click(within(dialog).getByRole('button', { name: 'つづける' }));
      expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
    });

    it('A03-5 まだ1セットも無いときは、確認なしで閉じる（リンク）', async () => {
      renderView();
      await ready();
      expect(screen.getByRole('link', { name: 'とじる' })).toHaveAttribute('href', '/today');
    });

    it('N-04 ✕・「今日はここまで」・確認の「とじる」は、きのうの分なら day=yesterday を引き継ぐ', async () => {
      search = 'exercise=e-bench&day=yesterday';
      const user = userEvent.setup();
      renderView();
      await ready();
      expect(screen.getByRole('link', { name: 'とじる' })).toHaveAttribute('href', '/today?day=yesterday');
      await user.click(doneButton());
      expect(await screen.findByRole('link', { name: /今日はここまで/ })).toHaveAttribute('href', '/today?day=yesterday');
      await user.click(screen.getByRole('button', { name: 'とじる' }));
      expect(within(screen.getByRole('alertdialog')).getByRole('link', { name: 'とじる' })).toHaveAttribute('href', '/today?day=yesterday');
    });

    it('A03-6 数字は直接打てると文字で伝える', async () => {
      renderView();
      await ready();
      expect(screen.getByText(/直接 入力できます/)).toBeInTheDocument();
    });

    it('A06-1・A06-2 動画の入口は「2秒動画を撮る」。専門語（ラストレップ）を使わず、最後の1回を2秒と言い換える', async () => {
      vi.stubGlobal('MediaRecorder', { isTypeSupported: (m: string) => m === 'video/mp4' });
      Object.defineProperty(navigator, 'mediaDevices', { configurable: true, value: { getUserMedia: vi.fn() } });
      const user = userEvent.setup();
      renderView();
      await ready();
      await user.click(doneButton());
      await openMore();
      expect(await screen.findByRole('button', { name: '2秒動画を撮る' })).toBeInTheDocument();
      expect(screen.getByText('最後の1回を 2秒だけ 動画に')).toBeInTheDocument();
      expect(screen.queryByText(/ラストレップ/)).not.toBeInTheDocument();
    });

    it('A12-5 いまのセット番号は1つだけ（「いま 2セット目」）', async () => {
      const user = userEvent.setup();
      renderView();
      await ready();
      await user.click(doneButton());
      await screen.findByText('いま 2セット目');
      expect(screen.getAllByText(/セット目/)).toHaveLength(1);
    });
  });

  // D3-11: 自重の種目は重量の欄を隠して回数だけ。「おもりをつける」で出せる。重さのある種目・じぶんの種目は今までどおり
  it('自重の種目は回数だけを見せ、「おもりをつける」で重量の欄が出る', async () => {
    search = 'exercise=e-pushup';
    const user = userEvent.setup();
    renderView();
    await screen.findByRole('heading', { name: '腕立て伏せ' });
    expect(reps()).toBeInTheDocument();
    expect(screen.queryByRole('spinbutton', { name: '重量（kg）' })).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'おもりをつける' }));
    expect(weight()).toBeInTheDocument();
  });

  it('重さのある種目には、おもりのボタンを出さない', async () => {
    renderView();
    await ready();
    expect(weight()).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'おもりをつける' })).not.toBeInTheDocument();
  });

  it('責める言葉（禁止語）を画面に出さない（T-DATE-13・T-GHOST-13）', async () => {
    const user = userEvent.setup();
    const { container } = renderView();
    await ready();
    await user.click(screen.getByRole('button', { name: '回数を 1回 へらす' }));
    await user.click(doneButton()); // 下回りのシート
    for (const word of FORBIDDEN_WORDS) expect(container.textContent).not.toContain(word);
    await user.click(screen.getByRole('button', { name: 'セット1の メニュー' }));
    await user.click(screen.getByRole('menuitem', { name: '削除' }));
    for (const word of FORBIDDEN_WORDS) expect(container.textContent).not.toContain(word);
  });
});
