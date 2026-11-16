import { isWorkoutActive, SESSION_GAP_MS } from './workout-session.js';

const T0 = new Date('2026-11-16T10:00:00.000Z');
const at = (ms: number) => new Date(T0.getTime() + ms);

// 「いま記録中」の判定（N1・N2）。終了を押していない筋トレで、最後のセットから3時間たっていないものだけが記録中
describe('isWorkoutActive', () => {
  it('終了を押しておらず、最後のセットから2時間59分なら記録中', () => {
    expect(isWorkoutActive({ endedAt: null, lastSetAt: T0, recordedAt: T0 }, at(SESSION_GAP_MS - 60_000))).toBe(true);
  });

  it('ちょうど3時間たつと記録中ではない（境界。画面の3時間ルールと同じく「以上」で別の記録）', () => {
    expect(isWorkoutActive({ endedAt: null, lastSetAt: T0, recordedAt: T0 }, at(SESSION_GAP_MS))).toBe(false);
  });

  it('終了を押した記録は、直後でも記録中ではない', () => {
    expect(isWorkoutActive({ endedAt: at(1000), lastSetAt: T0, recordedAt: T0 }, at(2000))).toBe(false);
  });

  it('セットが無い記録は、記録した時刻から3時間を数える', () => {
    expect(isWorkoutActive({ endedAt: null, lastSetAt: null, recordedAt: T0 }, at(60_000))).toBe(true);
    expect(isWorkoutActive({ endedAt: null, lastSetAt: null, recordedAt: T0 }, at(SESSION_GAP_MS))).toBe(false);
  });
});
