import { onlineManager } from '@tanstack/react-query';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { FORBIDDEN_WORDS } from '@/lib/forbidden-words';
import { calls, installFakeApi, renderWithQuery, restRecord, runRecord, workout } from '@/lib/test/fake-api';
import { RecordDetailView } from './record-detail-view';

let search = 'id=r1&from=me';
const replace = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace }),
  usePathname: () => '/record-detail/',
  useSearchParams: () => new URLSearchParams(search),
}));
vi.mock('./route-map', () => ({
  RouteMap: ({ route }: { route: { coordinates: unknown[] } }) => <div data-testid="route-map" data-points={route.coordinates.length} />,
}));
vi.mock('@/lib/auth-client', () => ({
  authClient: { useSession: () => ({ data: { user: { id: 'u1' } }, isPending: false }) },
}));

const ok = (body: unknown) => ({ status: 200, body });
const REC = '/api/records/r1';
const REACTIONS = '/api/records/r1/reactions';
const COMMENTS = '/api/records/r1/comments';
const ME = { id: 'u1', name: 'わたし', avatar: { body: 'normal', hair: 'short', hairColor: 'black', shirtColor: 'navy', pantsColor: 'gray' } };
const HANAKO = { ...ME, id: 'u2', name: 'はなこ' };
const comment = (id: string, body: string, author = HANAKO) => ({ id, recordId: 'r1', body, createdAt: '2026-11-02T10:11:00.000Z', author });
// スタンプ・コメントは空が既定。テストごとに上書きできる
const install = (routes: Parameters<typeof installFakeApi>[0]) =>
  installFakeApi({ [REACTIONS]: ok({ items: [] }), [COMMENTS]: ok({ items: [] }), ...routes });
// workout() は localDate の 03:00Z に記録した扱い。前回の問い合わせは before=その時刻
const prevUrl = (exercise: string, date = '2026-10-22') =>
  `/api/exercises/${exercise}/previous?before=${encodeURIComponent(`${date}T03:00:00.000Z`)}`;

const squat = { id: 'sq', name: 'スクワット', sets: [[60, 10], [60, 8]] as [number, number][] };
const prev = (sets: [number, number][], best: number | null) => ({
  previous: sets.length === 0 ? null : { recordedAt: '2026-10-20T03:00:00.000Z', sets: sets.map(([weightKg, reps], i) => ({ setNo: i + 1, weightKg, reps })) },
  personalBest: best === null ? null : { weightKg: 60, reps: best / 60, volume: best },
});

beforeEach(() => {
  search = 'id=r1&from=me';
  replace.mockReset();
});
afterEach(() => {
  vi.unstubAllGlobals();
  onlineManager.setOnline(true);
});

