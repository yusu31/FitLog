import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { FORBIDDEN_WORDS } from '@/lib/forbidden-words';
import { HOME_MESSAGES } from '@/lib/messages';
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

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'], now: new Date(NOON_WED) });
});
afterEach(() => {
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
    it('見た目だけ。押せない状態で、押しても何も送らない', async () => {
      installFakeApi({ [WEEK]: ok(weekOf(TODAY)), [WORKOUTS]: list(PREV), [LATEST]: list(PREV) });
      renderWithQuery(<TodayView />);
      const button = await screen.findByRole('button', { name: /今日は休む/ });
      expect(button).toBeDisabled();
      const before = calls.length;
      await userEvent.setup().click(button);
      expect(calls).toHaveLength(before);
      expect(calls.some((c) => c.startsWith('POST'))).toBe(false);
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
