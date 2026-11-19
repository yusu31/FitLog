import { QueryClient, QueryClientProvider, onlineManager } from '@tanstack/react-query';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { FORBIDDEN_WORDS } from '@/lib/forbidden-words';
import { toLocalDate } from '@/lib/shared/local-date';
import { FeedSection } from './feed-section';

vi.mock('@/lib/auth-client', () => ({
  authClient: { useSession: () => ({ data: { user: { id: 'u1', name: 'わたし' } }, isPending: false }) },
}));

const AVATAR = { body: 'A', hair: 1, hairColor: 'brown', shirtColor: 'teal', pantsColor: 'navy' };
const HANAKO = { id: 'u2', name: 'はなこ', avatar: { ...AVATAR, shirtColor: 'coral' } };

const item = (over: Record<string, unknown>) => ({
  id: 'r1',
  kind: 'workout',
  recordedAt: '2026-11-02T10:10:00.000Z',
  localDate: toLocalDate(new Date()),
  author: HANAKO,
  exerciseNames: ['スクワット', 'ベンチプレス'],
  stamps: [],
  commentCount: 0,
  ...over,
});
const feed = (over: Record<string, unknown> = {}) => ({
  weekStart: '2026-11-02',
  items: [item({})],
  nextCursor: null,
  totals: { recordedUserCount: 4, totalVolumeKg: 12400, totalDistanceM: 18000 },
  ...over,
});

// 呼ばれた方法・パスで応答を返す偽物の fetch。パスの比べ方は「メソッド＋パス（? の前）」
type Reply = { status: number; body?: unknown };
let replies: Record<string, Reply[]> = {};
const calls: { method: string; url: string; body?: unknown }[] = [];

// 足跡を開くと「見た」（POST /feed/seen。F4）が必ず1回飛ぶ。ほかのテストではそれを除いて数える
const feedGets = () => calls.filter((c) => c.method === 'GET' && c.url.startsWith('/api/feed?'));
const sentPosts = () => calls.filter((c) => c.method === 'POST' && c.url !== '/api/feed/seen');

beforeEach(() => {
  replies = { 'POST /api/feed/seen': [{ status: 204 }] };
  calls.length = 0;
  onlineManager.setOnline(true);
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string, init?: RequestInit) => {
      const method = init?.method ?? 'GET';
      calls.push({ method, url, body: init?.body ? JSON.parse(String(init.body)) : undefined });
      const queue = replies[`${method} ${url.split('?')[0]}`];
      if (!queue?.length) throw new Error(`想定外の呼び出し: ${method} ${url}`);
      const { status, body } = queue.length > 1 ? queue.shift()! : queue[0];
      return new Response(status === 204 ? null : JSON.stringify(body ?? {}), { status, headers: { 'Content-Type': 'application/json' } });
    }),
  );
});

afterEach(() => {
  vi.unstubAllGlobals();
  onlineManager.setOnline(true);
});

const renderFeed = () => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <FeedSection />
    </QueryClientProvider>,
  );
};