describe('RecordDetailView（S-21 記録の詳細）', () => {
  describe('筋トレ', () => {
    it('種類・日時（日本時間）・種目ごとのセット（重量×回数）を出す', async () => {
      install({ [REC]: ok(workout('r1', '2026-10-22', [squat])), [prevUrl('sq')]: ok(prev([[60, 10], [60, 8]], 600)) });
      renderWithQuery(<RecordDetailView />);
      expect(await screen.findByRole('heading', { level: 1, name: '筋トレ' })).toBeInTheDocument();
      expect(screen.getByText('10/22')).toBeInTheDocument();
      expect(screen.getByText(/12:00/)).toBeInTheDocument();
      const section = screen.getByRole('region', { name: 'スクワット' });
      expect(section).toHaveTextContent('セット1');
      expect(section).toHaveTextContent('60kg × 10');
      expect(section).toHaveTextContent('セット2');
      expect(section).toHaveTextContent('60kg × 8');
    });

    it('自重（0kg）は「自重 × 回数」', async () => {
      install({
        [REC]: ok(workout('r1', '2026-10-22', [{ id: 'pu', name: '腕立て', sets: [[0, 15]] }])),
        [prevUrl('pu')]: ok(prev([], null)),
      });
      renderWithQuery(<RecordDetailView />);
      expect(await screen.findByText('自重 × 15')).toBeInTheDocument();
    });

    it('セットごとにゴーストの結果（上回り・同じ・下回り）と自己ベストを出す', async () => {
      install({
        [REC]: ok(workout('r1', '2026-10-22', [{ id: 'sq', name: 'スクワット', sets: [[60, 12], [60, 10], [60, 8]] }])),
        // 前回は 60×10 を3セット。過去の最大は 600
        [prevUrl('sq')]: ok(prev([[60, 10], [60, 10], [60, 10]], 600)),
      });
      renderWithQuery(<RecordDetailView />);
      expect(await screen.findByText('前回超え +2')).toBeInTheDocument(); // セット1
      expect(screen.getByText('前回と おなじ')).toBeInTheDocument(); // セット2
      expect(screen.getByText('ちゃんと 記録したよ。むりしない日もOK')).toBeInTheDocument(); // セット3
      expect(screen.getAllByText('ベスト')).toHaveLength(1); // 60×12=720 だけが 600 を超える
    });

    it('前回が無い種目は「記録したよ」（比べる相手がいない）', async () => {
      install({ [REC]: ok(workout('r1', '2026-10-22', [squat])), [prevUrl('sq')]: ok(prev([], null)) });
      renderWithQuery(<RecordDetailView />);
      expect(await screen.findAllByText('記録したよ')).toHaveLength(2);
    });

    it('セットが0件でも崩れず、案内を出す', async () => {
      install({ [REC]: ok(workout('r1', '2026-10-22', [])) });
      renderWithQuery(<RecordDetailView />);
      expect(await screen.findByText('セットは まだありません')).toBeInTheDocument();
    });

    it('セットが多数（10件）でも、そのぶんだけ並ぶ', async () => {
      const many = Array.from({ length: 10 }, (_, i) => [20 + i, 10] as [number, number]);
      install({
        [REC]: ok(workout('r1', '2026-10-22', [{ id: 'sq', name: 'スクワット', sets: many }])),
        [prevUrl('sq')]: ok(prev([], null)),
      });
      renderWithQuery(<RecordDetailView />);
      const section = await screen.findByRole('region', { name: 'スクワット' });
      expect(section.querySelectorAll('li')).toHaveLength(10);
    });

    it('セットが1件でも、そのぶんだけ並ぶ', async () => {
      install({
        [REC]: ok(workout('r1', '2026-10-22', [{ id: 'sq', name: 'スクワット', sets: [[60, 10]] }])),
        [prevUrl('sq')]: ok(prev([], null)),
      });
      renderWithQuery(<RecordDetailView />);
      const section = await screen.findByRole('region', { name: 'スクワット' });
      expect(section.querySelectorAll('li')).toHaveLength(1);
    });

    it('前回の取得が失敗しても、セットの値は出す（結果だけ出さない）', async () => {
      install({ [REC]: ok(workout('r1', '2026-10-22', [squat])), [prevUrl('sq')]: { status: 500, body: {} } });
      renderWithQuery(<RecordDetailView />);
      expect(await screen.findByText('60kg × 10')).toBeInTheDocument();
      expect(screen.queryByText('記録したよ')).not.toBeInTheDocument();
    });

    it('自分の記録でない（from=me が無い）ときは、前回を取りに行かず結果も出さない', async () => {
      search = 'id=r1';
      install({ [REC]: ok(workout('r1', '2026-10-22', [squat])) });
      renderWithQuery(<RecordDetailView />);
      expect(await screen.findByText('60kg × 10')).toBeInTheDocument();
      expect(calls.filter((c) => c.includes("/previous"))).toEqual([]);
      expect(screen.queryByText('ベスト')).not.toBeInTheDocument();
    });
  });

  describe('ラン', () => {
    it.each([
      ['通常', 5200, 1930, '5.2km', '32:10', '6:11/km'],
      ['下限（0.1km・1分）', 100, 60, '0.1km', '1:00', '10:00/km'],
      ['上限（200km・24時間）', 200000, 86400, '200.0km', '24:00:00', '7:12/km'],
    ])('%s: 距離・時間・ペースを出す', async (_n, d, t, dist, dur, pace) => {
      install({ [REC]: ok(runRecord('r1', '2026-10-22', d, t)) });
      renderWithQuery(<RecordDetailView />);
      expect(await screen.findByRole('heading', { level: 1, name: 'ラン' })).toBeInTheDocument();
      expect(screen.getByText(dist)).toBeInTheDocument();
      expect(screen.getByText(dur)).toBeInTheDocument();
      expect(screen.getByText(pace)).toBeInTheDocument();
    });

    // F-15: GPX から保存したランだけ、ルートの地図を出す（手入力のランには出さない）
    it('route があるランは、距離・時間・ペースの下にルートの地図を出す', async () => {
      const route = { type: 'LineString', coordinates: [[139.7, 35.6], [139.8, 35.7], [139.9, 35.8]] };
      install({ [REC]: ok({ ...runRecord('r1', '2026-10-22', 5200, 1930), run: { distanceM: 5200, durationS: 1930, route } }) });
      renderWithQuery(<RecordDetailView />);
      const map = await screen.findByTestId('route-map');
      expect(map).toHaveAttribute('data-points', '3');
      expect(screen.getByText('5.2km')).toBeInTheDocument(); // 数字は地図があっても出る
    });

    it('route が無い（手入力の）ランには、地図を出さない', async () => {
      install({ [REC]: ok(runRecord('r1', '2026-10-22', 5200, 1930)) });
      renderWithQuery(<RecordDetailView />);
      expect(await screen.findByText('5.2km')).toBeInTheDocument();
      expect(screen.queryByTestId('route-map')).not.toBeInTheDocument();
    });

    it('距離が 0 のような壊れた値でも落ちず、ペースは「—」', async () => {
      install({ [REC]: ok(runRecord('r1', '2026-10-22', 0, 600)) });
      renderWithQuery(<RecordDetailView />);
      expect(await screen.findByText('—')).toBeInTheDocument();
    });
  });

  it('休みは「おやすみ」と責めない一言', async () => {
    install({ [REC]: ok(restRecord('r1', '2026-10-22')) });
    renderWithQuery(<RecordDetailView />);
    expect(await screen.findByRole('heading', { level: 1, name: 'おやすみ' })).toBeInTheDocument();
    expect(screen.getByText(/休むのも 記録のひとつ/)).toBeInTheDocument();
  });

  describe('読み込めないとき', () => {
    it('読み込み中は仮の表示を出す', () => {
      install({ [REC]: ok(restRecord('r1', '2026-10-22')) });
      renderWithQuery(<RecordDetailView />);
      expect(screen.getByLabelText('読み込み中')).toHaveAttribute('aria-busy', 'true');
    });

    it('404（無い・他人の記録）は、責めない文言の画面。もどるリンクつき', async () => {
      install({ [REC]: { status: 404, body: { code: 'RECORD_NOT_FOUND', message: 'x', details: null } } });
      renderWithQuery(<RecordDetailView />);
      expect(await screen.findByRole('heading', { name: '記録が見つかりませんでした' })).toBeInTheDocument();
      expect(screen.getAllByRole('link', { name: '自分にもどる' })[0]).toHaveAttribute('href', '/me');
      expect(screen.queryByRole('button', { name: /消す/ })).not.toBeInTheDocument();
    });

    it('id が無いときも 404 の画面（APIは呼ばない）。from=me が無ければ戻り先は仲間', async () => {
      search = '';
      install({});
      renderWithQuery(<RecordDetailView />);
      expect(await screen.findByRole('heading', { name: '記録が見つかりませんでした' })).toBeInTheDocument();
      expect(calls).toEqual([]);
      expect(screen.getAllByRole('link', { name: '仲間にもどる' })[0]).toHaveAttribute('href', '/friends');
    });

    it('5xx は「読み込めませんでした」（内部の事情を出さない）', async () => {
      install({ [REC]: { status: 500, body: { code: 'X', message: 'stack trace', details: null } } });
      renderWithQuery(<RecordDetailView />);
      expect(await screen.findByRole('alert')).toHaveTextContent('読み込めませんでした');
      expect(screen.queryByText('stack trace')).not.toBeInTheDocument();
    });

    it('通信できないときも「読み込めませんでした」', async () => {
      install({});
      renderWithQuery(<RecordDetailView />);
      expect(await screen.findByRole('alert')).toHaveTextContent('読み込めませんでした');
    });
  });

  describe('取り消し（自分の記録だけ）', () => {
    const DEL = 'DELETE /api/records/r1';
    const open = async () => {
      const user = userEvent.setup();
      await user.click(await screen.findByRole('button', { name: /この記録を 消す/ }));
      return user;
    };

    it('自分の記録（from=me）に入口がある。押すと確認が出て、ここでは何も送らない', async () => {
      install({ [REC]: ok(restRecord('r1', '2026-10-22')) });
      renderWithQuery(<RecordDetailView />);
      await open();
      expect(screen.getByRole('alertdialog')).toHaveTextContent('この記録を 消しますか？');
      expect(calls.filter((c) => c.startsWith('DELETE'))).toHaveLength(0);
    });

    it('筋トレの確認には「中のセットも一緒に消えます」を添える', async () => {
      install({ [REC]: ok(workout('r1', '2026-10-22', [squat])), [prevUrl('sq')]: ok(prev([], null)) });
      renderWithQuery(<RecordDetailView />);
      await open();
      expect(screen.getByRole('alertdialog')).toHaveTextContent('中のセットも一緒に消えます');
    });

    it('from=me が無い記録（仲間の記録など）には入口を出さない', async () => {
      search = 'id=r1';
      install({ [REC]: ok(restRecord('r1', '2026-10-22')) });
      renderWithQuery(<RecordDetailView />);
      await screen.findByRole('heading', { level: 1, name: 'おやすみ' });
      expect(screen.queryByRole('button', { name: /消す/ })).not.toBeInTheDocument();
    });

    it('「やめる」で閉じる。何も送らない', async () => {
      install({ [REC]: ok(restRecord('r1', '2026-10-22')) });
      renderWithQuery(<RecordDetailView />);
      const user = await open();
      await user.click(screen.getByRole('button', { name: 'やめる' }));
      expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
      expect(calls.filter((c) => c.startsWith('DELETE'))).toHaveLength(0);
    });

    it('「削除する」で DELETE を送り、成功したら自分タブへ戻る', async () => {
      install({ [REC]: ok(restRecord('r1', '2026-10-22')), [DEL]: { status: 204 }, '/api/records?limit=20': ok({ items: [], nextCursor: null }) });
      renderWithQuery(<RecordDetailView />);
      const user = await open();
      await user.click(screen.getByRole('button', { name: '削除する' }));
      await waitFor(() => expect(replace).toHaveBeenCalledWith('/me'));
      expect(calls.filter((c) => c.startsWith('DELETE'))).toEqual([DEL]);
    });

    it('消せなかったら（5xx）画面に残り、責めない文言を出す', async () => {
      install({ [REC]: ok(restRecord('r1', '2026-10-22')), [DEL]: { status: 500, body: { code: 'X', message: 'boom', details: null } } });
      renderWithQuery(<RecordDetailView />);
      const user = await open();
      await user.click(screen.getByRole('button', { name: '削除する' }));
      expect(await screen.findByRole('alert')).toHaveTextContent('消せませんでした');
      expect(replace).not.toHaveBeenCalled();
      expect(screen.getByRole('button', { name: /この記録を 消す/ })).toBeEnabled();
    });

    it('電波が無いときは押せず、理由を言う', async () => {
      install({ [REC]: ok(restRecord('r1', '2026-10-22')) });
      renderWithQuery(<RecordDetailView />);
      await screen.findByRole('heading', { level: 1, name: 'おやすみ' });
      onlineManager.setOnline(false);
      await waitFor(() => expect(screen.getByRole('button', { name: /この記録を 消す/ })).toBeDisabled());
      expect(screen.getByText('電波があるときだけ 消せます')).toBeInTheDocument();
    });
  });

  describe('スタンプとコメント', () => {
    const rest = { [REC]: ok(restRecord('r1', '2026-10-22')) };

    it('スタンプの数と自分が付けたものをサーバーの値で出す。休みには休み用の2つだけ', async () => {
      install({ ...rest, [REACTIONS]: ok({ items: [{ stampKey: 'rest_slow', count: 2, mine: 'x1' }] }) });
      renderWithQuery(<RecordDetailView />);
      expect(await screen.findByRole('button', { name: 'ゆっくりね 2' })).toHaveAttribute('aria-pressed', 'true');
      expect(screen.getByRole('button', { name: 'またあした' })).toHaveAttribute('aria-pressed', 'false');
      expect(screen.queryByRole('button', { name: 'ナイス' })).not.toBeInTheDocument();
    });

    it('筋トレには4つのスタンプ。空（だれも付けていない）なら数を出さない', async () => {
      install({ [REC]: ok(workout('r1', '2026-10-22', [])) });
      renderWithQuery(<RecordDetailView />);
      expect(await screen.findByRole('button', { name: 'ナイス' })).toHaveAttribute('aria-pressed', 'false');
      expect(screen.getByRole('list', { name: 'スタンプ' }).querySelectorAll('button')).toHaveLength(4);
    });

    it('押すと POST で付け、取り直した値を出す', async () => {
      install({
        ...rest,
        [REACTIONS]: [ok({ items: [] }), ok({ items: [{ stampKey: 'rest_again', count: 1, mine: 'rx' }] })],
        ['POST ' + REACTIONS]: { status: 201, body: { id: 'rx', recordId: 'r1', stampKey: 'rest_again' } },
      });
      renderWithQuery(<RecordDetailView />);
      const user = userEvent.setup();
      await user.click(await screen.findByRole('button', { name: 'またあした' }));
      expect(await screen.findByRole('button', { name: 'またあした 1' })).toHaveAttribute('aria-pressed', 'true');
      expect(calls).toContain('POST ' + REACTIONS);
    });

    it('付けているスタンプを押すと DELETE で外す', async () => {
      install({
        ...rest,
        [REACTIONS]: ok({ items: [{ stampKey: 'rest_slow', count: 1, mine: 'x1' }] }),
        ['DELETE ' + REACTIONS + '/x1']: { status: 204 },
      });
      renderWithQuery(<RecordDetailView />);
      const user = userEvent.setup();
      await user.click(await screen.findByRole('button', { name: 'ゆっくりね 1' }));
      await waitFor(() => expect(calls).toContain('DELETE ' + REACTIONS + '/x1'));
    });

    it('スタンプを送れなかったら（5xx）責めない文言', async () => {
      install({ ...rest, ['POST ' + REACTIONS]: { status: 500, body: { code: 'X', message: 'boom', details: null } } });
      renderWithQuery(<RecordDetailView />);
      const user = userEvent.setup();
      await user.click(await screen.findByRole('button', { name: 'またあした' }));
      expect(await screen.findByRole('alert')).toHaveTextContent('スタンプを送れませんでした');
    });

    it('コメントが0件なら「まだないよ」', async () => {
      install(rest);
      renderWithQuery(<RecordDetailView />);
      expect(await screen.findByText('コメントは まだないよ')).toBeInTheDocument();
    });

    it('コメントは API の順（古い順）に出し、削除ボタンは自分のコメントにだけ付く', async () => {
      install({ ...rest, [COMMENTS]: ok({ items: [comment('c1', 'ナイス！'), comment('c2', 'ありがとう', ME)] }) });
      renderWithQuery(<RecordDetailView />);
      const rows = (await screen.findByRole('list', { name: 'コメント一覧' })).querySelectorAll('li');
      expect(rows).toHaveLength(2);
      expect(rows[0]).toHaveTextContent('はなこ');
      expect(rows[0]).toHaveTextContent('ナイス！');
      expect(rows[0].querySelector('button')).toBeNull();
      expect(rows[1].querySelector('button')).not.toBeNull();
    });

    it('自分のコメントの削除は DELETE /comments/{id} のあと一覧を取り直す', async () => {
      install({
        ...rest,
        [COMMENTS]: [ok({ items: [comment('c2', 'ありがとう', ME)] }), ok({ items: [] })],
        'DELETE /api/comments/c2': { status: 204 },
      });
      renderWithQuery(<RecordDetailView />);
      const user = userEvent.setup();
      await user.click(await screen.findByRole('button', { name: /消す: ありがとう/ }));
      expect(await screen.findByText('コメントは まだないよ')).toBeInTheDocument();
      expect(calls).toContain('DELETE /api/comments/c2');
    });

    it('削除に失敗したら（404）API の文言を出す', async () => {
      install({
        ...rest,
        [COMMENTS]: ok({ items: [comment('c2', 'ありがとう', ME)] }),
        'DELETE /api/comments/c2': { status: 404, body: { code: 'COMMENT_NOT_FOUND', message: 'コメントが見つかりません', details: null } },
      });
      renderWithQuery(<RecordDetailView />);
      const user = userEvent.setup();
      await user.click(await screen.findByRole('button', { name: /消す: ありがとう/ }));
      expect(await screen.findByRole('alert')).toHaveTextContent('コメントが見つかりません');
    });

    const send = async (text: string) => {
      const user = userEvent.setup();
      const input = await screen.findByLabelText(/自由に書く/);
      if (text) await user.type(input, text);
      await user.click(screen.getByRole('button', { name: '送る' }));
    };

    it.each([
      ['1字（下限）', 'あ'],
      ['50字（上限）', 'あ'.repeat(50)],
    ])('%s は POST で送り、入力欄を空にして一覧を取り直す', async (_n, body) => {
      install({
        ...rest,
        [COMMENTS]: [ok({ items: [] }), ok({ items: [comment('c9', body, ME)] })],
        ['POST ' + COMMENTS]: { status: 201, body: comment('c9', body, ME) },
      });
      renderWithQuery(<RecordDetailView />);
      await send(body);
      expect(await screen.findByText('コメントを送ったよ')).toBeInTheDocument();
      expect(await screen.findByRole('list', { name: 'コメント一覧' })).toHaveTextContent(body);
      expect(screen.getByLabelText(/自由に書く/)).toHaveValue('');
    });

    it.each([
      ['0字', ''],
      ['空白だけ', '   '],
    ])('%s は送らず、1〜50字と案内する', async (_n, body) => {
      install(rest);
      renderWithQuery(<RecordDetailView />);
      await send(body);
      expect(await screen.findByRole('alert')).toHaveTextContent('コメントは1〜50字で入れてください');
      expect(calls.some((c) => c.startsWith('POST'))).toBe(false);
    });

    it('51字目は入力できない（maxLength=50）', async () => {
      install(rest);
      renderWithQuery(<RecordDetailView />);
      await userEvent.setup().type(await screen.findByLabelText(/自由に書く/), 'あ'.repeat(51));
      expect(screen.getByLabelText(/自由に書く/)).toHaveValue('あ'.repeat(50));
    });

    it('送れなかったら（5xx）責めない文言を出し、入力は残す', async () => {
      install({ ...rest, ['POST ' + COMMENTS]: { status: 500, body: { code: 'X', message: 'boom', details: null } } });
      renderWithQuery(<RecordDetailView />);
      await send('こんにちは');
      expect(await screen.findByRole('alert')).toHaveTextContent('コメントを送れませんでした');
      expect(screen.getByLabelText(/自由に書く/)).toHaveValue('こんにちは');
    });

    it('一覧・スタンプが読み込めなくても、記録の本体は出す。それぞれ案内を出す', async () => {
      install({
        ...rest,
        [COMMENTS]: { status: 404, body: { code: 'RECORD_NOT_FOUND', message: 'x', details: null } },
        [REACTIONS]: { status: 500, body: {} },
      });
      renderWithQuery(<RecordDetailView />);
      expect(await screen.findByText(/コメントを読み込めませんでした/)).toBeInTheDocument();
      expect(await screen.findByText(/スタンプを読み込めませんでした/)).toBeInTheDocument();
      expect(screen.getByRole('heading', { level: 1, name: 'おやすみ' })).toBeInTheDocument();
    });

    it('電波が無いときはスタンプも送信も削除も押せず、理由を言う', async () => {
      install({
        ...rest,
        [REACTIONS]: ok({ items: [{ stampKey: 'rest_slow', count: 1, mine: 'x1' }] }),
        [COMMENTS]: ok({ items: [comment('c2', 'ありがとう', ME)] }),
      });
      renderWithQuery(<RecordDetailView />);
      await screen.findByRole('button', { name: /消す: ありがとう/ });
      onlineManager.setOnline(false);
      await waitFor(() => expect(screen.getByRole('button', { name: '送る' })).toBeDisabled());
      expect(screen.getByRole('button', { name: 'ゆっくりね 1' })).toBeDisabled();
      expect(screen.getByRole('button', { name: /消す: ありがとう/ })).toBeDisabled();
      expect(screen.getByText('電波があるときだけ スタンプとコメントを付けられます')).toBeInTheDocument();
    });
  });

  it('画面に出る文言は、使ってはいけない語を含まない', async () => {
    install({ [REC]: ok(workout('r1', '2026-10-22', [squat])), [prevUrl('sq')]: ok(prev([[60, 8], [60, 6]], 500)) });
    const { container } = renderWithQuery(<RecordDetailView />);
    await screen.findByText('60kg × 10');
    await screen.findAllByText('前回超え +2');
    for (const word of FORBIDDEN_WORDS) expect(container.textContent).not.toContain(word);
  });
});
