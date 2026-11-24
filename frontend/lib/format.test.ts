import { formatJstTime, formatDistance, formatPace, formatResumeProgress, formatSetProgress, formatSetWithReps } from './format';

describe('formatPace（1kmあたりのペース）', () => {
  it.each([
    [5200, 1930, '6:11/km'], // 1930/5.2 = 371.15 → 四捨五入で 371秒
    [1000, 300, '5:00/km'], // ちょうど
    [100, 60, '10:00/km'], // 下限（0.1km・1分）
    [200000, 86400, '7:12/km'], // 上限（200km・24時間）
    [1000, 3659, '1:00:59/km'], // 1時間を超えるペースも崩れない
    [3000, 1199, '6:40/km'], // 399.67 → 400秒（秒の繰り上がり）
  ])('%im・%i秒 → %s', (d, t, expected) => {
    expect(formatPace(d, t)).toBe(expected);
  });

  it.each([
    [0, 600],
    [-100, 600],
    [1000, 0],
    [1000, -1],
    [Number.NaN, 600],
    [1000, Number.POSITIVE_INFINITY],
  ])('距離 %s・時間 %s は 0 割りなどになるので null', (d, t) => {
    expect(formatPace(d, t)).toBeNull();
  });
});

describe('formatJstTime（日本時間の時刻）', () => {
  it.each([
    ['2026-10-22T03:05:00.000Z', '12:05'],
    ['2026-10-22T14:59:00.000Z', '23:59'], // 日付が変わる直前
    ['2026-10-22T15:00:00.000Z', '0:00'], // 日付が変わった（翌日の 0:00）
    ['2026-10-22T00:00:00.000Z', '9:00'],
  ])('%s → %s', (iso, expected) => {
    expect(formatJstTime(iso)).toBe(expected);
  });
});

describe('formatSetWithReps（U3: 自重は 0kg と出さない）', () => {
  it('重さがあるときは「40kg × 10回」', () => {
    expect(formatSetWithReps({ weightKg: 40, reps: 10 })).toBe('40kg × 10回');
  });
  it('重さ 0（自重）は「自重 × 10回」', () => {
    expect(formatSetWithReps({ weightKg: 0, reps: 10 })).toBe('自重 × 10回');
  });
});

describe('formatSetProgress（U2・A4: 上のバーの読み上げ）', () => {
  it('前回があるときは、できた数と前回のセット数', () => {
    expect(formatSetProgress(2, 3)).toBe('2セット できた（前回は3セット）');
  });
  it('前回が無いときは、できた数だけ', () => {
    expect(formatSetProgress(1, 0)).toBe('1セット できた');
  });
});

describe('formatResumeProgress（D3 L12: 続きの記録は「続きから」と言い分ける）', () => {
  it('開いたときに入っていたセット数を「続きから（N セット済み）」と言い、「できた」とは言わない', () => {
    expect(formatResumeProgress(2, 0, 0)).toBe('続きから（2セット済み）');
    expect(formatResumeProgress(2, 0, 3)).not.toMatch(/できた/);
  });
  it('この画面で足した分と前回のセット数も添える', () => {
    expect(formatResumeProgress(2, 1, 3)).toBe('続きから（2セット済み）・いま1セット できた（前回は3セット）');
  });
});

// T-RUNP-03（U18）: 距離は 0.01km の桁まで。1桁で足りる値は今までどおり（5.2km・5.0km）。取り込み 5.04 と保存後の表示をそろえる
describe('formatDistance（距離の表示）', () => {
  it.each([
    [5200, '5.2km'],
    [5000, '5.0km'],
    [5040, '5.04km'],
    [5049, '5.05km'],
    [5004, '5.0km'],
    [12345, '12.35km'],
    [0, '0.0km'],
  ])('%i m → %s', (m, expected) => {
    expect(formatDistance(m)).toBe(expected);
  });
});