describe('FeedSection（S-20 の足跡・週の合計）', () => {
  it('今週（日本時間の今日を含む週）の足跡を取り、合計と足跡を出す', async () => {
    replies['GET /api/feed'] = [{ status: 200, body: feed() }];
    renderFeed();
    expect(await screen.findByText('4人が記録')).toBeInTheDocument();
    expect(screen.getByText('12,400kg')).toBeInTheDocument();
    expect(screen.getByText('18.0km')).toBeInTheDocument();
    expect(screen.getByText('はなこ')).toBeInTheDocument();
    expect(screen.getByText('スクワット')).toBeInTheDocument();
    expect(screen.getByText('ほか1種目')).toBeInTheDocument();
    expect(calls[0].url).toContain(`weekStart=${toLocalDate(new Date())}`);
  });

  it('あとから記録（late）の足跡は、時刻を出さず「あとから記録」の札を出す。ふつうの足跡は時刻を出す（F-21）', async () => {
    replies['GET /api/feed'] = [
      {
        status: 200,
        body: feed({ items: [item({ id: 'r1', late: true }), item({ id: 'r2', recordedAt: '2026-11-02T10:10:00.000Z' })] }),
      },
    ];
    renderFeed();
    await screen.findByText('4人が記録');
    expect(screen.getAllByText('あとから記録')).toHaveLength(1);
    expect(screen.getAllByText(/19:10/)).toHaveLength(1); // 日本時間。late の足跡には時刻が無い
  });

  it('筋トレの足跡には「くわしく見る」があり、書いた人の userId を付けて詳細へ（メニューのコピーの入口。F-24）', async () => {
    replies['GET /api/feed'] = [{ status: 200, body: feed({ items: [item({ id: 'r1' })] }) }];
    renderFeed();
    await screen.findByText('4人が記録');
    const link = screen.getByRole('link', { name: 'くわしく見る' });
    expect(link.getAttribute('href')).toMatch(/^\/record-detail\?id=r1&by=.+/);
  });

  it('順位・連続日数・禁止語を出さない', async () => {
    replies['GET /api/feed'] = [{ status: 200, body: feed() }];
    renderFeed();
    await screen.findByText('4人が記録');
    const text = document.body.textContent ?? '';
    for (const word of ['順位', '連続', ...FORBIDDEN_WORDS]) expect(text).not.toContain(word);
  });

  it('足跡が0件（空）なら一言を出し、合計は0人の一言になる', async () => {
    replies['GET /api/feed'] = [
      { status: 200, body: feed({ items: [], totals: { recordedUserCount: 0, totalVolumeKg: 0, totalDistanceM: 0 } }) },
    ];
    renderFeed();
    expect(await screen.findByText('今週の足跡は まだないよ。最初の1つを どうぞ')).toBeInTheDocument();
    expect(screen.getByText('今週は まだ だれも記録していないよ')).toBeInTheDocument();
    expect(screen.queryByRole('list', { name: '仲間の足跡' })).not.toBeInTheDocument();
  });

  it('読み込みに失敗したら、画面に出せる文言を出す（内部の事情は出さない）', async () => {
    replies['GET /api/feed'] = [{ status: 500, body: { code: 'INTERNAL', message: 'stack trace' } }];
    renderFeed();
    expect(await screen.findByRole('alert')).toHaveTextContent('足跡を読み込めませんでした。電波の良い所で開き直してください');
    expect(document.body.textContent).not.toContain('stack trace');
  });

  it('ランは距離つき、休みは「おやすみ」を出す', async () => {
    replies['GET /api/feed'] = [
      {
        status: 200,
        body: feed({
          items: [
            item({ id: 'r2', kind: 'run', exerciseNames: [], run: { distanceM: 5200, durationS: 1800 } }),
            item({ id: 'r3', kind: 'rest', exerciseNames: [] }),
          ],
        }),
      },
    ];
    renderFeed();
    expect(await screen.findByText('ラン')).toBeInTheDocument();
    expect(screen.getByText('5.2km・30:00・5:46/km')).toBeInTheDocument();
    expect(screen.getByText('おやすみ')).toBeInTheDocument();
  });

  it('続きがあるときだけ「もっと見る」を出し、押すと nextCursor を渡して次の20件を足す', async () => {
    const user = userEvent.setup();
    replies['GET /api/feed'] = [
      { status: 200, body: feed({ nextCursor: 'c1' }) },
      { status: 200, body: feed({ items: [item({ id: 'r9', author: { ...HANAKO, name: 'じろう' }, exerciseNames: ['ラット'] })], nextCursor: null }) },
    ];
    renderFeed();
    await user.click(await screen.findByRole('button', { name: 'もっと見る' }));
    expect(await screen.findByText('じろう')).toBeInTheDocument();
    expect(screen.getByText('はなこ')).toBeInTheDocument();
    expect(feedGets()[1].url).toContain('cursor=c1');
    expect(screen.queryByRole('button', { name: 'もっと見る' })).not.toBeInTheDocument();
  });

  it('続きがなければ「もっと見る」は出ない', async () => {
    replies['GET /api/feed'] = [{ status: 200, body: feed() }];
    renderFeed();
    await screen.findByText('4人が記録');
    expect(screen.queryByRole('button', { name: 'もっと見る' })).not.toBeInTheDocument();
  });
});

