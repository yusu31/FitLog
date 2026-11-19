import { onlineManager } from '@tanstack/react-query';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { FORBIDDEN_WORDS } from '@/lib/forbidden-words';
import { toLocalDate } from '@/lib/shared/local-date';
import { calls, installFakeApi as installApi, renderWithQuery, restRecord, runRecord, workout } from '@/lib/test/fake-api';
import { MeView } from './me-view';

const TODAY = toLocalDate(new Date());
const statsOf = (weekRunM: number, totalRunM: number) => ({
  today: TODAY,
  calendar: [],
  month: { month: TODAY.slice(0, 7), activeDays: 0, restDays: 0, totalWeightKg: 0, runDistanceM: weekRunM },
  weekly: Array.from({ length: 12 }, (_, i) => ({ weekStart: TODAY, totalWeightKg: 0, runDistanceM: i === 11 ? weekRunM : 0 })),
  stamps: [],
  totalRunDistanceM: totalRunM,
});
const STATS = `/api/me/stats?date=${TODAY}`;
// 画面の並び順（見出しの出る順）。今週のラン→今週きたえたところ
const headingOrder = () => screen.getAllByRole('heading', { level: 2 }).map((h) => h.textContent);

vi.mock('next/navigation', () => ({ useRouter: () => ({ replace: vi.fn() }) }));
vi.mock('@/lib/auth-client', () => ({
  authClient: {
    useSession: () => ({ data: { user: { id: 'u1', name: 'たろう' } }, isPending: false }),
    signOut: vi.fn(),
  },
}));

// 自分の過去の動画（MyVideoGrid）は、この画面のどのテストでも呼ばれる。決めていないテストでは「動画なし」を返す
const installFakeApi: typeof installApi = (routes) => installApi({ '/api/videos/mine': { status: 200, body: { items: [], nextCursor: null } }, ...routes });
const FIRST = '/api/records?limit=20';
const ok = (body: unknown) => ({ status: 200, body });
const page = (items: unknown[], nextCursor: string | null = null) => ok({ items, nextCursor });

const squat = { id: 'sq', name: 'スクワット', sets: [[60, 10], [60, 8]] as [number, number][] };
const curl = { id: 'lc', name: 'レッグカール', sets: [[25, 12]] as [number, number][] };

afterEach(() => vi.unstubAllGlobals());

