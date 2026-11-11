import { QueryClient, QueryClientProvider, onlineManager } from '@tanstack/react-query';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { FORBIDDEN_WORDS } from '@/lib/forbidden-words';
import { toLocalDate } from '@/lib/shared/local-date';
import { FeedSection } from './feed-section';

const AVATAR = { body: 'A', hair: 1, hairColor: 'brown', shirtColor: 'teal', pantsColor: 'navy' };
const HANAKO = { id: 'u2', name: 'はなこ', avatar: { ...AVATAR, shirtColor: 'coral' } };

const item = (over: Record<string, unknown>) => ({
  id: 'r1',
  kind: 'workout',
  recordedAt: '2026-11-02T10:10:00.000Z',
  localDate: '2026-11-02',
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

beforeEach(() => {
  replies = {};
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
    expect(screen.getByText('5.2km')).toBeInTheDocument();
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
    expect(calls[1].url).toContain('cursor=c1');
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
      { status: 200, body: feed({ items: [item({ stamps: [{ stampKey: 'nice', count: 2, mine: 'x1' }, { stampKey: 'fire', count: 1, mine: null }] })] }) },
    ];
    renderFeed();
    const nice = await screen.findByRole('button', { name: 'ナイス 2' });
    expect(nice).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: 'すごい 1' })).toHaveAttribute('aria-pressed', 'false');
    expect(screen.getByRole('button', { name: 'おつかれ' })).toHaveAttribute('aria-pressed', 'false');
  });

  it('押すと POST /records/{id}/reactions へ id とスタンプのキーを送り、足跡を取り直す', async () => {
    const user = userEvent.setup();
    replies['GET /api/feed'] = [
      { status: 200, body: feed() },
      { status: 200, body: feed({ items: [item({ stamps: [{ stampKey: 'clap', count: 1, mine: 'rx' }] })] }) },
    ];
    replies['POST /api/records/r1/reactions'] = [{ status: 201, body: { id: 'rx', recordId: 'r1', stampKey: 'clap' } }];
    renderFeed();
    await user.click(await screen.findByRole('button', { name: 'おつかれ' }));
    expect(await screen.findByRole('button', { name: 'おつかれ 1' })).toHaveAttribute('aria-pressed', 'true');
    const post = calls.find((c) => c.method === 'POST')!;
    expect(post.body).toMatchObject({ stampKey: 'clap' });
    expect((post.body as { id: string }).id).toMatch(/^[0-9a-f-]{36}$/);
  });

  it('自分が付けているスタンプを押すと、DELETE /records/{id}/reactions/{reactionId} で外す', async () => {
    const user = userEvent.setup();
    replies['GET /api/feed'] = [
      { status: 200, body: feed({ items: [item({ stamps: [{ stampKey: 'nice', count: 1, mine: 'x1' }] })] }) },
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
    expect(within(quick).getAllByRole('button').map((b) => b.textContent)).toEqual(['ゆっくり休んでね', 'また一緒にやろう']);
  });

  it('定型コメントを押すと、本文そのままを POST し、「送ったよ」を出す', async () => {
    const user = userEvent.setup();
    replies['GET /api/feed'] = [{ status: 200, body: feed() }, { status: 200, body: feed({ items: [item({ commentCount: 1 })] }) }];
    replies['POST /api/records/r1/comments'] = [{ status: 201, body: { id: 'c1', recordId: 'r1', body: 'ナイス！', createdAt: '2026-11-02T10:11:00.000Z', author: HANAKO } }];
    renderFeed();
    await user.click(await screen.findByRole('button', { name: 'コメント' }));
    await user.click(screen.getByRole('button', { name: 'ナイス！' }));
    expect(await screen.findByText('コメントを送ったよ')).toBeInTheDocument();
    expect(calls.find((c) => c.method === 'POST')!.body).toMatchObject({ body: 'ナイス！' });
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
    expect(calls.find((c) => c.method === 'POST')!.body).toMatchObject({ body });
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
    expect(calls.some((c) => c.method === 'POST')).toBe(false);
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
