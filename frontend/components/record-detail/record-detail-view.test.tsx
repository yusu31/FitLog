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
vi.mock('@/lib/auth-client', () => ({
  authClient: { useSession: () => ({ data: { user: { id: 'u1' } }, isPending: false }) },
}));

const ok = (body: unknown) => ({ status: 200, body });
const REC = '/api/records/r1';
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
      installFakeApi({ [REC]: ok(workout('r1', '2026-10-22', [squat])), [prevUrl('sq')]: ok(prev([[60, 10], [60, 8]], 600)) });
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
      installFakeApi({
        [REC]: ok(workout('r1', '2026-10-22', [{ id: 'pu', name: '腕立て', sets: [[0, 15]] }])),
        [prevUrl('pu')]: ok(prev([], null)),
      });
      renderWithQuery(<RecordDetailView />);
      expect(await screen.findByText('自重 × 15')).toBeInTheDocument();
    });

    it('セットごとにゴーストの結果（上回り・同じ・下回り）と自己ベストを出す', async () => {
      installFakeApi({
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
      installFakeApi({ [REC]: ok(workout('r1', '2026-10-22', [squat])), [prevUrl('sq')]: ok(prev([], null)) });
      renderWithQuery(<RecordDetailView />);
      expect(await screen.findAllByText('記録したよ')).toHaveLength(2);
    });

    it('セットが0件でも崩れず、案内を出す', async () => {
      installFakeApi({ [REC]: ok(workout('r1', '2026-10-22', [])) });
      renderWithQuery(<RecordDetailView />);
      expect(await screen.findByText('セットは まだありません')).toBeInTheDocument();
    });

    it('セットが多数（10件）でも、そのぶんだけ並ぶ', async () => {
      const many = Array.from({ length: 10 }, (_, i) => [20 + i, 10] as [number, number]);
      installFakeApi({
        [REC]: ok(workout('r1', '2026-10-22', [{ id: 'sq', name: 'スクワット', sets: many }])),
        [prevUrl('sq')]: ok(prev([], null)),
      });
      renderWithQuery(<RecordDetailView />);
      const section = await screen.findByRole('region', { name: 'スクワット' });
      expect(section.querySelectorAll('li')).toHaveLength(10);
    });

    it('セットが1件でも、そのぶんだけ並ぶ', async () => {
      installFakeApi({
        [REC]: ok(workout('r1', '2026-10-22', [{ id: 'sq', name: 'スクワット', sets: [[60, 10]] }])),
        [prevUrl('sq')]: ok(prev([], null)),
      });
      renderWithQuery(<RecordDetailView />);
      const section = await screen.findByRole('region', { name: 'スクワット' });
      expect(section.querySelectorAll('li')).toHaveLength(1);
    });

    it('前回の取得が失敗しても、セットの値は出す（結果だけ出さない）', async () => {
      installFakeApi({ [REC]: ok(workout('r1', '2026-10-22', [squat])), [prevUrl('sq')]: { status: 500, body: {} } });
      renderWithQuery(<RecordDetailView />);
      expect(await screen.findByText('60kg × 10')).toBeInTheDocument();
      expect(screen.queryByText('記録したよ')).not.toBeInTheDocument();
    });

    it('自分の記録でない（from=me が無い）ときは、前回を取りに行かず結果も出さない', async () => {
      search = 'id=r1';
      installFakeApi({ [REC]: ok(workout('r1', '2026-10-22', [squat])) });
      renderWithQuery(<RecordDetailView />);
      expect(await screen.findByText('60kg × 10')).toBeInTheDocument();
      expect(calls).toEqual([`GET ${REC}`]);
      expect(screen.queryByText('ベスト')).not.toBeInTheDocument();
    });
  });

  describe('ラン', () => {
    it.each([
      ['通常', 5200, 1930, '5.2km', '32:10', '6:11/km'],
      ['下限（0.1km・1分）', 100, 60, '0.1km', '1:00', '10:00/km'],
      ['上限（200km・24時間）', 200000, 86400, '200.0km', '24:00:00', '7:12/km'],
    ])('%s: 距離・時間・ペースを出す', async (_n, d, t, dist, dur, pace) => {
      installFakeApi({ [REC]: ok(runRecord('r1', '2026-10-22', d, t)) });
      renderWithQuery(<RecordDetailView />);
      expect(await screen.findByRole('heading', { level: 1, name: 'ラン' })).toBeInTheDocument();
      expect(screen.getByText(dist)).toBeInTheDocument();
      expect(screen.getByText(dur)).toBeInTheDocument();
      expect(screen.getByText(pace)).toBeInTheDocument();
    });

    it('距離が 0 のような壊れた値でも落ちず、ペースは「—」', async () => {
      installFakeApi({ [REC]: ok(runRecord('r1', '2026-10-22', 0, 600)) });
      renderWithQuery(<RecordDetailView />);
      expect(await screen.findByText('—')).toBeInTheDocument();
    });
  });

  it('休みは「おやすみ」と責めない一言', async () => {
    installFakeApi({ [REC]: ok(restRecord('r1', '2026-10-22')) });
    renderWithQuery(<RecordDetailView />);
    expect(await screen.findByRole('heading', { level: 1, name: 'おやすみ' })).toBeInTheDocument();
    expect(screen.getByText(/休むのも 記録のひとつ/)).toBeInTheDocument();
  });

  describe('読み込めないとき', () => {
    it('読み込み中は仮の表示を出す', () => {
      installFakeApi({ [REC]: ok(restRecord('r1', '2026-10-22')) });
      renderWithQuery(<RecordDetailView />);
      expect(screen.getByLabelText('読み込み中')).toHaveAttribute('aria-busy', 'true');
    });

    it('404（無い・他人の記録）は、責めない文言の画面。もどるリンクつき', async () => {
      installFakeApi({ [REC]: { status: 404, body: { code: 'RECORD_NOT_FOUND', message: 'x', details: null } } });
      renderWithQuery(<RecordDetailView />);
      expect(await screen.findByRole('heading', { name: '記録が見つかりませんでした' })).toBeInTheDocument();
      expect(screen.getAllByRole('link', { name: '自分にもどる' })[0]).toHaveAttribute('href', '/me');
      expect(screen.queryByRole('button', { name: /消す/ })).not.toBeInTheDocument();
    });

    it('id が無いときも 404 の画面（APIは呼ばない）。from=me が無ければ戻り先は仲間', async () => {
      search = '';
      installFakeApi({});
      renderWithQuery(<RecordDetailView />);
      expect(await screen.findByRole('heading', { name: '記録が見つかりませんでした' })).toBeInTheDocument();
      expect(calls).toEqual([]);
      expect(screen.getAllByRole('link', { name: '仲間にもどる' })[0]).toHaveAttribute('href', '/friends');
    });

    it('5xx は「読み込めませんでした」（内部の事情を出さない）', async () => {
      installFakeApi({ [REC]: { status: 500, body: { code: 'X', message: 'stack trace', details: null } } });
      renderWithQuery(<RecordDetailView />);
      expect(await screen.findByRole('alert')).toHaveTextContent('読み込めませんでした');
      expect(screen.queryByText('stack trace')).not.toBeInTheDocument();
    });

    it('通信できないときも「読み込めませんでした」', async () => {
      installFakeApi({});
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
      installFakeApi({ [REC]: ok(restRecord('r1', '2026-10-22')) });
      renderWithQuery(<RecordDetailView />);
      await open();
      expect(screen.getByRole('alertdialog')).toHaveTextContent('この記録を 消しますか？');
      expect(calls.filter((c) => c.startsWith('DELETE'))).toHaveLength(0);
    });

    it('筋トレの確認には「中のセットも一緒に消えます」を添える', async () => {
      installFakeApi({ [REC]: ok(workout('r1', '2026-10-22', [squat])), [prevUrl('sq')]: ok(prev([], null)) });
      renderWithQuery(<RecordDetailView />);
      await open();
      expect(screen.getByRole('alertdialog')).toHaveTextContent('中のセットも一緒に消えます');
    });

    it('from=me が無い記録（仲間の記録など）には入口を出さない', async () => {
      search = 'id=r1';
      installFakeApi({ [REC]: ok(restRecord('r1', '2026-10-22')) });
      renderWithQuery(<RecordDetailView />);
      await screen.findByRole('heading', { level: 1, name: 'おやすみ' });
      expect(screen.queryByRole('button', { name: /消す/ })).not.toBeInTheDocument();
    });

    it('「やめる」で閉じる。何も送らない', async () => {
      installFakeApi({ [REC]: ok(restRecord('r1', '2026-10-22')) });
      renderWithQuery(<RecordDetailView />);
      const user = await open();
      await user.click(screen.getByRole('button', { name: 'やめる' }));
      expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
      expect(calls.filter((c) => c.startsWith('DELETE'))).toHaveLength(0);
    });

    it('「削除する」で DELETE を送り、成功したら自分タブへ戻る', async () => {
      installFakeApi({ [REC]: ok(restRecord('r1', '2026-10-22')), [DEL]: { status: 204 }, '/api/records?limit=20': ok({ items: [], nextCursor: null }) });
      renderWithQuery(<RecordDetailView />);
      const user = await open();
      await user.click(screen.getByRole('button', { name: '削除する' }));
      await waitFor(() => expect(replace).toHaveBeenCalledWith('/me'));
      expect(calls.filter((c) => c.startsWith('DELETE'))).toEqual([DEL]);
    });

    it('消せなかったら（5xx）画面に残り、責めない文言を出す', async () => {
      installFakeApi({ [REC]: ok(restRecord('r1', '2026-10-22')), [DEL]: { status: 500, body: { code: 'X', message: 'boom', details: null } } });
      renderWithQuery(<RecordDetailView />);
      const user = await open();
      await user.click(screen.getByRole('button', { name: '削除する' }));
      expect(await screen.findByRole('alert')).toHaveTextContent('消せませんでした');
      expect(replace).not.toHaveBeenCalled();
      expect(screen.getByRole('button', { name: /この記録を 消す/ })).toBeEnabled();
    });

    it('電波が無いときは押せず、理由を言う', async () => {
      installFakeApi({ [REC]: ok(restRecord('r1', '2026-10-22')) });
      renderWithQuery(<RecordDetailView />);
      await screen.findByRole('heading', { level: 1, name: 'おやすみ' });
      onlineManager.setOnline(false);
      await waitFor(() => expect(screen.getByRole('button', { name: /この記録を 消す/ })).toBeDisabled());
      expect(screen.getByText('電波があるときだけ 消せます')).toBeInTheDocument();
    });
  });

  it('画面に出る文言は、使ってはいけない語を含まない', async () => {
    installFakeApi({ [REC]: ok(workout('r1', '2026-10-22', [squat])), [prevUrl('sq')]: ok(prev([[60, 8], [60, 6]], 500)) });
    const { container } = renderWithQuery(<RecordDetailView />);
    await screen.findByText('60kg × 10');
    await screen.findAllByText('前回超え +2');
    for (const word of FORBIDDEN_WORDS) expect(container.textContent).not.toContain(word);
  });
});