describe('スタンプ', () => {
  it('筋トレ・ランは4種、休みは2種だけが並ぶ', async () => {
    replies['GET /api/feed'] = [
      { status: 200, body: feed({ items: [item({ id: 'r1' }), item({ id: 'r3', kind: 'rest', exerciseNames: [] })] }) },
    ];
    renderFeed();
    const lists = await screen.findAllByRole('list', { name: /へのスタンプ$/ });
    expect(within(lists[0]).getAllByRole('button').map((b) => b.textContent)).toEqual(['👍ナイス', '🔥すごい', '👏おつかれ', '❤️いいね', 'コメント']);
    expect(within(lists[1]).getAllByRole('button').map((b) => b.textContent)).toEqual(['😌ゆっくりね', '👋またあした', 'コメント']);
  });

  it('付いた数を出し、自分が付けたものは押された状態で表す', async () => {
    replies['GET /api/feed'] = [
      { status: 200, body: feed({ items: [item({ stamps: [{ stampKey: 'nice', count: 2, mine: 'x1', by: [] }, { stampKey: 'fire', count: 1, mine: null, by: [] }] })] }) },
    ];
    renderFeed();
    const nice = await screen.findByRole('button', { name: 'ナイス 2' });
    expect(nice).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: 'すごい 1' })).toHaveAttribute('aria-pressed', 'false');
    expect(screen.getByRole('button', { name: 'おつかれ' })).toHaveAttribute('aria-pressed', 'false');
  });

  it('U11: 自分の足跡には押すボタンを出さず、もらった分だけ数つきで出す', async () => {
    const ME = { id: 'u1', name: 'わたし', avatar: HANAKO.avatar };
    replies['GET /api/feed'] = [
      { status: 200, body: feed({ items: [item({ author: ME, stamps: [{ stampKey: 'nice', count: 2, mine: null, by: [] }] })] }) },
    ];
    renderFeed();
    const list = await screen.findByRole('list', { name: /へのスタンプ$/ });
    expect(within(list).getByRole('img', { name: 'ナイス 2' })).toBeInTheDocument();
    expect(within(list).queryByRole('button', { name: /ナイス|すごい|おつかれ/ })).not.toBeInTheDocument();
  });

  it('押すと POST /records/{id}/reactions へ id とスタンプのキーを送り、足跡を取り直す', async () => {
    const user = userEvent.setup();
    replies['GET /api/feed'] = [
      { status: 200, body: feed() },
      { status: 200, body: feed({ items: [item({ stamps: [{ stampKey: 'clap', count: 1, mine: 'rx', by: [] }] })] }) },
    ];
    replies['POST /api/records/r1/reactions'] = [{ status: 201, body: { id: 'rx', recordId: 'r1', stampKey: 'clap' } }];
    renderFeed();
    await user.click(await screen.findByRole('button', { name: 'おつかれ' }));
    expect(await screen.findByRole('button', { name: 'おつかれ 1' })).toHaveAttribute('aria-pressed', 'true');
    const post = sentPosts()[0];
    expect(post.body).toMatchObject({ stampKey: 'clap' });
    expect((post.body as { id: string }).id).toMatch(/^[0-9a-f-]{36}$/);
  });

  it('S5: 押した瞬間に数と「付いた」が変わる（サーバーの返事を待たない）。失敗したら元に戻る', async () => {
    const user = userEvent.setup();
    replies['GET /api/feed'] = [{ status: 200, body: feed() }];
    let rejectPost: (e: Error) => void = () => {};
    const base = globalThis.fetch as unknown as (url: string, init?: RequestInit) => Promise<Response>;
    vi.stubGlobal(
      'fetch',
      vi.fn((url: string, init?: RequestInit) =>
        init?.method === 'POST' && url === '/api/records/r1/reactions' ? new Promise<Response>((_, rej) => (rejectPost = rej)) : base(url, init),
      ),
    );
    renderFeed();
    await user.click(await screen.findByRole('button', { name: 'おつかれ' }));
    // 返事はまだ来ていないのに、もう「おつかれ 1」で押した状態
    expect(screen.getByRole('button', { name: 'おつかれ 1' })).toHaveAttribute('aria-pressed', 'true');
    rejectPost(new Error('offline'));
    expect(await screen.findByRole('button', { name: 'おつかれ' })).toHaveAttribute('aria-pressed', 'false');
  });

  it('自分が付けているスタンプを押すと、DELETE /records/{id}/reactions/{reactionId} で外す', async () => {
    const user = userEvent.setup();
    replies['GET /api/feed'] = [
      { status: 200, body: feed({ items: [item({ stamps: [{ stampKey: 'nice', count: 1, mine: 'x1', by: [] }] })] }) },
      { status: 200, body: feed() },
    ];
    replies['DELETE /api/records/r1/reactions/x1'] = [{ status: 204 }];
    renderFeed();
    await user.click(await screen.findByRole('button', { name: 'ナイス 1' }));
    expect(await screen.findByRole('button', { name: 'ナイス' })).toHaveAttribute('aria-pressed', 'false');
    expect(calls.some((c) => c.method === 'DELETE' && c.url === '/api/records/r1/reactions/x1')).toBe(true);
  });

  it('送れなかったら、日本語の文言を出す（API の message は出さず、内部の事情を出さない）', async () => {
    const user = userEvent.setup();
    replies['GET /api/feed'] = [{ status: 200, body: feed() }];
    replies['POST /api/records/r1/reactions'] = [{ status: 500, body: { code: 'INTERNAL', message: 'db down' } }];
    renderFeed();
    await user.click(await screen.findByRole('button', { name: 'ナイス' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('スタンプを送れませんでした。少し待って、もう一度お試しください');
    expect(document.body.textContent).not.toContain('db down');
  });

  it('電波がないときは押せず、理由を一言出す', async () => {
    replies['GET /api/feed'] = [{ status: 200, body: feed() }];
    renderFeed();
    await screen.findByRole('button', { name: 'ナイス' });
    onlineManager.setOnline(false);
    await waitFor(() => expect(screen.getByRole('button', { name: 'ナイス' })).toBeDisabled());
    expect(screen.getByText('電波があるときだけ スタンプとコメントを付けられます')).toBeInTheDocument();
  });
});

describe('コメント', () => {
  it('コメントの数をボタンに出す（0件は数なし）', async () => {
    replies['GET /api/feed'] = [{ status: 200, body: feed({ items: [item({ id: 'r1', commentCount: 3 }), item({ id: 'r2' })] }) }];
    renderFeed();
    expect(await screen.findByRole('button', { name: 'コメント 3' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'コメント' })).toBeInTheDocument();
  });

  it('開くと筋トレの定型4つ。休みは定型2つ', async () => {
    const user = userEvent.setup();
    replies['GET /api/feed'] = [{ status: 200, body: feed({ items: [item({ id: 'r3', kind: 'rest', exerciseNames: [] })] }) }];
    renderFeed();
    await user.click(await screen.findByRole('button', { name: 'コメント' }));
    const quick = screen.getByRole('list', { name: '定型コメント' });
    expect(within(quick).getAllByRole('button').map((b) => b.textContent)).toEqual(['ゆっくり休んでね', 'おつかれさま', 'また一緒にやろう']);
  });

  it('定型コメントを押すと、本文そのままを POST し、「送ったよ」を出す', async () => {
    const user = userEvent.setup();
    replies['GET /api/feed'] = [{ status: 200, body: feed() }, { status: 200, body: feed({ items: [item({ commentCount: 1 })] }) }];
    replies['POST /api/records/r1/comments'] = [{ status: 201, body: { id: 'c1', recordId: 'r1', body: 'ナイス！', createdAt: '2026-11-02T10:11:00.000Z', author: HANAKO } }];
    renderFeed();
    await user.click(await screen.findByRole('button', { name: 'コメント' }));
    await user.click(screen.getByRole('button', { name: 'ナイス！' }));
    expect(await screen.findByText('コメントを送ったよ')).toBeInTheDocument();
    expect(sentPosts()[0].body).toMatchObject({ body: 'ナイス！' });
    expect(await screen.findByRole('button', { name: 'コメント 1' })).toBeInTheDocument();
  });

  it('自由入力: 50字ちょうどは送れて、入力欄は空になる', async () => {
    const user = userEvent.setup();
    const body = 'あ'.repeat(50);
    replies['GET /api/feed'] = [{ status: 200, body: feed() }];
    replies['POST /api/records/r1/comments'] = [{ status: 201, body: { id: 'c1', recordId: 'r1', body, createdAt: '2026-11-02T10:11:00.000Z', author: HANAKO } }];
    renderFeed();
    await user.click(await screen.findByRole('button', { name: 'コメント' }));
    const input = screen.getByLabelText('自由に書く（50字まで）');
    await user.type(input, body);
    await user.click(screen.getByRole('button', { name: '送る' }));
    await screen.findByText('コメントを送ったよ');
    expect(sentPosts()[0].body).toMatchObject({ body });
    expect(input).toHaveValue('');
  });

  it('自由入力: 空白だけ（境界の外）は送らず、1〜50字の案内を出す', async () => {
    const user = userEvent.setup();
    replies['GET /api/feed'] = [{ status: 200, body: feed() }];
    renderFeed();
    await user.click(await screen.findByRole('button', { name: 'コメント' }));
    await user.type(screen.getByLabelText('自由に書く（50字まで）'), '   ');
    await user.click(screen.getByRole('button', { name: '送る' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('コメントは1〜50字で入れてください');
    expect(sentPosts()).toHaveLength(0);
  });

  it('入力欄は 51 字目を受け付けない（maxLength=50）', async () => {
    const user = userEvent.setup();
    replies['GET /api/feed'] = [{ status: 200, body: feed() }];
    renderFeed();
    await user.click(await screen.findByRole('button', { name: 'コメント' }));
    expect(screen.getByLabelText('自由に書く（50字まで）')).toHaveAttribute('maxlength', '50');
  });

  it('送れなかったら日本語の文言。入力は残る', async () => {
    const user = userEvent.setup();
    replies['GET /api/feed'] = [{ status: 200, body: feed() }];
    replies['POST /api/records/r1/comments'] = [{ status: 500, body: { message: 'boom' } }];
    renderFeed();
    await user.click(await screen.findByRole('button', { name: 'コメント' }));
    const input = screen.getByLabelText('自由に書く（50字まで）');
    await user.type(input, 'がんばって');
    await user.click(screen.getByRole('button', { name: '送る' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('コメントを送れませんでした。少し待って、もう一度お試しください');
    expect(input).toHaveValue('がんばって');
  });

  it('電波がないときは定型も送るボタンも押せない', async () => {
    const user = userEvent.setup();
    replies['GET /api/feed'] = [{ status: 200, body: feed() }];
    renderFeed();
    await user.click(await screen.findByRole('button', { name: 'コメント' }));
    onlineManager.setOnline(false);
    await waitFor(() => expect(screen.getByRole('button', { name: '送る' })).toBeDisabled());
    expect(screen.getByRole('button', { name: 'ナイス！' })).toBeDisabled();
  });
});

// 新着の印（F4）。足跡の最初のページが読めたら「見た」を1回だけ送る。新着の足跡には NEW の札
describe('新着の印', () => {
  it('新着（isNew）の足跡にだけ「新着」の札を出す', async () => {
    replies['GET /api/feed'] = [{ status: 200, body: feed({ items: [item({ id: 'r1', isNew: true }), item({ id: 'r2' })] }) }];
    replies['POST /api/feed/seen'] = [{ status: 204 }];
    renderFeed();
    const list = await screen.findByRole('list', { name: '仲間の足跡' });
    const items = within(list).getAllByRole('listitem').filter((li) => li.parentElement === list);
    expect(within(items[0]).getByText('新着')).toBeInTheDocument();
    expect(within(items[1]).queryByText('新着')).not.toBeInTheDocument();
  });

  it('足跡が読めたら POST /feed/seen を1回だけ送る（もっと見るで続きを読んでも増えない）', async () => {
    replies['GET /api/feed'] = [
      { status: 200, body: feed({ nextCursor: 'c1' }) },
      { status: 200, body: feed({ items: [item({ id: 'r9' })], nextCursor: null }) },
    ];
    replies['POST /api/feed/seen'] = [{ status: 204 }];
    renderFeed();
    await userEvent.click(await screen.findByRole('button', { name: 'もっと見る' }));
    await waitFor(() => expect(calls.filter((c) => c.method === 'GET' && c.url.startsWith('/api/feed?')).length).toBe(2));
    expect(calls.filter((c) => c.method === 'POST' && c.url === '/api/feed/seen')).toHaveLength(1);
  });

  it('読み込みに失敗したら「見た」は送らない', async () => {
    replies['GET /api/feed'] = [{ status: 500, body: {} }];
    renderFeed();
    expect(await screen.findByRole('alert')).toBeInTheDocument();
    expect(calls.some((c) => c.url === '/api/feed/seen')).toBe(false);
  });
});

// B05: 仲間タブの分かりにくさ（A04-1,2,3,4,6,8,10,12,13 / V-02,V-03）
describe('B05 仲間タブの改善', () => {
  it('A04-1: スタンプは絵文字の下に短い言葉が見える（読み上げだけではない）', async () => {
    replies['GET /api/feed'] = [{ status: 200, body: feed() }];
    renderFeed();
    const button = await screen.findByRole('button', { name: 'おつかれ' });
    const word = within(button).getByText('おつかれ');
    expect(word.className).not.toContain('sr-only');
  });

  it('A04-2: 押すと「送ったよ」、もう一度押すと取り消せて「取り消したよ」。押した状態の案内も出る', async () => {
    const user = userEvent.setup();
    replies['GET /api/feed'] = [
      { status: 200, body: feed() },
      { status: 200, body: feed({ items: [item({ stamps: [{ stampKey: 'clap', count: 1, mine: 'rx', by: [] }] })] }) },
      { status: 200, body: feed() },
    ];
    replies['POST /api/records/r1/reactions'] = [{ status: 201, body: { id: 'rx', recordId: 'r1', stampKey: 'clap' } }];
    replies['DELETE /api/records/r1/reactions/rx'] = [{ status: 204 }];
    renderFeed();
    await user.click(await screen.findByRole('button', { name: 'おつかれ' }));
    expect(await screen.findByText('スタンプを送ったよ')).toBeInTheDocument();
    expect(screen.getByText('もう一度押すと取り消せます')).toBeInTheDocument();
    await user.click(await screen.findByRole('button', { name: 'おつかれ 1' }));
    expect(await screen.findByText('スタンプを取り消したよ')).toBeInTheDocument();
  });

  it('A04-3: 送ったコメントの文面が一覧に残る', async () => {
    const user = userEvent.setup();
    replies['GET /api/feed'] = [{ status: 200, body: feed() }];
    replies['POST /api/records/r1/comments'] = [{ status: 201, body: { id: 'c1', recordId: 'r1', body: 'ナイス！', createdAt: '2026-11-02T10:11:00.000Z', author: HANAKO } }];
    renderFeed();
    await user.click(await screen.findByRole('button', { name: 'コメント' }));
    await user.click(screen.getByRole('button', { name: 'ナイス！' }));
    const sent = await screen.findByRole('list', { name: '送ったコメント' });
    expect(within(sent).getByText('ナイス！')).toBeInTheDocument();
  });

  it('A04-4: コメント欄を開くと、そこまで滑らかにスクロールする', async () => {
    const user = userEvent.setup();
    const scrollIntoView = vi.fn();
    Element.prototype.scrollIntoView = scrollIntoView;
    replies['GET /api/feed'] = [{ status: 200, body: feed() }];
    renderFeed();
    await user.click(await screen.findByRole('button', { name: 'コメント' }));
    expect(scrollIntoView).toHaveBeenCalledWith(expect.objectContaining({ behavior: 'smooth' }));
  });

  it('A04-6: 定型コメントに軽い言葉がある', async () => {
    const user = userEvent.setup();
    replies['GET /api/feed'] = [{ status: 200, body: feed() }];
    renderFeed();
    await user.click(await screen.findByRole('button', { name: 'コメント' }));
    const quick = within(screen.getByRole('list', { name: '定型コメント' })).getAllByRole('button').map((b) => b.textContent);
    expect(quick).toEqual(['ナイス！', 'おつかれさま', 'いい調子！', 'さすが！', '今度いっしょにやろう']);
  });

  it('A04-8/V-02: 新着の札は触ると外れ、文字は紺（白字×コーラルにしない）', async () => {
    const user = userEvent.setup();
    replies['GET /api/feed'] = [{ status: 200, body: feed({ items: [item({ id: 'r1', isNew: true })] }) }];
    renderFeed();
    const tag = await screen.findByText('新着');
    expect(tag.className).toContain('text-ink');
    expect(tag.className).not.toContain('text-white');
    await user.click(screen.getByRole('button', { name: 'コメント' }));
    expect(screen.queryByText('新着')).not.toBeInTheDocument();
  });

  it('A04-8: 新着の札は、画面に見えて少し経つと外れる（見えていない間は残る）', async () => {
    // jsdom に IntersectionObserver は無いので、見えた・見えなくなったを自分で知らせる偽物に差し替える
    const observers: Array<(entries: Array<{ isIntersecting: boolean }>) => void> = [];
    vi.stubGlobal(
      'IntersectionObserver',
      class {
        constructor(cb: (entries: Array<{ isIntersecting: boolean }>) => void) {
          observers.push(cb);
        }
        observe() {}
        disconnect() {}
      },
    );
    replies['GET /api/feed'] = [{ status: 200, body: feed({ items: [item({ id: 'r1', isNew: true })] }) }];
    renderFeed();
    await screen.findByText('新着');
    await waitFor(() => expect(observers.length).toBeGreaterThan(0));
    // 見えたあと、すぐに見えなくなれば残る（通り過ぎただけ）
    observers.forEach((cb) => cb([{ isIntersecting: true }]));
    observers.forEach((cb) => cb([{ isIntersecting: false }]));
    await new Promise((r) => setTimeout(r, 1700));
    expect(screen.getByText('新着')).toBeInTheDocument();
    // 見えたまま少し経てば外れる
    observers.forEach((cb) => cb([{ isIntersecting: true }]));
    await waitFor(() => expect(screen.queryByText('新着')).not.toBeInTheDocument(), { timeout: 3000 });
    vi.unstubAllGlobals();
  });

  it('A04-2: スタンプの下に、だれが押したかを出す（自分は「あなた」・自分の足跡ではもらった名前）', async () => {
    const stamps = [
      { stampKey: 'nice', count: 2, mine: 'x1', by: [{ id: 'u2', name: 'はなこ' }, { id: 'u1', name: 'わたし' }] },
      { stampKey: 'fire', count: 1, mine: null, by: [{ id: 'u3', name: 'たろう' }] },
    ];
    const ME = { id: 'u1', name: 'わたし', avatar: HANAKO.avatar };
    replies['GET /api/feed'] = [{ status: 200, body: feed({ items: [item({ id: 'r1', stamps }), item({ id: 'r2', author: ME, stamps: [stamps[1]] })] }) }];
    renderFeed();
    const who = await screen.findAllByTestId('stamp-who');
    expect(who).toHaveLength(2);
    expect(who[0]).toHaveTextContent('ナイス はなこ・あなた');
    expect(who[0]).toHaveTextContent('すごい たろう');
    expect(who[1]).toHaveTextContent('すごい たろう');
  });

  it('A04-2: スタンプが付いていない足跡には、押した人の行を出さない', async () => {
    replies['GET /api/feed'] = [{ status: 200, body: feed() }];
    renderFeed();
    await screen.findByRole('button', { name: 'ナイス' });
    expect(screen.queryByTestId('stamp-who')).not.toBeInTheDocument();
  });

  it('V-03: 押した状態の文字は濃いティール（4.5:1 以上）', async () => {
    replies['GET /api/feed'] = [{ status: 200, body: feed({ items: [item({ stamps: [{ stampKey: 'clap', count: 1, mine: 'rx', by: [] }] })] }) }];
    renderFeed();
    const button = await screen.findByRole('button', { name: 'おつかれ 1' });
    expect(button.className).toContain('text-teal-deep');
    expect(button.className).not.toContain('text-teal-dark');
  });

  it('A04-10: 足跡に種目のアイコンが付く（筋トレ・ラン・休み）', async () => {
    replies['GET /api/feed'] = [
      {
        status: 200,
        body: feed({
          items: [
            item({ id: 'a' }),
            item({ id: 'b', kind: 'run', exerciseNames: [], run: { distanceM: 5000, durationS: 1800 } }),
            item({ id: 'c', kind: 'rest', exerciseNames: [] }),
          ],
        }),
      },
    ];
    const { container } = renderFeed();
    await screen.findByText('4人が記録');
    expect(container.querySelectorAll('[data-testid="kind-icon"]')).toHaveLength(3);
  });

  it('A04-12: ランの足跡にも「くわしく見る」がある。休みにはない', async () => {
    replies['GET /api/feed'] = [
      {
        status: 200,
        body: feed({
          items: [
            item({ id: 'run1', kind: 'run', exerciseNames: [], run: { distanceM: 5000, durationS: 1800 } }),
            item({ id: 'rest1', kind: 'rest', exerciseNames: [] }),
          ],
        }),
      },
    ];
    renderFeed();
    await screen.findByText('4人が記録');
    const links = screen.getAllByRole('link', { name: 'くわしく見る' });
    expect(links).toHaveLength(1);
    expect(links[0].getAttribute('href')).toMatch(/^\/record-detail\?id=run1&by=/);
  });

  it('A04-13: 今日の足跡だけ見せ、前の日の分は「前の日の足跡を見る」で開く', async () => {
    const user = userEvent.setup();
    replies['GET /api/feed'] = [
      {
        status: 200,
        body: feed({ items: [item({ id: 't1' }), item({ id: 'o1', localDate: '2020-01-01', exerciseNames: ['デッドリフト'] })] }),
      },
    ];
    renderFeed();
    await screen.findByText('スクワット');
    expect(screen.queryByText('デッドリフト')).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /前の日の足跡を見る/ }));
    expect(screen.getByText('デッドリフト')).toBeInTheDocument();
  });

  it('A04-13: 今日の足跡が無いときは一言を出し、前の日の分は開ける', async () => {
    replies['GET /api/feed'] = [{ status: 200, body: feed({ items: [item({ id: 'o1', localDate: '2020-01-01' })] }) }];
    renderFeed();
    expect(await screen.findByText('今日の足跡は まだないよ')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /前の日の足跡を見る/ })).toBeInTheDocument();
  });
});
