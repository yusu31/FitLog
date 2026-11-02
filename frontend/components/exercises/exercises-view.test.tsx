import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { FORBIDDEN_WORDS } from '@/lib/forbidden-words';
import { ExercisesView } from './exercises-view';

vi.mock('next/navigation', () => ({ useRouter: () => ({ replace: vi.fn() }), usePathname: () => '/exercises/' }));
let session: { data: unknown; isPending: boolean } = { data: { user: { id: 'u1' } }, isPending: false };
vi.mock('@/lib/auth-client', () => ({ authClient: { useSession: () => session } }));

const EXERCISES = [
  { id: 'e-bench', name: 'ベンチプレス', bodyPart: 'chest', isCustom: false, trialWeightKg: 40, trialReps: 10 },
  { id: 'e-fly', name: 'ダンベルフライ', bodyPart: 'chest', isCustom: false, trialWeightKg: 10, trialReps: 12 },
  { id: 'e-row', name: 'ベントオーバーロウ', bodyPart: 'back', isCustom: false, trialWeightKg: 30, trialReps: 10 },
  { id: 'e-squat', name: 'スクワット', bodyPart: 'legs', isCustom: false, trialWeightKg: 40, trialReps: 10 },
  { id: 'e-mine', name: 'ケトルベルスイング', bodyPart: 'glutes', isCustom: true, trialWeightKg: null, trialReps: null },
];

type Reply = { status: number; body?: unknown };
let replies: Record<string, Reply[]> = {};
const calls: { method: string; url: string; body?: unknown }[] = [];

beforeEach(() => {
  replies = { 'GET /api/exercises': [{ status: 200, body: EXERCISES }] };
  calls.length = 0;
  session = { data: { user: { id: 'u1' } }, isPending: false };
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string, init?: RequestInit) => {
      const method = init?.method ?? 'GET';
      calls.push({ method, url, body: init?.body ? JSON.parse(String(init.body)) : undefined });
      const queue = replies[`${method} ${url}`];
      if (!queue?.length) throw new Error(`想定外の呼び出し: ${method} ${url}`);
      const { status, body } = queue.length > 1 ? queue.shift()! : queue[0];
      return new Response(JSON.stringify(body ?? {}), { status, headers: { 'Content-Type': 'application/json' } });
    }),
  );
});
afterEach(() => vi.unstubAllGlobals());

const renderView = () => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <ExercisesView />
    </QueryClientProvider>,
  );
};

