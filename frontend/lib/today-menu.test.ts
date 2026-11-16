import { workout } from '@/lib/test/fake-api';
import { buildMenu } from './today-menu';

const TODAY = '2026-11-04';
const squat = (sets: [number, number][]) => ({ id: 'sq', name: 'スクワット', sets });
const curl = (sets: [number, number][]) => ({ id: 'lc', name: 'レッグカール', sets });

describe('buildMenu（今日のメニューを組み立てる）', () => {
  it('前回の筋トレがなければ、メニューは空で「初回」', () => {
    const m = buildMenu([], TODAY);
    expect(m.isFirstTime).toBe(true);
    expect(m.items).toEqual([]);
    expect(m.next).toBeNull();
    expect(m.allDone).toBe(false);
  });

  it('前回と同じ種目が同じ順で並び、前回の1セット目の値が付く。次の1枚は先頭', () => {
    const prev = workout('r1', '2026-11-01', [squat([[60, 10], [60, 8]]), curl([[25, 12]])]);
    const m = buildMenu([prev], TODAY);
    expect(m.isFirstTime).toBe(false);
    expect(m.items.map((i) => [i.exerciseId, i.done, i.previous])).toEqual([
      ['sq', false, { weightKg: 60, reps: 10 }],
      ['lc', false, { weightKg: 25, reps: 12 }],
    ]);
    expect(m.next?.exerciseId).toBe('sq');
    expect(m.allDone).toBe(false);
  });

  it('提案（F-23）は前回の最後のセットから作る。前回の無い種目は null', () => {
    const today = workout('r2', TODAY, [curl([[25, 12]])]);
    const prev = workout('r1', '2026-11-01', [squat([[60, 10], [60, 8]])]);
    const m = buildMenu([today, prev], TODAY);
    expect(m.items.map((i) => [i.exerciseId, i.suggestion])).toEqual([
      ['sq', { weightKg: 60, reps: 9 }],
      ['lc', null],
    ]);
  });

  it('今日すでにセットが入った種目は done。次の1枚は、まだの種目のうち先頭', () => {
    const today = workout('r2', TODAY, [squat([[62.5, 10]])]);
    const prev = workout('r1', '2026-11-01', [squat([[60, 10]]), curl([[25, 12]])]);
    const m = buildMenu([today, prev], TODAY);
    expect(m.items.map((i) => i.done)).toEqual([true, false]);
    expect(m.items[0].todayLast).toEqual({ weightKg: 62.5, reps: 10 });
    expect(m.next?.exerciseId).toBe('lc');
  });

  it('全部できたら allDone で、次の1枚は無い', () => {
    const today = workout('r2', TODAY, [squat([[60, 10]]), curl([[25, 12]])]);
    const prev = workout('r1', '2026-11-01', [squat([[60, 10]]), curl([[25, 12]])]);
    const m = buildMenu([today, prev], TODAY);
    expect(m.allDone).toBe(true);
    expect(m.next).toBeNull();
  });

  it('今日の記録しかない（前回なし）ときは、今日の種目がメニューになり、全部できた扱い', () => {
    const m = buildMenu([workout('r2', TODAY, [squat([[60, 10]])])], TODAY);
    expect(m.isFirstTime).toBe(true);
    expect(m.items.map((i) => i.done)).toEqual([true]);
    expect(m.allDone).toBe(true);
  });

  it('前回に含まれない種目を今日やったときは、メニューの末尾にできた種目として足す', () => {
    const today = workout('r2', TODAY, [curl([[25, 12]])]);
    const prev = workout('r1', '2026-11-01', [squat([[60, 10]])]);
    const m = buildMenu([today, prev], TODAY);
    expect(m.items.map((i) => [i.exerciseId, i.done])).toEqual([
      ['sq', false],
      ['lc', true],
    ]);
  });

  it('セットが1つも無い種目（空の記録）は、できた扱いにしない', () => {
    const today = workout('r2', TODAY, [squat([])]);
    const prev = workout('r1', '2026-11-01', [squat([[60, 10]])]);
    expect(buildMenu([today, prev], TODAY).items[0].done).toBe(false);
  });

  // N1: 記録中（サーバーが active を返す）は「全部できた」にしない。今日の記録の種目数・セット数を session に持つ
  describe('記録中（active）', () => {
    const activeToday = (...ex: ReturnType<typeof squat>[]) => ({ ...workout('r2', TODAY, ex), active: true });
    const prev = workout('r1', '2026-11-01', [squat([[60, 10]]), curl([[25, 12]])]);

    it('全部の種目にセットが入っていても、記録中なら allDone にならない。session に種目数とセット数が入る', () => {
      const today = activeToday(squat([[60, 10], [60, 9]]), curl([[25, 12]]));
      const m = buildMenu([today, prev], TODAY);
      expect(m.allDone).toBe(false);
      expect(m.session).toEqual({ recordId: 'r2', exerciseCount: 2, setCount: 3 });
    });

    it('終えた（active が false）か、active の項目が無い記録なら、全部できたとき allDone で session は null', () => {
      const ended = { ...workout('r2', TODAY, [squat([[60, 10]]), curl([[25, 12]])]), active: false };
      const m = buildMenu([ended, prev], TODAY);
      expect(m.allDone).toBe(true);
      expect(m.session).toBeNull();
    });

    it('記録中でも、別の日の記録は session にしない（きのうの分を入れた直後など）', () => {
      const yesterdayLate = { ...workout('r3', '2026-11-03', [squat([[60, 10]])]), active: true };
      expect(buildMenu([yesterdayLate, prev], TODAY).session).toBeNull();
    });
  });
});