describe('MeView（S-30 自分）', () => {
  describe('記録の一覧', () => {
    it('各行は、記録の詳細（S-21）へのリンク（自分の記録なので from=me つき）', async () => {
      installFakeApi({ [FIRST]: page([workout('r3', '2026-10-22', [squat]), restRecord('r1', '2026-10-19')]) });
      renderWithQuery(<MeView />);
      await screen.findByText('おやすみ');
      const rows = within(screen.getByRole('list', { name: '記録' })).getAllByRole('listitem');
      expect(within(rows[0]).getByRole('link')).toHaveAttribute('href', '/record-detail?id=r3&from=me');
      expect(within(rows[1]).getByRole('link')).toHaveAttribute('href', '/record-detail?id=r1&from=me');
    });

    it('あとから記録（late）の行にだけ「あとから記録」の札が付く（F-21）', async () => {
      installFakeApi({ [FIRST]: page([{ ...workout('r3', '2026-10-22', [squat]), late: true }, workout('r2', '2026-10-21', [curl])]) });
      renderWithQuery(<MeView />);
      await screen.findByText('スクワット');
      const rows = within(screen.getByRole('list', { name: '記録' })).getAllByRole('listitem');
      expect(within(rows[0]).getByText('あとから記録')).toBeInTheDocument();
      expect(within(rows[1]).queryByText('あとから記録')).not.toBeInTheDocument();
    });

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

  describe('自分の過去の動画（A04-10）', () => {
    it('過去の2秒動画のグリッドを、記録の一覧の上に出す', async () => {
      installFakeApi({
        [FIRST]: page([]),
        '/api/videos/mine': ok({ items: [{ id: 'v1', recordId: 'r1', recordedAt: '2026-11-02T01:00:00.000Z', localDate: '2026-11-02', visibleUntil: '2026-11-08T15:00:00.000Z' }], nextCursor: null }),
        '/api/videos/v1/url': ok({ url: 'https://s3.example/v1', expiresInSeconds: 300 }),
      });
      renderWithQuery(<MeView />);
      expect(await screen.findByRole('heading', { name: '自分の過去の2秒動画' })).toBeInTheDocument();
      expect(await screen.findByLabelText('11/2の動画を開く')).toBeInTheDocument();
    });
  });

  describe('並び（N9: ランが多い週だけ、今週のランを筋肉の図の上へ）', () => {
    const sq = { id: 'sq', name: 'スクワット', sets: [[60, 10]] as [number, number][] };
    it('今週ランが筋トレより多いと、「今週のラン」が「今週きたえたところ」より上に出る', async () => {
      installFakeApi({
        [FIRST]: page([runRecord('r2', TODAY, 5000, 1800), runRecord('r1', TODAY, 3000, 1000), workout('w1', TODAY, [sq])]),
        [STATS]: ok(statsOf(8000, 28000)),
      });
      renderWithQuery(<MeView />);
      const section = (await screen.findByRole('region', { name: '今週のラン' }));
      expect(section).toHaveTextContent('8.0km');
      expect(section).toHaveTextContent(/次の.+まで/);
      const order = headingOrder();
      expect(order.indexOf('今週のラン')).toBeLessThan(order.indexOf('今週きたえたところ'));
    });

    it('筋トレが多い・同数・記録なしの人には「今週のラン」を出さない（今の並びのまま）', async () => {
      installFakeApi({
        [FIRST]: page([runRecord('r1', TODAY, 3000, 1000), workout('w1', TODAY, [sq])]),
        [STATS]: ok(statsOf(3000, 3000)),
      });
      renderWithQuery(<MeView />);
      await screen.findByText('スクワット');
      expect(screen.queryByRole('region', { name: '今週のラン' })).not.toBeInTheDocument();
      expect(headingOrder()[0]).toBe('今週きたえたところ');
    });
  });

  describe('設定への入口・見た目だけの導線（からだの図・記録のまとめ）', () => {
    beforeEach(() => installFakeApi({ [FIRST]: page([]) }));

    it('「設定」は /settings へのリンク（画面そのものは別の担当が作る）', async () => {
      renderWithQuery(<MeView />);
      await screen.findByText('まだ記録がありません');
      expect(screen.getByRole('link', { name: /設定/ })).toHaveAttribute('href', '/settings');
      expect(screen.queryByRole('button', { name: /設定/ })).not.toBeInTheDocument();
    });

    it('「記録のまとめ」は /me/stats（S-35）へのリンク。からだの図も置いてある', async () => {
      renderWithQuery(<MeView />);
      await screen.findByText('まだ記録がありません');
      expect(screen.getByRole('link', { name: /記録のまとめ/ })).toHaveAttribute('href', '/me/stats');
      expect(screen.getByText('今週きたえたところ')).toBeInTheDocument();
    });

    it('A08-1・N-09: 「記録のまとめ」と「設定」の入口は、からだの図・記録の一覧より上（画面の上部）にある', async () => {
      renderWithQuery(<MeView />);
      await screen.findByText('まだ記録がありません');
      const heat = screen.getByText('今週きたえたところ');
      const records = screen.getByText('まだ記録がありません');
      for (const name of [/記録のまとめ/, /設定/]) {
        const link = screen.getByRole('link', { name });
        expect(link.compareDocumentPosition(heat) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
        expect(link.compareDocumentPosition(records) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
      }
    });

    it('名前は出すが、ログアウトは自分タブに置かない（設定にある。N10: 押し間違いを防ぐ）', async () => {
      renderWithQuery(<MeView />);
      expect(await screen.findByText('たろう')).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'ログアウト' })).not.toBeInTheDocument();
    });
  });

  // 記録の取り消し（features.md 2.11: 削除は電波があるときだけ）。筋トレの中のセットを消す操作は S-12 にある
  describe('記録の削除', () => {
    const DEL_R3 = 'DELETE /api/records/r3';
    const R3 = workout('r3', '2026-10-22', [squat, curl]);
    const R2 = runRecord('r2', '2026-10-20', 5200, 32 * 60 + 10);
    const R1 = restRecord('r1', '2026-10-19');
    const deletes = () => calls.filter((c) => c.startsWith('DELETE'));

    afterEach(() => onlineManager.setOnline(true));

    async function openDialog(user: ReturnType<typeof userEvent.setup>, rowText = '10/22') {
      await screen.findByText(rowText); // 読み込み中の骨組みも listitem なので、日付が出るのを待つ
      const row = screen.getAllByRole('listitem').find((li) => li.textContent?.includes(rowText))!;
      await user.click(within(row).getByRole('button', { name: /メニュー/ }));
      await user.click(screen.getByRole('menuitem', { name: '削除' }));
      return screen.findByRole('alertdialog');
    }

    it('どの記録にも「…」があり、押すと「削除」が出る（筋トレ・ラン・休みのどれも）', async () => {
      installFakeApi({ [FIRST]: page([R3, R2, R1]) });
      const user = userEvent.setup();
      renderWithQuery(<MeView />);
      await screen.findByText('おやすみ');
      const rows = within(screen.getByRole('list', { name: '記録' })).getAllByRole('listitem');
      for (const row of rows) expect(within(row).getByRole('button', { name: /メニュー/ })).toBeInTheDocument();
      expect(screen.queryByRole('menuitem')).not.toBeInTheDocument();
      await user.click(within(rows[1]).getByRole('button', { name: /メニュー/ }));
      expect(screen.getByRole('menuitem', { name: '削除' })).toBeEnabled();
    });

    it('「削除」を選ぶと確認が出る。ここでは何も送らない', async () => {
      installFakeApi({ [FIRST]: page([R3, R2]) });
      renderWithQuery(<MeView />);
      const dialog = await openDialog(userEvent.setup());
      expect(dialog).toHaveTextContent('この記録を 消しますか？');
      expect(dialog).toHaveTextContent('10/22');
      expect(dialog).toHaveTextContent('スクワット ほか1種目');
      expect(deletes()).toHaveLength(0);
    });

    it('「やめる」で閉じる。Esc でも閉じる。どちらも削除しない', async () => {
      installFakeApi({ [FIRST]: page([R3, R2]) });
      const user = userEvent.setup();
      renderWithQuery(<MeView />);
      await openDialog(user);
      await user.click(screen.getByRole('button', { name: 'やめる' }));
      expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
      await openDialog(user);
      await user.keyboard('{Escape}');
      expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
      expect(deletes()).toHaveLength(0);
      expect(screen.getAllByRole('listitem').some((li) => li.textContent?.includes('10/22'))).toBe(true);
    });

    it('「削除する」で DELETE /records/{id} を送り、その記録が一覧から消える（ほかは残る）', async () => {
      installFakeApi({
        [FIRST]: [
          { status: 200, body: { items: [R3, R2], nextCursor: null } },
          { status: 200, body: { items: [R2], nextCursor: null } },
        ],
        [DEL_R3]: { status: 204 },
      });
      const user = userEvent.setup();
      renderWithQuery(<MeView />);
      await openDialog(user);
      await user.click(screen.getByRole('button', { name: '削除する' }));
      await waitFor(() => expect(screen.queryByText('スクワット ほか1種目')).not.toBeInTheDocument());
      expect(deletes()).toEqual([DEL_R3]);
      expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
      expect(screen.queryByRole('alert')).not.toBeInTheDocument(); // 失敗の文言が出ていない（成功した）
      expect(screen.getByText('ラン')).toBeInTheDocument();
    });

    it('消せた記録は、取り直しの応答を待たずに見えなくなる（応答が古くても戻ってこない）', async () => {
      installFakeApi({
        [FIRST]: page([R3, R2]), // 取り直しても、まだ R3 が入った古い応答が返る場合
        [DEL_R3]: { status: 204 },
      });
      const user = userEvent.setup();
      renderWithQuery(<MeView />);
      await openDialog(user);
      await user.click(screen.getByRole('button', { name: '削除する' }));
      await waitFor(() => expect(deletes()).toEqual([DEL_R3]));
      await waitFor(() => expect(calls.filter((c) => c === `GET ${FIRST}`)).toHaveLength(2));
      // 取り直しの古い応答（R3 入り）が届いたあとでも、消した記録は見えないまま
      await waitFor(() => expect(screen.queryByText('スクワット ほか1種目')).not.toBeInTheDocument());
      await new Promise((r) => setTimeout(r, 100));
      expect(screen.queryByText('スクワット ほか1種目')).not.toBeInTheDocument();
    });

    it('消したあと、一覧を取り直す（古い一覧を残さない）', async () => {
      installFakeApi({
        [FIRST]: [
          { status: 200, body: { items: [R3, R2], nextCursor: null } },
          { status: 200, body: { items: [R2], nextCursor: null } },
        ],
        [DEL_R3]: { status: 204 },
      });
      const user = userEvent.setup();
      renderWithQuery(<MeView />);
      await openDialog(user);
      await user.click(screen.getByRole('button', { name: '削除する' }));
      await waitFor(() => expect(calls.filter((c) => c === `GET ${FIRST}`)).toHaveLength(2));
    });

    it('消せなかったときは、日本語の文言を出し、記録は残る（5xx の内部の事情は出さない）', async () => {
      installFakeApi({
        [FIRST]: page([R3, R2]),
        [DEL_R3]: { status: 500, body: { code: 'INTERNAL', message: 'stack trace' } },
      });
      const user = userEvent.setup();
      renderWithQuery(<MeView />);
      await openDialog(user);
      await user.click(screen.getByRole('button', { name: '削除する' }));
      const alert = await screen.findByRole('alert');
      expect(alert).toHaveTextContent('消せませんでした');
      expect(document.body.textContent).not.toContain('stack trace');
      expect(screen.getByText('スクワット ほか1種目')).toBeInTheDocument();
    });

    it('電波が無いときは「削除」を押せず、理由を言う（編集・削除は電波があるときだけ）', async () => {
      installFakeApi({ [FIRST]: page([R3]) });
      const user = userEvent.setup();
      renderWithQuery(<MeView />);
      await screen.findByText('10/22');
      const row = screen.getAllByRole('listitem').find((li) => li.textContent?.includes('10/22'))!;
      onlineManager.setOnline(false);
      await user.click(within(row).getByRole('button', { name: /メニュー/ }));
      expect(screen.getByRole('menuitem', { name: '削除' })).toBeDisabled();
      expect(screen.getByText('電波があるときだけ 消せます')).toBeInTheDocument();
    });

    it('画面の文言に、責めない言葉の禁止語が出ない（確認・失敗の文言も）', async () => {
      installFakeApi({ [FIRST]: page([R3]), [DEL_R3]: { status: 500, body: {} } });
      const user = userEvent.setup();
      renderWithQuery(<MeView />);
      await openDialog(user);
      for (const word of FORBIDDEN_WORDS) expect(document.body.textContent).not.toContain(word);
      await user.click(screen.getByRole('button', { name: '削除する' }));
      await screen.findByRole('alert');
      for (const word of FORBIDDEN_WORDS) expect(document.body.textContent).not.toContain(word);
    });
  });

  it('画面の文言に、責めない言葉の禁止語が出ない', async () => {
    installFakeApi({ [FIRST]: page([restRecord('r1', '2026-10-19')]) });
    renderWithQuery(<MeView />);
    await screen.findByText('おやすみ');
    for (const word of FORBIDDEN_WORDS) expect(document.body.textContent).not.toContain(word);
  });
});
