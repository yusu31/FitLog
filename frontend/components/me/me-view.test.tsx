import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { FORBIDDEN_WORDS } from '@/lib/forbidden-words';
import { calls, installFakeApi, renderWithQuery, restRecord, runRecord, workout } from '@/lib/test/fake-api';
import { MeView } from './me-view';

vi.mock('next/navigation', () => ({ useRouter: () => ({ replace: vi.fn() }) }));
vi.mock('@/lib/auth-client', () => ({
  authClient: {
    useSession: () => ({ data: { user: { id: 'u1', name: 'たろう' } }, isPending: false }),
    signOut: vi.fn(),
  },
}));

const FIRST = '/api/records?limit=20';
const ok = (body: unknown) => ({ status: 200, body });
const page = (items: unknown[], nextCursor: string | null = null) => ok({ items, nextCursor });

const squat = { id: 'sq', name: 'スクワット', sets: [[60, 10], [60, 8]] as [number, number][] };
const curl = { id: 'lc', name: 'レッグカール', sets: [[25, 12]] as [number, number][] };

afterEach(() => vi.unstubAllGlobals());

describe('MeView（S-30 自分）', () => {
  describe('記録の一覧', () => {
    it('筋トレは種目の要約、ランは距離と時間、休みは「おやすみ」で、新しい順に並ぶ', async () => {
      installFakeApi({
        [FIRST]: page([
          workout('r3', '2026-10-22', [squat, curl]),
          runRecord('r2', '2026-10-20', 5200, 32 * 60 + 10),
          restRecord('r1', '2026-10-19'),
        ]),
      });
      renderWithQuery(<MeView />);
      await screen.findByText('おやすみ');
      const list = screen.getByRole('list', { name: '記録' });
      const rows = within(list).getAllByRole('listitem');
      expect(rows).toHaveLength(3);
      expect(rows[0]).toHaveTextContent('10/22');
      expect(rows[0]).toHaveTextContent('スクワット ほか1種目');
      expect(rows[0]).toHaveTextContent('3セット');
      expect(rows[1]).toHaveTextContent('10/20');
      expect(rows[1]).toHaveTextContent('ラン');
      expect(rows[1]).toHaveTextContent('5.2km');
      expect(rows[1]).toHaveTextContent('32:10');
      expect(rows[2]).toHaveTextContent('10/19');
      expect(rows[2]).toHaveTextContent('おやすみ');
    });

    it('1時間を超えるランは 時:分:秒 で出す', async () => {
      installFakeApi({ [FIRST]: page([runRecord('r2', '2026-10-20', 12000, 3600 + 5 * 60 + 9)]) });
      renderWithQuery(<MeView />);
      await screen.findByText(/1:05:09/);
      const row = screen.getAllByRole('listitem')[0];
      expect(row).toHaveTextContent('12.0km');
      expect(row).toHaveTextContent('1:05:09');
    });

    it('種目が1つなら「ほか」を付けない', async () => {
      installFakeApi({ [FIRST]: page([workout('r3', '2026-10-22', [curl])]) });
      renderWithQuery(<MeView />);
      await screen.findByText('レッグカール');
      const row = screen.getAllByRole('listitem')[0];
      expect(row).toHaveTextContent('レッグカール');
      expect(row).not.toHaveTextContent('ほか');
    });

    it('記録が1件もないときは「まだ記録がありません」', async () => {
      installFakeApi({ [FIRST]: page([]) });
      renderWithQuery(<MeView />);
      expect(await screen.findByText('まだ記録がありません')).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'もっと見る' })).not.toBeInTheDocument();
    });

    it('続きがあるときだけ「もっと見る」を出し、押すと cursor を渡して続きを足す。最後のページでは消える', async () => {
      installFakeApi({
        [FIRST]: page([workout('r3', '2026-10-22', [curl])], 'CUR1'),
        '/api/records?limit=20&cursor=CUR1': page([restRecord('r1', '2026-10-01')], null),
      });
      const user = userEvent.setup();
      renderWithQuery(<MeView />);
      await user.click(await screen.findByRole('button', { name: 'もっと見る' }));

      expect(await screen.findByText('おやすみ')).toBeInTheDocument();
      expect(calls).toContain('GET /api/records?limit=20&cursor=CUR1');
      // 先に読んだ分も残っている
      expect(within(screen.getByRole('list', { name: '記録' })).getAllByRole('listitem')).toHaveLength(2);
      expect(screen.queryByRole('button', { name: 'もっと見る' })).not.toBeInTheDocument();
    });

    it('読み込み中は骨組み、失敗したら日本語の文言（内部の事情は出さない）', async () => {
      installFakeApi({ [FIRST]: { status: 500, body: { code: 'INTERNAL', message: 'stack trace' } } });
      renderWithQuery(<MeView />);
      expect(screen.getByLabelText('記録を読み込み中')).toHaveAttribute('aria-busy', 'true');
      const alert = await screen.findByRole('alert');
      expect(alert).toHaveTextContent('読み込めませんでした');
      expect(alert).not.toHaveTextContent('stack trace');
    });
  });

  describe('見た目だけの導線（ヒートマップ・記録をくわしく・設定）', () => {
    beforeEach(() => installFakeApi({ [FIRST]: page([]) }));

    it('押せない状態で置いてあり、押しても API を呼ばない', async () => {
      renderWithQuery(<MeView />);
      await screen.findByText('まだ記録がありません');
      const more = screen.getByRole('button', { name: /記録をくわしく/ });
      const settings = screen.getByRole('button', { name: /設定/ });
      expect(more).toBeDisabled();
      expect(settings).toBeDisabled();
      expect(screen.getByText('今週きたえたところ')).toBeInTheDocument();
      const before = calls.length;
      await userEvent.setup().click(more);
      expect(calls).toHaveLength(before);
    });

    it('名前の表示とログアウトの導線は残っている', async () => {
      renderWithQuery(<MeView />);
      expect(await screen.findByText('たろう')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'ログアウト' })).toBeEnabled();
    });
  });

  it('画面の文言に、責めない言葉の禁止語が出ない', async () => {
    installFakeApi({ [FIRST]: page([restRecord('r1', '2026-10-19')]) });
    renderWithQuery(<MeView />);
    await screen.findByText('おやすみ');
    for (const word of FORBIDDEN_WORDS) expect(document.body.textContent).not.toContain(word);
  });
});
