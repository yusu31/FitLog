import { onlineManager } from '@tanstack/react-query';
import { resetSentNotice } from '@/lib/offline/sent-notice';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { FORBIDDEN_WORDS } from '@/lib/forbidden-words';
import { HOME_MESSAGES, LATE_MESSAGES } from '@/lib/messages';
import { calls, installFakeApi, renderWithQuery, restRecord, weekOf, workout } from '@/lib/test/fake-api';
import { TodayView } from './today-view';

// 時計を固定する（日本時間 2026-11-04（水）12:00）。Date だけを偽物にし、タイマーは本物のまま
const NOON_WED = '2026-11-04T03:00:00.000Z';
const TODAY = '2026-11-04';

const WORKOUTS = '/api/records?kind=workout&limit=5';
const LATEST = '/api/records?limit=1';
const WEEK = `/api/week?date=${TODAY}`;
const EXERCISES = '/api/exercises';

const ok = (body: unknown) => ({ status: 200, body });
const list = (...items: unknown[]) => ok({ items, nextCursor: null });

const squat = (sets: [number, number][]) => ({ id: 'sq', name: 'スクワット', sets });
const curl = (sets: [number, number][]) => ({ id: 'lc', name: 'レッグカール', sets });
const PREV = workout('r1', '2026-11-02', [squat([[60, 10]]), curl([[25, 12]])]);

const push = vi.fn();
vi.mock('next/navigation', () => ({ useRouter: () => ({ push }) }));
vi.mock('@/lib/auth-client', () => ({
  authClient: { useSession: () => ({ data: { user: { id: 'u1' } }, isPending: false }) },
}));

