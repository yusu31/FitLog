import { onlineManager } from '@tanstack/react-query';
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

    it('次の1枚に、前回の最初の種目と前回の値を出し、「はじめる」は記録画面へのリンク', async () => {
      renderWithQuery(<TodayView />);
      const next = await screen.findByRole('region', { name: '次の1枚' });
      expect(within(next).getByText('スクワット')).toBeInTheDocument();
      expect(within(next).getByText('前回')).toBeInTheDocument();
      expect(within(next).getByText('60kg × 10')).toBeInTheDocument();
      expect(within(next).getByRole('link', { name: 'はじめる' })).toHaveAttribute('href', '/record?exercise=sq');
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

    it('連続日数は出さない', async () => {
      renderWithQuery(<TodayView />);
      await screen.findByRole('region', { name: '次の1枚' });
      expect(document.body).not.toHaveTextContent(/連続|日連続|ストリーク/);
    });
  });

  describe('一部だけできた', () => {
    it('できた種目にチェックが付き、次の1枚は、まだの種目になる', async () => {
      installFakeApi({
        [WEEK]: ok(weekOf(TODAY, { [TODAY]: 'rec' })),
        [WORKOUTS]: list(workout('r2', TODAY, [squat([[62.5, 10]])]), PREV),
        [LATEST]: list(workout('r2', TODAY, [squat([[62.5, 10]])])),
      });
      renderWithQuery(<TodayView />);
      const next = await screen.findByRole('region', { name: '次の1枚' });
      expect(within(next).getByText('レッグカール')).toBeInTheDocument();
      expect(within(next).getByRole('link', { name: 'はじめる' })).toHaveAttribute('href', '/record?exercise=lc');
      const rows = within(screen.getByRole('list', { name: '今日のメニュー' })).getAllByRole('listitem');
      expect(rows[0]).toHaveTextContent('できた');
      expect(rows[0]).toHaveTextContent('62.5kg × 10');
      expect(rows[1]).not.toHaveTextContent('できた');
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
      const next = await screen.findByRole('region', { name: '次の1枚' });
      expect(within(next).getByRole('link', { name: '種目を選ぶ' })).toHaveAttribute('href', '/exercises');
      expect(await within(next).findByText('お試し')).toBeInTheDocument();
      expect(within(next).getByText('スクワット')).toBeInTheDocument();
      expect(within(next).getByText('20kg × 10')).toBeInTheDocument();
    });

    it('今日のメニューの一覧は出さない', async () => {
      renderWithQuery(<TodayView />);
      await screen.findByRole('region', { name: '次の1枚' });
      expect(screen.queryByRole('list', { name: '今日のメニュー' })).not.toBeInTheDocument();
      // 入口は次の1枚の「種目を選ぶ」1つだけ（同じ行き先のリンクを2つ並べない）
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
      await screen.findByRole('region', { name: '次の1枚' });
      expect(screen.queryByText(HOME_MESSAGES.welcomeBack)).not.toBeInTheDocument();
    });

    it('休みの日も記録に数える: 最後が休みで2日前なら出さない', async () => {
      installFakeApi({
        [WEEK]: ok(weekOf(TODAY)),
        [WORKOUTS]: list(workout('r1', '2026-10-20', [squat([[60, 10]])])),
        [LATEST]: list(restRecord('r9', '2026-11-02')),
      });
      renderWithQuery(<TodayView />);
      await screen.findByRole('region', { name: '次の1枚' });
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

    it('きのうでは、「次の1枚」と「今日は休む」を出さない（きのうの休みは作れない）', async () => {
      renderWithQuery(<TodayView />);
      expect(await screen.findByRole('region', { name: '次の1枚' })).toBeInTheDocument();
      await userEvent.click(within(await dayGroup()).getByRole('button', { name: 'きのう' }));
      expect(screen.queryByRole('region', { name: '次の1枚' })).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /今日は休む/ })).not.toBeInTheDocument();
      expect(screen.getByText(LATE_MESSAGES.banner)).toBeInTheDocument();
    });

    it('「今日」へ戻すと、元の画面とリンクに戻る', async () => {
      renderWithQuery(<TodayView />);
      const group = await dayGroup();
      await userEvent.click(within(group).getByRole('button', { name: 'きのう' }));
      await userEvent.click(within(group).getByRole('button', { name: '今日' }));
      expect(await screen.findByRole('region', { name: '次の1枚' })).toBeInTheDocument();
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

    it('週の取得に失敗しても、次の1枚は出る', async () => {
      installFakeApi({
        [WEEK]: { status: 500, body: {} },
        [WORKOUTS]: list(PREV),
        [LATEST]: list(PREV),
      });
      renderWithQuery(<TodayView />);
      expect(await screen.findByRole('region', { name: '次の1枚' })).toBeInTheDocument();
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
