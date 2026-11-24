import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { FORBIDDEN_WORDS } from '@/lib/forbidden-words';
import { ExercisesView } from './exercises-view';

let search = '';
vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: vi.fn() }),
  usePathname: () => '/exercises/',
  useSearchParams: () => new URLSearchParams(search),
}));
let session: { data: unknown; isPending: boolean } = { data: { user: { id: 'u1' } }, isPending: false };
vi.mock('@/lib/auth-client', () => ({ authClient: { useSession: () => session } }));

const EXERCISES = [
  { id: 'e-bench', name: 'ベンチプレス', bodyPart: 'chest', isCustom: false, trialWeightKg: 40, trialReps: 10 },
  { id: 'e-fly', name: 'ダンベルフライ', bodyPart: 'chest', isCustom: false, trialWeightKg: 10, trialReps: 12 },
  { id: 'e-row', name: 'ベントオーバーロウ', bodyPart: 'back', isCustom: false, trialWeightKg: 30, trialReps: 10 },
  { id: 'e-squat', name: 'スクワット', bodyPart: 'legs', isCustom: false, trialWeightKg: 40, trialReps: 10 },
  { id: 'e-pushup', name: '腕立て伏せ', bodyPart: 'chest', isCustom: false, trialWeightKg: 0, trialReps: 10 },
  { id: 'e-mine', name: 'ケトルベルスイング', bodyPart: 'glutes', isCustom: true, trialWeightKg: null, trialReps: null },
];

type Reply = { status: number; body?: unknown };
let replies: Record<string, Reply[]> = {};
const calls: { method: string; url: string; body?: unknown }[] = [];