beforeEach(() => {
  push.mockClear();
  vi.useFakeTimers({ toFake: ['Date'], now: new Date(NOON_WED) });
});
afterEach(() => {
  onlineManager.setOnline(true);
  resetSentNotice();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('TodayView（S-10 今日）', () => {
  describe('朝・昼（まだ記録していない）', () => {
    beforeEach(() => {
      installFakeApi({
        [WEEK]: ok(weekOf(TODAY, { '2026-11-02': 'rec' })),
        [WORKOUTS]: list(PREV),
        [LATEST]: list(PREV),
      });
    });

    it('つぎにやることに、前回の最初の種目と前回の値を出し、「はじめる」は記録画面へのリンク', async () => {
      renderWithQuery(<TodayView />);
      const next = await screen.findByRole('region', { name: 'つぎにやること' });
      expect(within(next).getByText('スクワット')).toBeInTheDocument();
      expect(within(next).getByText('前回')).toBeInTheDocument();
      expect(within(next).getByText('60kg × 10')).toBeInTheDocument();
      expect(within(next).getByRole('link', { name: '前回と同じで始める' })).toHaveAttribute('href', '/record?exercise=sq');
    });

    it('今日のメニューに、前回と同じ種目が同じ順で並ぶ', async () => {
      renderWithQuery(<TodayView />);
      const menu = await screen.findByRole('list', { name: '今日のメニュー' });
      const rows = within(menu).getAllByRole('listitem');
      expect(rows).toHaveLength(2);
      expect(rows[0]).toHaveTextContent('スクワット');
      expect(rows[0]).toHaveTextContent('60kg × 10');
      expect(rows[1]).toHaveTextContent('レッグカール');
      expect(within(menu).queryByText('できた')).not.toBeInTheDocument();
    });

    it('提案（F-23）: つぎにやることに「今日の目標」、メニューの未完了の種目に「目標」を出す（前回の最後のセット＋1回）', async () => {
      renderWithQuery(<TodayView />);
      const next = await screen.findByRole('region', { name: 'つぎにやること' });
      expect(within(next).getByText('今日の目標')).toBeInTheDocument();
      expect(within(next).getByText('60kg × 11')).toBeInTheDocument();
      const rows = within(screen.getByRole('list', { name: '今日のメニュー' })).getAllByRole('listitem');
      expect(rows[0]).toHaveTextContent('目標 60kg × 11');
      expect(rows[1]).toHaveTextContent('目標 27.5kg × 8');
    });

    it('提案: できた種目には目標を出さない', async () => {
      installFakeApi({
        [WEEK]: ok(weekOf(TODAY, { '2026-11-02': 'rec' })),
        [WORKOUTS]: list(workout('r2', TODAY, [squat([[60, 11]])]), PREV),
        [LATEST]: list(PREV),
      });
      renderWithQuery(<TodayView />);
      const rows = within(await screen.findByRole('list', { name: '今日のメニュー' })).getAllByRole('listitem');
      expect(rows[0]).not.toHaveTextContent('目標');
      expect(rows[1]).toHaveTextContent('目標 27.5kg × 8');
    });

    it('週の帯: 記録=記録あり・休み=おやすみ・今日の印。未来の日は状態が付いていても薄い丸（記録あり扱いにしない）', async () => {
      installFakeApi({
        [WEEK]: ok(weekOf(TODAY, { '2026-11-02': 'rec', '2026-11-03': 'rest', '2026-11-06': 'rec' })),
        [WORKOUTS]: list(PREV),
        [LATEST]: list(PREV),
      });
      renderWithQuery(<TodayView />);
      const cells = within(await screen.findByRole('list', { name: '今週の7日' })).getAllByRole('listitem');
      const names = cells.map((c) => c.getAttribute('aria-label'));
      expect(names[0]).toBe('11/2 月曜 記録あり');
      expect(names[1]).toBe('11/3 火曜 おやすみ');
      expect(names[2]).toBe('11/4 水曜 今日');
      expect(names[4]).toBe('11/6 金曜');
    });

    it('前回の記録がある日も、メニューの下の「種目を足す」から種目の一覧へ行ける', async () => {
      renderWithQuery(<TodayView />);
      await screen.findByRole('list', { name: '今日のメニュー' });
      expect(screen.getByRole('link', { name: '種目を足す' })).toHaveAttribute('href', '/exercises');
    });

    // N4: 見出しは「ほかの種目」だったが、中身は全部の種目（上の「つぎにやること」と同じ種目や、できた種目も並ぶ）
    it('メニューの見出しは「今日のメニュー」（中身と合わせる）', async () => {
      renderWithQuery(<TodayView />);
      await screen.findByRole('list', { name: '今日のメニュー' });
      expect(screen.getByRole('heading', { name: '今日のメニュー' })).toBeInTheDocument();
      expect(screen.queryByText(/ほかの種目/)).not.toBeInTheDocument();
    });

    // N12: 帯の左上が「11/」だと、途中で切れて見える
    it('週の帯の左上は「11月」と、単位まで書く', async () => {
      renderWithQuery(<TodayView />);
      await screen.findByRole('list', { name: '今週の7日' });
      expect(screen.getByText('11月')).toBeInTheDocument();
    });

    it('連続日数は出さない', async () => {
      renderWithQuery(<TodayView />);
      await screen.findByRole('region', { name: 'つぎにやること' });
      expect(document.body).not.toHaveTextContent(/連続|日連続|ストリーク/);
    });
  });

  describe('一部だけできた', () => {
    it('できた種目にチェックが付き、つぎにやることは、まだの種目になる', async () => {
      installFakeApi({
        [WEEK]: ok(weekOf(TODAY, { [TODAY]: 'rec' })),
        [WORKOUTS]: list(workout('r2', TODAY, [squat([[62.5, 10]])]), PREV),
        [LATEST]: list(workout('r2', TODAY, [squat([[62.5, 10]])])),
      });
      renderWithQuery(<TodayView />);
      const next = await screen.findByRole('region', { name: 'つぎにやること' });
      expect(within(next).getByText('レッグカール')).toBeInTheDocument();
      expect(within(next).getByRole('link', { name: '前回と同じで始める' })).toHaveAttribute('href', '/record?exercise=lc');
      const rows = within(screen.getByRole('list', { name: '今日のメニュー' })).getAllByRole('listitem');
      expect(rows[0]).toHaveTextContent('できた');
      expect(rows[0]).toHaveTextContent('62.5kg × 10');
      expect(rows[1]).not.toHaveTextContent('できた');
    });
  });

  // N1: 開始は自動、終わりは「今日はここまで」。押すまで（または3時間）は記録中で、「できた」と言い切らない
  describe('記録中（N1）', () => {
    const activeToday = () => ({ ...workout('r2', TODAY, [squat([[60, 10], [60, 9]]), curl([[25, 12]])]), active: true });
    const END = 'POST /api/records/r2/end';
    const installActive = () =>
      installFakeApi({
        [WEEK]: ok(weekOf(TODAY, { [TODAY]: 'rec' })),
        // 終えたあとの取り直し（invalidate）では、サーバーは終えた状態を返す
        [WORKOUTS]: [list(activeToday(), PREV), list({ ...activeToday(), active: false }, PREV)],
        [LATEST]: list(activeToday()),
        [END]: ok({ id: 'r2', kind: 'workout', recordedAt: NOON_WED, localDate: TODAY, endedAt: NOON_WED }),
      });

    it('全部の種目ができていても「今日の分は できた」とは言わず、「記録中」と種目数・セット数を出す', async () => {
      installActive();
      renderWithQuery(<TodayView />);
      const card = await screen.findByRole('region', { name: '記録中' });
      expect(within(card).getByText('2種目 3セット')).toBeInTheDocument();
      expect(screen.queryByRole('heading', { name: '今日の分は できた' })).not.toBeInTheDocument();
    });

    it('「続ける」は、まだの種目がなければ種目の一覧へ。「今日はここまで」のボタンもある', async () => {
      installActive();
      renderWithQuery(<TodayView />);
      const card = await screen.findByRole('region', { name: '記録中' });
      expect(within(card).getByRole('link', { name: '続ける' })).toHaveAttribute('href', '/exercises');
      expect(within(card).getByRole('button', { name: '今日はここまで' })).toBeEnabled();
    });

    it('まだの種目が残っていれば、「続ける」はその種目の記録画面へ', async () => {
      const partial = { ...workout('r2', TODAY, [squat([[60, 10]])]), active: true };
      installFakeApi({
        [WEEK]: ok(weekOf(TODAY, { [TODAY]: 'rec' })),
        [WORKOUTS]: list(partial, PREV),
        [LATEST]: list(partial),
      });
      renderWithQuery(<TodayView />);
      const card = await screen.findByRole('region', { name: '記録中' });
      expect(within(card).getByRole('link', { name: '続ける' })).toHaveAttribute('href', '/record?exercise=lc');
    });

    it('「今日はここまで」を押すと終了を送り、まとめ（種目数・セット数）と「おつかれさま」を出して、記録中の札は消える', async () => {
      installActive();
      const user = userEvent.setup();
      renderWithQuery(<TodayView />);
      const card = await screen.findByRole('region', { name: '記録中' });
      await user.click(within(card).getByRole('button', { name: '今日はここまで' }));
      expect(calls).toContain(END);
      const summary = await screen.findByRole('dialog', { name: '今日のまとめ' });
      expect(within(summary).getByText('2種目 3セット')).toBeInTheDocument();
      expect(within(summary).getByText(/おつかれさま/)).toBeInTheDocument();
      await waitFor(() => expect(screen.queryByRole('region', { name: '記録中' })).not.toBeInTheDocument());
    });

    it('電波が無いときは「今日はここまで」を押せず、理由を出す（終了は電波があるときだけ）', async () => {
      installActive();
      renderWithQuery(<TodayView />);
      const card = await screen.findByRole('region', { name: '記録中' });
      onlineManager.setOnline(false);
      await waitFor(() => expect(within(card).getByRole('button', { name: '今日はここまで' })).toBeDisabled());
      expect(within(card).getByText(/電波がある/)).toBeInTheDocument();
    });

    it('終了が送れなかったら、記録中のまま、やさしい文言を出す（責めない）', async () => {
      installFakeApi({
        [WEEK]: ok(weekOf(TODAY, { [TODAY]: 'rec' })),
        [WORKOUTS]: list(activeToday(), PREV),
        [LATEST]: list(activeToday()),
        [END]: { status: 500, body: { code: 'INTERNAL', message: 'x' } },
      });
      const user = userEvent.setup();
      renderWithQuery(<TodayView />);
      const card = await screen.findByRole('region', { name: '記録中' });
      await user.click(within(card).getByRole('button', { name: '今日はここまで' }));
      expect(await screen.findByRole('alert')).toHaveTextContent('送れませんでした');
      expect(screen.getByRole('region', { name: '記録中' })).toBeInTheDocument();
      expect(screen.queryByRole('dialog', { name: '今日のまとめ' })).not.toBeInTheDocument();
    });

    it('禁止語（責める言葉）を使わない', async () => {
      installActive();
      renderWithQuery(<TodayView />);
      await screen.findByRole('region', { name: '記録中' });
      for (const w of FORBIDDEN_WORDS) expect(document.body).not.toHaveTextContent(w);
    });
  });

  describe('記録後（全部できた）', () => {
    it('「今日の分はできた」と出し、「はじめる」は出さない。全部にチェックが付く', async () => {
      const today = workout('r2', TODAY, [squat([[60, 10]]), curl([[25, 12]])]);
      installFakeApi({
        [WEEK]: ok(weekOf(TODAY, { [TODAY]: 'rec' })),
        [WORKOUTS]: list(today, PREV),
        [LATEST]: list(today),
      });
      renderWithQuery(<TodayView />);
      expect(await screen.findByRole('heading', { name: '今日の分は できた' })).toBeInTheDocument();
      expect(screen.queryByRole('link', { name: 'はじめる' })).not.toBeInTheDocument();
      expect(screen.getAllByText('できた')).toHaveLength(2);
      // 全部できた日も、別の種目を足せる
      expect(screen.getByRole('link', { name: '種目を足す' })).toHaveAttribute('href', '/exercises');
    });
  });

  // N5: 記録したあとに「今日は休む」が出ると矛盾する（今日はもう動いた）
  describe('記録したあとの「今日は休む」', () => {
    it('今日の記録（rec）があれば出さない', async () => {
      installFakeApi({
        [WEEK]: ok(weekOf(TODAY, { [TODAY]: 'rec' })),
        [WORKOUTS]: list(PREV),
        [LATEST]: list(PREV),
      });
      renderWithQuery(<TodayView />);
      await screen.findByRole('link', { name: 'ランを記録' });
      expect(screen.queryByRole('button', { name: /今日は休む/ })).not.toBeInTheDocument();
    });
  });

  describe('休み', () => {
    it('今日が休みの日は、おやすみの札を出し、「はじめる」は出さない', async () => {
      installFakeApi({
        [WEEK]: ok(weekOf(TODAY, { [TODAY]: 'rest' })),
        [WORKOUTS]: list(PREV),
        [LATEST]: list(restRecord('r3', TODAY)),
      });
      renderWithQuery(<TodayView />);
      expect(await screen.findByRole('heading', { name: '今日は おやすみ' })).toBeInTheDocument();
      expect(screen.queryByRole('link', { name: 'はじめる' })).not.toBeInTheDocument();
    });
  });

  describe('初回（前回の記録なし）', () => {
    beforeEach(() => {
      installFakeApi({
        [WEEK]: ok(weekOf(TODAY)),
        [WORKOUTS]: list(),
        [LATEST]: list(),
        [EXERCISES]: ok([
          { id: 'mine', name: '自分の種目', bodyPart: 'arms', isCustom: true, trialWeightKg: null, trialReps: null },
          { id: 'sq', name: 'スクワット', bodyPart: 'legs', isCustom: false, trialWeightKg: 20, trialReps: 10 },
        ]),
      });
    });

    it('「種目を選ぶ」（一覧へのリンク）と、お試しの前回値（「お試し」の札つき）を出す', async () => {
      renderWithQuery(<TodayView />);
      const next = await screen.findByRole('region', { name: 'つぎにやること' });
      expect(within(next).getByRole('link', { name: '種目を選ぶ' })).toHaveAttribute('href', '/exercises');
      expect(await within(next).findByText('お試し')).toBeInTheDocument();
      expect(within(next).getByText('スクワット')).toBeInTheDocument();
      expect(within(next).getByText('20kg × 10')).toBeInTheDocument();
    });

    it('今日のメニューの一覧は出さない', async () => {
      renderWithQuery(<TodayView />);
      await screen.findByRole('region', { name: 'つぎにやること' });
      expect(screen.queryByRole('list', { name: '今日のメニュー' })).not.toBeInTheDocument();
      // 入口はつぎにやることの「種目を選ぶ」1つだけ（同じ行き先のリンクを2つ並べない）
      expect(screen.queryByRole('link', { name: '種目を足す' })).not.toBeInTheDocument();
    });

    it('お試しの値が取れなくても、「種目を選ぶ」は出る', async () => {
      installFakeApi({ [WEEK]: ok(weekOf(TODAY)), [WORKOUTS]: list(), [LATEST]: list() });
      renderWithQuery(<TodayView />);
      expect(await screen.findByRole('link', { name: '種目を選ぶ' })).toBeInTheDocument();
      expect(screen.queryByText('お試し')).not.toBeInTheDocument();
    });
  });

  describe('おかえり', () => {
    const setup = (lastDate: string) =>
      installFakeApi({
        [WEEK]: ok(weekOf(TODAY)),
        [WORKOUTS]: list(PREV),
        [LATEST]: list(workout('r9', lastDate, [squat([[60, 10]])])),
      });

    it('最後の記録から3日以上あいたら、責めない一言を出す', async () => {
      setup('2026-11-01'); // 3日前
      renderWithQuery(<TodayView />);
      expect(await screen.findByText(HOME_MESSAGES.welcomeBack)).toBeInTheDocument();
    });

    it('2日前なら出さない（境目）', async () => {
      setup('2026-11-02');
      renderWithQuery(<TodayView />);
      await screen.findByRole('region', { name: 'つぎにやること' });
      expect(screen.queryByText(HOME_MESSAGES.welcomeBack)).not.toBeInTheDocument();
    });

    it('休みの日も記録に数える: 最後が休みで2日前なら出さない', async () => {
      installFakeApi({
        [WEEK]: ok(weekOf(TODAY)),
        [WORKOUTS]: list(workout('r1', '2026-10-20', [squat([[60, 10]])])),
        [LATEST]: list(restRecord('r9', '2026-11-02')),
      });
      renderWithQuery(<TodayView />);
      await screen.findByRole('region', { name: 'つぎにやること' });
      expect(screen.queryByText(HOME_MESSAGES.welcomeBack)).not.toBeInTheDocument();
    });

    it('画面全体に、責めない言葉の禁止語が出ない', async () => {
      setup('2026-10-20');
      renderWithQuery(<TodayView />);
      await screen.findByText(HOME_MESSAGES.welcomeBack);
      const text = document.body.textContent ?? '';
      for (const word of FORBIDDEN_WORDS) expect(text).not.toContain(word);
    });
  });

  describe('「今日は休む」', () => {
    const REST_POST = 'POST /api/records';
    const base = {
      [WEEK]: ok(weekOf(TODAY)),
      [WORKOUTS]: list(PREV),
      [LATEST]: list(PREV),
    };
    const posts = () => calls.filter((c) => c === REST_POST);
    const bodyOfPost = () => {
      const fetchMock = vi.mocked(globalThis.fetch);
      const call = fetchMock.mock.calls.find(([, init]) => init?.method === 'POST');
      return JSON.parse(String(call?.[1]?.body));
    };

    it('押せる状態で出ている（休みの日でないとき）', async () => {
      installFakeApi(base);
      renderWithQuery(<TodayView />);
      expect(await screen.findByRole('button', { name: /今日は休む/ })).toBeEnabled();
      expect(screen.queryByText('もうすぐ使えるようになります')).not.toBeInTheDocument();
    });

    it('押すと kind=rest の記録を作り（POST /records）、おやすみ画面（/rest）へ移る', async () => {
      installFakeApi({ ...base, [REST_POST]: { status: 201, body: { id: 'x', kind: 'rest' } } });
      renderWithQuery(<TodayView />);
      await userEvent.setup().click(await screen.findByRole('button', { name: /今日は休む/ }));
      await waitFor(() => expect(push).toHaveBeenCalledWith('/rest'));
      expect(posts()).toHaveLength(1);
      const body = bodyOfPost();
      expect(body.kind).toBe('rest');
      expect(body.id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
      expect(body.recordedAt).toBe(NOON_WED);
      expect(body).not.toHaveProperty('run');
    });

    it('すでに今日の休みがあって 200 で既存が返っても、同じように おやすみ画面へ移る（休みは1日1件）', async () => {
      installFakeApi({ ...base, [REST_POST]: { status: 200, body: { id: 'old', kind: 'rest' } } });
      renderWithQuery(<TodayView />);
      await userEvent.setup().click(await screen.findByRole('button', { name: /今日は休む/ }));
      await waitFor(() => expect(push).toHaveBeenCalledWith('/rest'));
    });

    it('サーバーの不具合（5xx）では、送信待ちに残して、待たずにおやすみ画面へ移る（F-30）', async () => {
      installFakeApi({ ...base, [REST_POST]: { status: 500, body: { code: 'INTERNAL', message: 'stack trace' } } });
      renderWithQuery(<TodayView />);
      await userEvent.setup().click(await screen.findByRole('button', { name: /今日は休む/ }));
      await waitFor(() => expect(push).toHaveBeenCalledWith('/rest'));
      expect(document.body.textContent).not.toContain('stack trace');
    });

    it('API が 400 で拒否したときは、おやすみ画面へ移らず、日本語の文言を出して、もう一度押せる', async () => {
      installFakeApi({ ...base, [REST_POST]: { status: 400, body: { code: 'VALIDATION_ERROR', message: '記録の時刻が正しくありません' } } });
      renderWithQuery(<TodayView />);
      await userEvent.setup().click(await screen.findByRole('button', { name: /今日は休む/ }));
      expect(await screen.findByRole('alert')).toHaveTextContent('記録の時刻が正しくありません');
      expect(push).not.toHaveBeenCalled();
      expect(screen.getByRole('button', { name: /今日は休む/ })).toBeEnabled();
    });

    it('送っている間は押せない（二度押しで2件送らない）', async () => {
      let release: () => void = () => {};
      const gate = new Promise<void>((resolve) => (release = resolve));
      installFakeApi({ ...base, [REST_POST]: { status: 201, body: { id: 'x' } } });
      const inner = vi.mocked(globalThis.fetch).getMockImplementation()!;
      vi.stubGlobal(
        'fetch',
        vi.fn(async (url: string, init?: RequestInit) => {
          if (init?.method === 'POST') await gate;
          return inner(url, init);
        }),
      );
      renderWithQuery(<TodayView />);
      const user = userEvent.setup();
      const button = await screen.findByRole('button', { name: /今日は休む/ });
      await user.click(button);
      await waitFor(() => expect(button).toBeDisabled());
      await user.click(button);
      release();
      await waitFor(() => expect(push).toHaveBeenCalledTimes(1));
      expect(posts()).toHaveLength(1);
    });

    it('電波が無いときも押せる。待たずに おやすみ画面へ移り、送信は電波が戻るまで待つ（F-30）', async () => {
      installFakeApi({ ...base, [REST_POST]: { status: 201, body: { id: 'x' } } });
      renderWithQuery(<TodayView />);
      const button = await screen.findByRole('button', { name: /今日は休む/ });
      onlineManager.setOnline(false);
      await userEvent.setup().click(button);
      await waitFor(() => expect(push).toHaveBeenCalledWith('/rest'));
      expect(posts()).toHaveLength(0);
      // 画面の上に「送信待ち 1件」の帯が出て（週の帯のすぐ下）、今日のマスは休みに見える（楽観的更新）
      expect(screen.getByTestId('sync-banner')).toHaveTextContent('送信待ち 1件');
      onlineManager.setOnline(true);
      await waitFor(() => expect(posts()).toHaveLength(1));
      await waitFor(() => expect(screen.getByTestId('sync-banner')).toHaveTextContent('1件 送ったよ'));
    });

    it('送信待ちが無いときは、帯に何も出さない', async () => {
      installFakeApi(base);
      renderWithQuery(<TodayView />);
      await screen.findByRole('button', { name: /今日は休む/ });
      expect(screen.getByTestId('sync-banner')).toBeEmptyDOMElement();
    });

    it('今日がもう休みなら、「今日は休む」は出さない', async () => {
      installFakeApi({
        [WEEK]: ok(weekOf(TODAY, { [TODAY]: 'rest' })),
        [WORKOUTS]: list(PREV),
        [LATEST]: list(restRecord('r3', TODAY)),
      });
      renderWithQuery(<TodayView />);
      await screen.findByRole('heading', { name: '今日は おやすみ' });
      expect(screen.queryByRole('button', { name: /今日は休む/ })).not.toBeInTheDocument();
    });
  });

  describe('「ランを記録」', () => {
    it('ラン記録画面（/run）へのリンクがある', async () => {
      installFakeApi({ [WEEK]: ok(weekOf(TODAY)), [WORKOUTS]: list(PREV), [LATEST]: list(PREV) });
      renderWithQuery(<TodayView />);
      expect(await screen.findByRole('link', { name: /ランを記録/ })).toHaveAttribute('href', '/run');
    });
  });

  describe('「今日 / きのう」の切り替え（F-21 あとから記録）', () => {
    beforeEach(() => {
      installFakeApi({ [WEEK]: ok(weekOf(TODAY, { '2026-11-02': 'rec' })), [WORKOUTS]: list(PREV), [LATEST]: list(PREV) });
    });
    const dayGroup = () => screen.findByRole('group', { name: '記録する日' });

    it('最初は「今日」が選ばれている。「きのう」を押すと切り替わる', async () => {
      renderWithQuery(<TodayView />);
      const group = await dayGroup();
      expect(within(group).getByRole('button', { name: '今日' })).toHaveAttribute('aria-pressed', 'true');
      expect(within(group).getByRole('button', { name: 'きのう' })).toHaveAttribute('aria-pressed', 'false');
      await userEvent.click(within(group).getByRole('button', { name: 'きのう' }));
      expect(within(group).getByRole('button', { name: 'きのう' })).toHaveAttribute('aria-pressed', 'true');
    });

    it('きのうでは、種目・種目を足す・ランのリンクに day=yesterday が付く', async () => {
      renderWithQuery(<TodayView />);
      await userEvent.click(within(await dayGroup()).getByRole('button', { name: 'きのう' }));
      const menu = await screen.findByRole('list', { name: '今日のメニュー' });
      expect(within(menu).getByRole('link', { name: /スクワット/ })).toHaveAttribute('href', '/record?exercise=sq&day=yesterday');
      expect(screen.getByRole('link', { name: /種目を足す/ })).toHaveAttribute('href', '/exercises?day=yesterday');
      expect(screen.getByRole('link', { name: /ランを記録/ })).toHaveAttribute('href', '/run?day=yesterday');
    });

    it('きのうでは、「つぎにやること」と「今日は休む」を出さない（きのうの休みは作れない）', async () => {
      renderWithQuery(<TodayView />);
      expect(await screen.findByRole('region', { name: 'つぎにやること' })).toBeInTheDocument();
      await userEvent.click(within(await dayGroup()).getByRole('button', { name: 'きのう' }));
      expect(screen.queryByRole('region', { name: 'つぎにやること' })).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /今日は休む/ })).not.toBeInTheDocument();
      expect(screen.getByText(LATE_MESSAGES.banner)).toBeInTheDocument();
    });

    it('「今日」へ戻すと、元の画面とリンクに戻る', async () => {
      renderWithQuery(<TodayView />);
      const group = await dayGroup();
      await userEvent.click(within(group).getByRole('button', { name: 'きのう' }));
      await userEvent.click(within(group).getByRole('button', { name: '今日' }));
      expect(await screen.findByRole('region', { name: 'つぎにやること' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /今日は休む/ })).toBeInTheDocument();
      expect(screen.getByRole('link', { name: /ランを記録/ })).toHaveAttribute('href', '/run');
    });
  });

  describe('読み込み中・エラー', () => {
    it('読み込み中は骨組みを出す', () => {
      installFakeApi({
        [WEEK]: ok(weekOf(TODAY)),
        [WORKOUTS]: list(),
        [LATEST]: list(),
      });
      renderWithQuery(<TodayView />);
      expect(screen.getByLabelText('読み込み中')).toHaveAttribute('aria-busy', 'true');
    });

    it('記録の取得に失敗したら、日本語の文言を出す（内部の事情は出さない）', async () => {
      installFakeApi({
        [WEEK]: ok(weekOf(TODAY)),
        [WORKOUTS]: { status: 500, body: { code: 'INTERNAL', message: 'DB connection refused' } },
        [LATEST]: list(),
      });
      renderWithQuery(<TodayView />);
      const alert = await screen.findByRole('alert');
      expect(alert).toHaveTextContent('読み込めませんでした');
      expect(alert).not.toHaveTextContent('DB connection');
    });

    it('週の取得に失敗しても、つぎにやることは出る', async () => {
      installFakeApi({
        [WEEK]: { status: 500, body: {} },
        [WORKOUTS]: list(PREV),
        [LATEST]: list(PREV),
      });
      renderWithQuery(<TodayView />);
      expect(await screen.findByRole('region', { name: 'つぎにやること' })).toBeInTheDocument();
      expect(screen.getByRole('alert')).toHaveTextContent('読み込めませんでした');
    });
  });

  // T-DATE-10 の画面部品版。時計を固定し、日曜 23:59:59 と月曜 0:00:00 で 7 マスが切り替わることを確かめる
  describe('日付の境目（T-DATE-10）', () => {
    const cases = [
      { label: '日曜 23:59:59（日本時間）', now: '2026-11-01T14:59:59.000Z', date: '2026-11-01', first: '10/26 月曜', todayLabel: '日曜' },
      { label: '月曜 0:00:00（日本時間）', now: '2026-11-01T15:00:00.000Z', date: '2026-11-02', first: '11/2 月曜', todayLabel: '月曜' },
    ];

    it.each(cases)('$label: GET /week?date=$date を呼び、7マスの今日がその曜日になる', async ({ now, date, first, todayLabel }) => {
      vi.setSystemTime(new Date(now));
      installFakeApi({
        [`/api/week?date=${date}`]: ok(weekOf(date, { [date]: 'rec' })),
        [WORKOUTS]: list(),
        [LATEST]: list(),
      });
      renderWithQuery(<TodayView />);
      const strip = await screen.findByRole('list', { name: '今週の7日' });
      const cells = within(strip).getAllByRole('listitem');
      expect(cells).toHaveLength(7);
      // 月曜始まり: 先頭の日付が切り替わる（日曜の間は 10/26、月曜になったら 11/2）
      expect(cells[0].getAttribute('aria-label')).toMatch(new RegExp(`^${first}`));
      expect(calls).toContain(`GET /api/week?date=${date}`);
      const todayCells = cells.filter((c) => c.getAttribute('aria-current') === 'date');
      expect(todayCells).toHaveLength(1);
      expect(todayCells[0].getAttribute('aria-label')).toMatch(new RegExp(`${todayLabel}.*今日.*記録あり`));
    });
  });
});