describe('ExercisesView（S-11 種目を選ぶ）', () => {
  it('部位ごとに見出しをつけて種目を並べ、押すと記録画面へ移るリンクになる', async () => {
    renderView();
    const bench = await screen.findByRole('link', { name: /ベンチプレス/ });
    expect(bench).toHaveAttribute('href', '/record?exercise=e-bench');
    expect(screen.getByRole('heading', { name: '胸' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: '背中' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'お尻' })).toBeInTheDocument();
    // 使っていない部位の見出しは出さない
    expect(screen.queryByRole('heading', { name: '腕' })).not.toBeInTheDocument();
  });

  it('自分で追加した種目には「じぶんの」の印が付く', async () => {
    renderView();
    const mine = await screen.findByRole('link', { name: /ケトルベルスイング/ });
    expect(within(mine).getByText('じぶんの')).toBeInTheDocument();
    expect(within(screen.getByRole('link', { name: /ベンチプレス/ })).queryByText('じぶんの')).not.toBeInTheDocument();
  });

  it('読み込み中は骨組みを出す', () => {
    renderView();
    expect(screen.getByLabelText('読み込み中')).toBeInTheDocument();
  });

  it('読み込めなかったときは、責めない文言で知らせる', async () => {
    replies['GET /api/exercises'] = [{ status: 500, body: {} }];
    renderView();
    expect(await screen.findByRole('alert')).toHaveTextContent('読み込めませんでした');
  });

  describe('検索', () => {
    it('名前の一部で絞る（前後の空白・大文字小文字は気にしない）', async () => {
      const user = userEvent.setup();
      renderView();
      await screen.findByRole('link', { name: /ベンチプレス/ });
      await user.type(screen.getByRole('searchbox', { name: '種目を さがす' }), '  プレス ');
      expect(screen.getByRole('link', { name: /ベンチプレス/ })).toBeInTheDocument();
      expect(screen.queryByRole('link', { name: /スクワット/ })).not.toBeInTheDocument();
      // 種目が残らなくなった部位の見出しも消える
      expect(screen.queryByRole('heading', { name: '脚' })).not.toBeInTheDocument();
    });

    it('見つからないときは、追加できることを案内し、検索した語を名前に入れた追加フォームを開ける', async () => {
      const user = userEvent.setup();
      renderView();
      await screen.findByRole('link', { name: /ベンチプレス/ });
      await user.type(screen.getByRole('searchbox', { name: '種目を さがす' }), 'ヒップスラスト');
      expect(screen.getByText(/見つかりませんでした/)).toBeInTheDocument();
      await user.click(screen.getByRole('button', { name: '「ヒップスラスト」を 追加する' }));
      expect(screen.getByRole('textbox', { name: '種目の名前' })).toHaveValue('ヒップスラスト');
    });
  });

  describe('種目を追加', () => {
    const open = async (user: ReturnType<typeof userEvent.setup>) => {
      await screen.findByRole('link', { name: /ベンチプレス/ });
      await user.click(screen.getByRole('button', { name: '種目を追加' }));
    };

    it('名前と部位を選んで追加すると POST /api/exercises を送り、一覧に出る', async () => {
      replies['POST /api/exercises'] = [
        { status: 201, body: { id: 'e-new', name: 'ヒップスラスト', bodyPart: 'glutes', isCustom: true, trialWeightKg: null, trialReps: null } },
      ];
      replies['GET /api/exercises'] = [
        { status: 200, body: EXERCISES },
        { status: 200, body: [...EXERCISES, { id: 'e-new', name: 'ヒップスラスト', bodyPart: 'glutes', isCustom: true, trialWeightKg: null, trialReps: null }] },
      ];
      const user = userEvent.setup();
      renderView();
      await open(user);
      await user.type(screen.getByRole('textbox', { name: '種目の名前' }), '  ヒップスラスト ');
      await user.click(screen.getByRole('button', { name: 'お尻' }));
      await user.click(screen.getByRole('button', { name: '追加する' }));

      await waitFor(() => expect(screen.getByRole('link', { name: /ヒップスラスト/ })).toBeInTheDocument());
      // 前後の空白は API が取り除くが、画面でも整えて送る
      expect(calls.find((c) => c.method === 'POST')?.body).toEqual({ name: 'ヒップスラスト', bodyPart: 'glutes' });
      expect(screen.getByRole('status')).toHaveTextContent('「ヒップスラスト」を 追加したよ');
    });

    it('名前が空、または部位が未選択のあいだは「追加する」を押せない', async () => {
      const user = userEvent.setup();
      renderView();
      await open(user);
      const submit = screen.getByRole('button', { name: '追加する' });
      expect(submit).toBeDisabled();
      await user.type(screen.getByRole('textbox', { name: '種目の名前' }), 'ヒップスラスト');
      expect(submit).toBeDisabled(); // 部位がまだ
      await user.click(screen.getByRole('button', { name: 'お尻' }));
      expect(submit).toBeEnabled();
      await user.clear(screen.getByRole('textbox', { name: '種目の名前' }));
      expect(submit).toBeDisabled();
    });

    it('部位のボタンは、選んでいる1つだけが押された状態（aria-pressed）になる', async () => {
      const user = userEvent.setup();
      renderView();
      await open(user);
      await user.click(screen.getByRole('button', { name: '胸' }));
      await user.click(screen.getByRole('button', { name: '脚' }));
      expect(screen.getByRole('button', { name: '脚' })).toHaveAttribute('aria-pressed', 'true');
      expect(screen.getByRole('button', { name: '胸' })).toHaveAttribute('aria-pressed', 'false');
    });

    it('名前は30字まで（入力欄の上限）', async () => {
      const user = userEvent.setup();
      renderView();
      await open(user);
      expect(screen.getByRole('textbox', { name: '種目の名前' })).toHaveAttribute('maxlength', '30');
    });

    it('同じ名前（409）のときは、API の文言をそのまま見せる', async () => {
      replies['POST /api/exercises'] = [{ status: 409, body: { code: 'EXERCISE_NAME_TAKEN', message: '同じ名前の種目が もうあります' } }];
      const user = userEvent.setup();
      renderView();
      await open(user);
      await user.type(screen.getByRole('textbox', { name: '種目の名前' }), 'ベンチプレス');
      await user.click(screen.getByRole('button', { name: '胸' }));
      await user.click(screen.getByRole('button', { name: '追加する' }));
      expect(await screen.findByRole('alert')).toHaveTextContent('同じ名前の種目が もうあります');
    });
  });

  it('責める言葉（禁止語）を画面に出さない（T-DATE-13）', async () => {
    const user = userEvent.setup();
    const { container } = renderView();
    await screen.findByRole('link', { name: /ベンチプレス/ });
    await user.click(screen.getByRole('button', { name: '種目を追加' }));
    for (const word of FORBIDDEN_WORDS) expect(container.textContent).not.toContain(word);
  });
});