beforeEach(() => {
  search = '';
  replies = {
    'GET /api/exercises': [{ status: 200, body: EXERCISES }],
    'GET /api/records?kind=workout&limit=5': [{ status: 200, body: { items: [], nextCursor: null } }],
  };
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

  it('きのうの分（?day=yesterday）から来たときは、記録画面へのリンクにも day=yesterday を引き継ぐ（F-21）', async () => {
    search = 'day=yesterday';
    renderView();
    expect(await screen.findByRole('link', { name: /ベンチプレス/ })).toHaveAttribute('href', '/record?exercise=e-bench&day=yesterday');
    // 「とじる」も、きのうの今日の画面へ戻す（02-9 N7。日付が落ちると今日に戻ってしまう）
    expect(screen.getByRole('link', { name: 'とじる' })).toHaveAttribute('href', '/today?day=yesterday');
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

  // D3-2: 初心者が名前だけで分からない問題。一覧の種目（固定の ID）には一言説明が付き、じぶんの種目には付かない
  it('一覧の種目には一言説明が付き、じぶんの種目には付かない', async () => {
    replies['GET /api/exercises'] = [
      {
        status: 200,
        body: [
          { id: '00000000-0000-4000-8000-000000000001', name: 'ベンチプレス', bodyPart: 'chest', isCustom: false, trialWeightKg: 20, trialReps: 10 },
          { id: 'e-mine', name: 'ケトルベルスイング', bodyPart: 'glutes', isCustom: true, trialWeightKg: null, trialReps: null },
        ],
      },
    ];
    renderView();
    expect(await screen.findByText(/バーを胸から押し上げる/)).toBeInTheDocument();
    const mine = screen.getByRole('link', { name: /ケトルベルスイング/ });
    expect(mine).not.toHaveTextContent('押し上げる');
  });

  // D3-2（案2）: 一覧の種目は「写真」で開始・終了の2枚が開く。じぶんの種目には写真ボタンが無い
  it('写真ボタンで開始・終了の2枚が開閉し、じぶんの種目には無い', async () => {
    replies['GET /api/exercises'] = [
      {
        status: 200,
        body: [
          { id: '00000000-0000-4000-8000-000000000001', name: 'ベンチプレス', bodyPart: 'chest', isCustom: false, trialWeightKg: 20, trialReps: 10 },
          { id: 'e-mine', name: 'ケトルベルスイング', bodyPart: 'glutes', isCustom: true, trialWeightKg: null, trialReps: null },
        ],
      },
    ];
    renderView();
    const btn = await screen.findByRole('button', { name: 'ベンチプレスのやり方の写真を見る' });
    expect(screen.queryByRole('button', { name: /ケトルベルスイングのやり方/ })).not.toBeInTheDocument();
    expect(screen.queryByAltText(/開始の姿勢/)).not.toBeInTheDocument();
    await userEvent.click(btn);
    expect(screen.getByAltText('ベンチプレス 開始の姿勢')).toHaveAttribute('src', '/exercises/01-0.jpg');
    expect(screen.getByAltText('ベンチプレス 終了の姿勢')).toHaveAttribute('src', '/exercises/01-1.jpg');
    expect(btn).toHaveAttribute('aria-expanded', 'true');
    await userEvent.click(btn);
    expect(screen.queryByAltText(/開始の姿勢/)).not.toBeInTheDocument();
  });

  // D3-1: 体の図の部位を押すと、部位のチップと同じ絞り込みになる。もう一度押すと「すべて」に戻る
  it('体の図の部位を押すと絞り込まれ、もう一度押すと戻る', async () => {
    renderView();
    await screen.findByRole('link', { name: /ベンチプレス/ });
    const chest = document.querySelector('[data-testid="body-front"] [data-part="chest"]') as SVGElement;
    await userEvent.click(chest);
    expect(screen.getByRole('button', { name: '胸で絞る' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.queryByRole('link', { name: /スクワット/ })).not.toBeInTheDocument();
    await userEvent.click(chest);
    expect(screen.getByRole('button', { name: 'すべて' })).toHaveAttribute('aria-pressed', 'true');
    expect((await screen.findAllByRole('link', { name: /スクワット/ })).length).toBeGreaterThan(0);
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

  // E3: 30種目を部位順にスクロールしなくてよいように、部位で絞れる
  describe('部位で絞る（E3）', () => {
    it('「すべて」と部位のボタンがあり、選んでいる1つだけが押された状態になる。初めは「すべて」', async () => {
      renderView();
      await screen.findByRole('link', { name: /ベンチプレス/ });
      const group = screen.getByRole('group', { name: '部位で絞る' });
      expect(within(group).getByRole('button', { name: 'すべて' })).toHaveAttribute('aria-pressed', 'true');
      expect(within(group).getByRole('button', { name: '胸で絞る' })).toHaveAttribute('aria-pressed', 'false');
    });

    it('部位を選ぶと、その部位の種目だけになる。「すべて」で戻る', async () => {
      const user = userEvent.setup();
      renderView();
      await screen.findByRole('link', { name: /ベンチプレス/ });
      const group = screen.getByRole('group', { name: '部位で絞る' });
      await user.click(within(group).getByRole('button', { name: '背中で絞る' }));
      expect(screen.getByRole('link', { name: /ベントオーバーロウ/ })).toBeInTheDocument();
      expect(screen.queryByRole('link', { name: /ベンチプレス/ })).not.toBeInTheDocument();
      expect(within(group).getByRole('button', { name: '背中で絞る' })).toHaveAttribute('aria-pressed', 'true');
      await user.click(within(group).getByRole('button', { name: 'すべて' }));
      expect(screen.getByRole('link', { name: /ベンチプレス/ })).toBeInTheDocument();
    });

    it('検索と組み合わせられる（部位 AND 名前）', async () => {
      const user = userEvent.setup();
      renderView();
      await screen.findByRole('link', { name: /ベンチプレス/ });
      await user.click(within(screen.getByRole('group', { name: '部位で絞る' })).getByRole('button', { name: '胸で絞る' }));
      await user.type(screen.getByRole('searchbox', { name: '種目を さがす' }), 'フライ');
      expect(screen.getByRole('link', { name: /ダンベルフライ/ })).toBeInTheDocument();
      expect(screen.queryByRole('link', { name: /ベンチプレス/ })).not.toBeInTheDocument();
    });
  });

  // E2: 最近やった種目を、一覧の先頭に出す（記録の一覧は今日の画面と同じ条件で、キャッシュを共有する）
  describe('最近やった種目（E2）', () => {
    const recent = [
      { id: 'r2', kind: 'workout', recordedAt: '2026-11-04T03:00:00.000Z', localDate: '2026-11-04', exercises: [{ exerciseId: 'e-squat', name: 'スクワット', sets: [{ id: 's', setNo: 1, weightKg: 40, reps: 10 }] }] },
      { id: 'r1', kind: 'workout', recordedAt: '2026-11-02T03:00:00.000Z', localDate: '2026-11-02', exercises: [
        { exerciseId: 'e-bench', name: 'ベンチプレス', sets: [{ id: 's2', setNo: 1, weightKg: 40, reps: 10 }] },
        { exerciseId: 'e-squat', name: 'スクワット', sets: [{ id: 's3', setNo: 1, weightKg: 40, reps: 10 }] },
      ] },
    ];

    it('新しい順・重複なしで「最近やった種目」に並べる（スクワット → ベンチプレス）', async () => {
      replies['GET /api/records?kind=workout&limit=5'] = [{ status: 200, body: { items: recent, nextCursor: null } }];
      renderView();
      const section = await screen.findByRole('region', { name: '最近やった種目' });
      const links = within(section).getAllByRole('link');
      expect(links.map((l) => l.textContent)).toEqual([expect.stringContaining('スクワット'), expect.stringContaining('ベンチプレス')]);
      expect(links[0]).toHaveAttribute('href', '/record?exercise=e-squat');
    });

    it('記録が無いときは出さない', async () => {
      renderView();
      await screen.findByRole('link', { name: /ベンチプレス/ });
      expect(screen.queryByRole('region', { name: '最近やった種目' })).not.toBeInTheDocument();
    });

    it('検索中・部位で絞っている間は出さない（探している種目の邪魔にならない）', async () => {
      replies['GET /api/records?kind=workout&limit=5'] = [{ status: 200, body: { items: recent, nextCursor: null } }];
      const user = userEvent.setup();
      renderView();
      await screen.findByRole('region', { name: '最近やった種目' });
      await user.click(within(screen.getByRole('group', { name: '部位で絞る' })).getByRole('button', { name: '胸で絞る' }));
      expect(screen.queryByRole('region', { name: '最近やった種目' })).not.toBeInTheDocument();
    });
  });

  // A01-9: 長い一覧から初心者が選びにくい → 先頭に数種目を固定。部位のボタンは横に流さず折り返して見切れを防ぐ
  describe('はじめての人向け（A01-9）', () => {
    it('先頭に「はじめての人向け」を出し、決めた順（腕立て伏せ → スクワット）で、一覧にある種目だけ並べる', async () => {
      renderView();
      const section = await screen.findByRole('region', { name: 'はじめての人向け' });
      const links = within(section).getAllByRole('link');
      expect(links.map((l) => l.textContent)).toEqual([expect.stringContaining('腕立て伏せ'), expect.stringContaining('スクワット')]);
      expect(links[0]).toHaveAttribute('href', '/record?exercise=e-pushup');
    });

    it('検索中・部位で絞っている間は出さない', async () => {
      const user = userEvent.setup();
      renderView();
      await screen.findByRole('region', { name: 'はじめての人向け' });
      await user.click(within(screen.getByRole('group', { name: '部位で絞る' })).getByRole('button', { name: '背中で絞る' }));
      expect(screen.queryByRole('region', { name: 'はじめての人向け' })).not.toBeInTheDocument();
    });

    it('部位のボタンは折り返して並べる（横に流して見切れさせない）', async () => {
      renderView();
      await screen.findByRole('link', { name: /ベンチプレス/ });
      expect(screen.getByRole('group', { name: '部位で絞る' }).className).toContain('flex-wrap');
    });
  });

  // A01-10: 下に固定の「種目を追加」が最後の行に重ならないよう、一覧の末尾に固定ボタンの高さ分の余白を取る
  it('一覧の末尾に、固定ボタンの高さ分の余白がある（A01-10）', async () => {
    renderView();
    await screen.findByRole('link', { name: /ベンチプレス/ });
    expect(screen.getByTestId('footer-spacer')).toHaveClass('h-24');
  });

  // A01-11: 「40kg ×10」は自分の記録ではない → 「目安」の札を付け、記録がまだ無い人には数字を出さない
  describe('お試しの値は目安（A01-11）', () => {
    const done = [
      { id: 'r1', kind: 'workout', recordedAt: '2026-11-02T03:00:00.000Z', localDate: '2026-11-02', exercises: [{ exerciseId: 'e-bench', name: 'ベンチプレス', sets: [{ id: 's', setNo: 1, weightKg: 40, reps: 10 }] }] },
    ];

    it('記録がまだ無いときは、お試しの数字を出さない', async () => {
      renderView();
      const bench = await screen.findByRole('link', { name: /ベンチプレス/ });
      expect(bench).not.toHaveTextContent('40');
      expect(screen.queryByText('目安')).not.toBeInTheDocument();
    });

    it('記録があるときは、数字に「目安」の札を付ける。自分で追加した種目には出さない', async () => {
      replies['GET /api/records?kind=workout&limit=5'] = [{ status: 200, body: { items: done, nextCursor: null } }];
      renderView();
      const bench = await screen.findAllByRole('link', { name: /ベンチプレス/ });
      await waitFor(() => expect(within(bench[0]).getByText('目安')).toBeInTheDocument());
      expect(within(bench[0]).getByText(/40/)).toBeInTheDocument();
      expect(within(screen.getByRole('link', { name: /ケトルベルスイング/ })).queryByText('目安')).not.toBeInTheDocument();
    });

    // D3 L5: 0kg は「0kg × 10」と出さず「自重 × 10」
    it('目安の重さが 0kg の種目（腕立て伏せ）は「自重 × 10」と出す（0kg と出さない）', async () => {
      replies['GET /api/records?kind=workout&limit=5'] = [{ status: 200, body: { items: done, nextCursor: null } }];
      renderView();
      const pushup = await screen.findAllByRole('link', { name: /腕立て伏せ/ });
      await waitFor(() => expect(within(pushup[pushup.length - 1]).getByText('目安')).toBeInTheDocument());
      const row = pushup[pushup.length - 1];
      expect(row).toHaveTextContent('自重×10');
      expect(row).not.toHaveTextContent('0kg');
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