// 総合テスト（02-8 P3）の B03: 今日画面の分かりにくさ
describe('TodayView（B03 今日画面の直し）', () => {
  const GROUP = '/api/groups/current';
  const ROUTINES = '/api/routines';
  const LEG = {
    id: 'rt1',
    name: '脚の日',
    createdAt: '2026-11-02T03:00:00.000Z',
    exercises: [{ exerciseId: 'sq', name: 'スクワット', bodyPart: 'legs', sets: [{ setNo: 1, weightKg: 60, reps: 10 }] }],
  };
  const base = (extra: Record<string, unknown> = {}, statuses: Record<string, 'rec' | 'rest'> = { '2026-11-02': 'rec' }) =>
    installFakeApi({
      [WEEK]: ok(weekOf(TODAY, statuses)),
      [WORKOUTS]: list(PREV),
      [LATEST]: list(PREV),
      ...(extra as Record<string, { status: number; body?: unknown }>),
    });

  describe('A01-8・A02-1 仲間', () => {
    it('グループが無いとき、「仲間を招待する」と最初の1行の手順が出る', async () => {
      base({ [GROUP]: { status: 404, body: { message: 'なし' } } });
      renderWithQuery(<TodayView />);
      const card = await screen.findByRole('region', { name: '仲間' });
      expect(within(card).getByRole('link', { name: '仲間を招待する' })).toHaveAttribute('href', '/friends');
      expect(within(card).getByText(/グループを作って、招待リンクを送る/)).toBeInTheDocument();
    });

    it('仲間の今日の足跡の1行が、今日／きのうの切替より上に出る', async () => {
      const m = (id: string, name: string) => ({ id, name, avatar: { color: 'teal', character: 'a' } });
      base({
        [GROUP]: ok({ id: 'g1', name: 'g', members: [m('u1', 'わたし'), m('u2', '田中')] }),
        [`/api/feed?weekStart=${TODAY}`]: ok({
          items: [{ id: 'f1', kind: 'workout', recordedAt: NOON_WED, localDate: TODAY, author: m('u2', '田中'), exerciseNames: [], stamps: [], commentCount: 0 }],
          nextCursor: null,
          totals: { recordedUserCount: 1, totalVolumeKg: 0, totalDistanceM: 0 },
        }),
      });
      renderWithQuery(<TodayView />);
      const line = await screen.findByRole('link', { name: /仲間の今日 田中 が記録/ });
      const group = screen.getByRole('group', { name: '記録する日' });
      expect(line.compareDocumentPosition(group) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    });

    it('きのうを選ぶと、仲間の1行は出さない（今日の足跡なので）', async () => {
      base({ [GROUP]: { status: 404, body: { message: 'なし' } } });
      renderWithQuery(<TodayView />);
      await screen.findByRole('region', { name: '仲間' });
      await userEvent.setup().click(screen.getByRole('button', { name: 'きのう' }));
      expect(screen.queryByRole('region', { name: '仲間' })).not.toBeInTheDocument();
    });
  });

  describe('A02-2 入口は「前回と同じで始める」が最上段', () => {
    it('前回があれば、つぎにやることのボタンは「前回と同じで始める」。「はじめる」「いつものメニューから始める」は並べない', async () => {
      base({ [ROUTINES]: ok({ items: [LEG], max: 5 }) });
      renderWithQuery(<TodayView />);
      const next = await screen.findByRole('region', { name: 'つぎにやること' });
      expect(within(next).getByRole('link', { name: '前回と同じで始める' })).toBeInTheDocument();
      expect(screen.queryByRole('link', { name: 'はじめる' })).not.toBeInTheDocument();
      expect(screen.queryByRole('heading', { name: 'いつものメニューから始める' })).not.toBeInTheDocument();
    });

    it('いつものメニューは「ほかの始めかた」として出て、メニューより上にある', async () => {
      base({ [ROUTINES]: ok({ items: [LEG], max: 5 }) });
      renderWithQuery(<TodayView />);
      const heading = await screen.findByRole('heading', { name: 'ほかの始めかた（いつものメニュー）' });
      const menu = screen.getByRole('list', { name: '今日のメニュー' });
      expect(heading.compareDocumentPosition(menu) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    });
  });

  describe('A02-3 続ける（主）と 今日はここまで（副）', () => {
    it('「今日はここまで」は「続ける」より小さいボタンにする', async () => {
      base({ [WORKOUTS]: list({ ...workout('r2', TODAY, [squat([[60, 10]])]), active: true }, PREV) });
      renderWithQuery(<TodayView />);
      const card = await screen.findByRole('region', { name: '記録中' });
      const keep = within(card).getByRole('link', { name: '続ける' });
      const end = within(card).getByRole('button', { name: '今日はここまで' });
      expect(keep.className).toContain('min-h-14');
      expect(end.className).not.toContain('min-h-14');
    });
  });

  describe('A02-4 休む', () => {
    it('「今日は休む」は文字リンクの見た目（厚みボタンにしない）', async () => {
      base();
      renderWithQuery(<TodayView />);
      const rest = await screen.findByRole('button', { name: /今日は休む/ });
      expect(rest.className).not.toContain('fl-thick');
      expect(rest.className).toContain('underline');
    });

    it('休みの日は「やっぱり記録する」を出す（種目の一覧へ）', async () => {
      base({}, { [TODAY]: 'rest' });
      renderWithQuery(<TodayView />);
      const card = await screen.findByRole('region', { name: 'つぎにやること' });
      expect(within(card).getByRole('link', { name: 'やっぱり記録する' })).toHaveAttribute('href', '/exercises');
    });
  });

  describe('A02-6・N-09・A12-2 週の帯', () => {
    it('凡例を1行（黄=記録・紫=おやすみ）で出す', async () => {
      base();
      renderWithQuery(<TodayView />);
      expect(await screen.findByText(/黄 記録\s紫 おやすみ/)).toBeInTheDocument();
    });

    it('丸は押せるボタンに見えない: 影（厚み）を付けず、中に操作できる要素も無い', async () => {
      base({}, { '2026-11-02': 'rec', '2026-11-03': 'rest' });
      renderWithQuery(<TodayView />);
      const strip = await screen.findByRole('list', { name: '今週の7日' });
      expect(within(strip).queryAllByRole('button')).toHaveLength(0);
      expect(within(strip).queryAllByRole('link')).toHaveLength(0);
      for (const dot of within(strip).getAllByTestId('week-dot')) expect(dot.className).not.toContain('shadow');
    });

    it('狭い画面でも日付の数字がくっつかないよう、小さい画面では数字を小さくする', async () => {
      base();
      renderWithQuery(<TodayView />);
      const strip = await screen.findByRole('list', { name: '今週の7日' });
      const num = within(strip).getAllByTestId('week-num')[0];
      expect(num.className).toContain('min-[360px]:text-[30px]');
      expect(num.className).not.toMatch(/(^|\s)text-\[30px\]/);
    });
  });

  describe('A02-7・A02-9 今日／きのうの切替', () => {
    it('選んだ日を見出しで明示する（今日は「11月4日（水）の記録 今日」）', async () => {
      base();
      renderWithQuery(<TodayView />);
      expect(await screen.findByRole('heading', { name: '11月4日（水）の記録 今日' })).toBeInTheDocument();
    });

    it('きのうを選ぶと、見出しが「11月3日（火）の記録 きのう」になり、週の帯のその日に印が付く', async () => {
      base();
      renderWithQuery(<TodayView />);
      await userEvent.setup().click(await screen.findByRole('button', { name: 'きのう' }));
      expect(screen.getByRole('heading', { name: '11月3日（火）の記録 きのう' })).toBeInTheDocument();
      const cells = within(screen.getByRole('list', { name: '今週の7日' })).getAllByRole('listitem');
      expect(cells[1]).toHaveAttribute('data-selected', 'true');
      expect(cells[2]).not.toHaveAttribute('data-selected', 'true');
    });

    it('切替のボタンは大きい（高さ 48px 以上）', async () => {
      base();
      renderWithQuery(<TodayView />);
      expect((await screen.findByRole('button', { name: 'きのう' })).className).toContain('min-h-12');
    });
  });

  describe('A02-10 押せる・説明', () => {
    it('メニューの種目の行に矢印を添える', async () => {
      base();
      renderWithQuery(<TodayView />);
      const menu = await screen.findByRole('list', { name: '今日のメニュー' });
      expect(within(menu).getAllByTestId('row-arrow')).toHaveLength(2);
    });

    it('いつものメニューの × に「消す」の文字を添える', async () => {
      base({ [ROUTINES]: ok({ items: [LEG], max: 5 }) });
      renderWithQuery(<TodayView />);
      const remove = await screen.findByRole('button', { name: '脚の日を消す' });
      expect(remove).toHaveTextContent('消す');
    });
  });

  describe('A07-1 ランの入口は上部', () => {
    it('「ランを記録」は、つぎにやることより上にある', async () => {
      base();
      renderWithQuery(<TodayView />);
      const run = await screen.findByRole('link', { name: /ランを記録/ });
      const next = await screen.findByRole('region', { name: 'つぎにやること' });
      expect(run.compareDocumentPosition(next) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    });
  });
});
