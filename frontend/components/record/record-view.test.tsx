import { onlineManager, QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { resetCurrentWorkout } from '@/lib/current-workout';
import { FORBIDDEN_WORDS } from '@/lib/forbidden-words';
import { GHOST_MESSAGES } from '@/lib/messages';
import { RecordView } from './record-view';

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
];
const PREVIOUS = {
  previous: {
    recordedAt: '2026-10-25T09:12:00.000Z',
    sets: [
      { setNo: 1, weightKg: 40, reps: 10 },
      { setNo: 2, weightKg: 40, reps: 10 },
      { setNo: 3, weightKg: 40, reps: 8 },
    ],
  },
  personalBest: { weightKg: 40, reps: 10, volume: 400 },
};
const NO_PREVIOUS = { previous: null, personalBest: null };

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
  search = 'exercise=e-bench';
  calls = [];
  resetCurrentWorkout();
  setReply = echoSet('same');
  handlers = {
    'GET /api/exercises': () => ({ status: 200, body: EXERCISES }),
    'GET /api/exercises/e-bench/previous': () => ({ status: 200, body: PREVIOUS }),
    'GET /api/exercises/e-mine/previous': () => ({ status: 200, body: NO_PREVIOUS }),
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
      const key = path.replace(/^\/api\/records\/[^/]+\/sets\/[^/]+$/, '/api/records/:id/sets/:setId').replace(/^\/api\/records\/[^/]+\/sets$/, '/api/records/:id/sets');
      const handler = handlers[`${method} ${key}`];
      if (!handler) throw new Error(`想定外の呼び出し: ${method} ${url}`);
      const { status, body } = await handler(call);
      return new Response(status === 204 ? null : JSON.stringify(body ?? {}), { status, headers: { 'Content-Type': 'application/json' } });
    }),
  );
});

afterEach(() => {
  onlineManager.setOnline(true);
  vi.unstubAllGlobals();
});

const renderView = () => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
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
  await screen.findByText('前回のじぶん');
};
const sheet = () => screen.queryByTestId('result-sheet');
const setCalls = () => calls.filter((c) => c.method === 'POST' && /\/sets$/.test(c.url));

describe('RecordView（S-12 記録・筋トレ）', () => {
  describe('最初に入る値と前回のバー（features.md 2.3・2.5）', () => {
    it('種目名と、前回の同じセット番号（1セット目）の重量・回数が最初から入っている', async () => {
      renderView();
      await ready();
      expect(weight()).toHaveValue(40);
      expect(reps()).toHaveValue(10);
      expect(screen.getByText('1 セット目')).toBeInTheDocument();
    });

    it('前回のバーに「前回のじぶん 40kg × 10回」と、前回・今回の2本を出す', async () => {
      renderView();
      await ready();
      const bar = screen.getByRole('group', { name: '前回との くらべ' });
      expect(bar).toHaveTextContent('40kg × 10回');
      expect(within(bar).getByText('前回')).toBeInTheDocument();
      expect(within(bar).getByText('今回')).toBeInTheDocument();
    });

    it('GET /api/exercises/{id}/previous に、画面を開いた時刻を before として渡す（今の記録を前回にしない）', async () => {
      renderView();
      await ready();
      const prev = calls.find((c) => c.url.startsWith('/api/exercises/e-bench/previous'));
      const before = new URL(prev!.url, 'http://x').searchParams.get('before');
      expect(Number.isNaN(Date.parse(before ?? ''))).toBe(false);
    });

    it('前回が無ければ、種目のお試し値が入り、「お試し」の札が付く', async () => {
      handlers['GET /api/exercises/e-bench/previous'] = () => ({ status: 200, body: NO_PREVIOUS });
      renderView();
      await ready();
      expect(weight()).toHaveValue(40);
      expect(reps()).toHaveValue(10);
      expect(within(screen.getByRole('group', { name: '前回との くらべ' })).getByText('お試し')).toBeInTheDocument();
    });

    it('前回もお試しも無い種目は、0kg × 10回から。比べる相手が無いと伝える', async () => {
      search = 'exercise=e-mine';
      renderView();
      await screen.findByRole('heading', { name: 'ケトルベルスイング' });
      await screen.findByText('前回の記録は まだないよ');
      expect(weight()).toHaveValue(0);
      expect(reps()).toHaveValue(10);
    });

    it('前回が3セットのとき、4セット目には前回の最後のセットの値が入る', async () => {
      const user = userEvent.setup();
      renderView();
      await ready();
      for (let i = 0; i < 3; i++) await user.click(doneButton());
      await screen.findByText('4 セット目');
      expect(weight()).toHaveValue(40);
      expect(reps()).toHaveValue(8);
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

  describe('「できた」', () => {
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
      await screen.findByText('2 セット目');
      expect(reps()).toHaveValue(12); // 前回の2セット目は 10 回だが、直した 12 回を引き継ぐ
    });

    it('同じ値のままなら、2セット目は前回の2セット目の値のまま', async () => {
      const user = userEvent.setup();
      renderView();
      await ready();
      await user.click(doneButton());
      await screen.findByText('2 セット目');
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

  describe('結果シート（F-06。0.8秒・タップで飛ばせる）', () => {
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

    it('0.8秒たつと消える', async () => {
      const user = userEvent.setup();
      renderView();
      await ready();
      await user.click(doneButton());
      expect(sheet()).toBeInTheDocument();
      await waitFor(() => expect(sheet()).not.toBeInTheDocument(), { timeout: 2000 });
    });

    it('タップすると、0.8秒を待たずに消える', async () => {
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
        expect(sheet()!.className).toMatch(/slide-in-from-bottom/);
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

  describe('電波が無いとき（F-30 の形。端末への保存は 02-4）', () => {
    it('押した瞬間に画面へ反映し、何も送らず待つ。戻ると 記録 → セット の順に送る', async () => {
      const user = userEvent.setup();
      renderView();
      await ready();
      act(() => onlineManager.setOnline(false));
      await user.click(doneButton());
      expect(screen.getByRole('list', { name: 'できたセット' })).toHaveTextContent('40kg × 10回');
      expect(sheet()).toBeInTheDocument();
      expect(calls.filter((c) => c.method === 'POST')).toHaveLength(0);

      act(() => onlineManager.setOnline(true));
      await waitFor(() => expect(calls.filter((c) => c.method === 'POST')).toHaveLength(2));
      expect(calls.filter((c) => c.method === 'POST').map((c) => c.url.includes('/sets'))).toEqual([false, true]);
    });
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
