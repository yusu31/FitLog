// からだ（B14a）の画面で使う、API に依らない計算と文言。判定の言葉（肥満・標準など）は出さない（責めない方針）。

export const WEIGHT_MIN = 20;
export const WEIGHT_MAX = 300;
export const HEIGHT_MIN = 100;
export const HEIGHT_MAX = 250;
export const BIO_MAX = 40;

export const BODY_MESSAGES = {
  title: 'からだ',
  back: '自分へ戻る',
  loading: '読み込み中…',
  loadFailed: '読み込めませんでした。電波の良い所で開き直してください',
  weightSection: '今日の体重',
  weightLabel: '体重（kg）',
  weightHint: '同じ日にもう一度保存すると上書きします',
  heightLabel: '身長（cm）',
  heightHint: `${HEIGHT_MIN}〜${HEIGHT_MAX} の範囲。自分だけに見えます`,
  save: '保存する',
  saving: '保存しています',
  saved: '保存しました',
  saveFailed: '保存できませんでした。もう一度お試しください',
  weightInvalid: `体重は ${WEIGHT_MIN}〜${WEIGHT_MAX} の範囲で、小数1桁までの数で入れてください`,
  heightInvalid: `身長は ${HEIGHT_MIN}〜${HEIGHT_MAX} の範囲の数で入れてください`,
  onlyYou: '体重と身長は、自分だけに見えます',
  numbersSection: '数字',
  bmi: 'BMI',
  bmiNeed: '身長と体重を入れると出ます',
  avg7: '7日の平均',
  delta: '前回から',
  noData: 'まだありません',
  chartSection: '体重のうつりかわり',
  chartHint: '太い線が7日の平均、うすい点が日々の体重です。日々の上下は気にしなくて大丈夫です',
  chartEmpty: '体重を入れると、ここにグラフが出ます',
  chartEmptyPeriod: 'この期間の体重はまだありません。期間を広げてみてください',
  periodLabel: '期間',
  rulerHint: '左右に動かす・矢印キーでも動きます',
  rulerFirst: '動かして今日の体重に合わせます',
  rulerGuess: (cm: number) => `身長 ${cm}cm からの目安（BMI 22）から始まります。動かして今日の体重に合わせます`,
  oneRmSection: '種目ごとの推定1RM',
  oneRmHint: '1回だけ持ち上げられる重さの目安です',
  oneRmApprox: '目安',
  oneRmApproxHint: '13回以上のセットは外れやすいので、あくまで目安です',
  oneRmEmpty: '筋トレを記録すると、種目ごとに出ます',
  profileSection: 'プロフィール',
  profileHint: '同じグループの仲間に見えます。どれも書かなくて大丈夫です',
  bioLabel: 'ひとこと',
  bioHint: `${BIO_MAX}字まで`,
  favoriteLegend: 'よくやる運動',
  activeLegend: '動きやすい時間帯',
  none: '決めない',
} as const;

export const rulerPrev = (value: number, date: string, unit = 'kg') => `前回 ${value}${unit}（${date}）· この値から始まります`;
export const bmiBarLabel = (bmi: number) => `BMI ${bmi} の位置`;
export const heightFrom = (cm: number) => `身長 ${cm}cm で計算しています`;

export const FAVORITE_OPTIONS = [
  { value: 'workout', label: '筋トレ' },
  { value: 'run', label: 'ラン' },
  { value: 'both', label: '両方' },
] as const;

export const ACTIVE_OPTIONS = [
  { value: 'morning', label: '朝' },
  { value: 'noon', label: '昼' },
  { value: 'night', label: '夜' },
] as const;

export type FavoriteKind = (typeof FAVORITE_OPTIONS)[number]['value'];
export type ActiveTime = (typeof ACTIVE_OPTIONS)[number]['value'];

// 入力欄の文字を体重（kg）にする。20〜300 の範囲で小数1桁まで。違えば null
export function parseWeightText(text: string): number | null {
  return parseTenths(text, WEIGHT_MIN, WEIGHT_MAX);
}

// 入力欄の文字を身長（cm）にする。100〜250 の範囲で小数1桁まで。違えば null
export function parseHeightText(text: string): number | null {
  return parseTenths(text, HEIGHT_MIN, HEIGHT_MAX);
}

function parseTenths(text: string, min: number, max: number): number | null {
  const t = text.trim();
  if (!/^\d+(\.\d)?$/.test(t)) return null;
  const n = Number(t);
  return n >= min && n <= max ? n : null;
}

// 前回からの増減の表示。減ったら「-0.5kg」、増えたら「+0.5kg」、同じなら「±0kg」。2件未満は null → 「—」
export function formatDelta(delta: number | null): string {
  if (delta === null) return '—';
  if (delta === 0) return '±0kg';
  return `${delta > 0 ? '+' : '-'}${Math.abs(delta)}kg`;
}

export type ChartPoint = { date: string; kg: number; avg7: number | null };
export type ChartShape = {
  width: number;
  height: number;
  // 7日平均の線（主役）
  avgPath: string;
  // 日々の体重の点（うすく）
  dots: { x: number; y: number; date: string; kg: number }[];
  // 縦軸の上端・下端（kg）
  min: number;
  max: number;
};

const dayNumber = (date: string): number => {
  const [y, m, d] = date.split('-').map(Number);
  return Math.round(Date.UTC(y, m - 1, d) / 86_400_000);
};

// グラフの形を作る。横は測った日（日付の間隔どおり）、縦は体重（上下に少し余白）。点が1つだけなら中央に置く
export function chartShape(points: ChartPoint[], width = 320, height = 160, pad = 16): ChartShape | null {
  if (points.length === 0) return null;
  const values = points.flatMap((p) => (p.avg7 === null ? [p.kg] : [p.kg, p.avg7]));
  const lo = Math.min(...values);
  const hi = Math.max(...values);
  const min = Math.floor(lo) - 1;
  const max = Math.ceil(hi) + 1;
  const first = dayNumber(points[0].date);
  const span = dayNumber(points[points.length - 1].date) - first;
  const x = (date: string) => (span === 0 ? width / 2 : pad + ((dayNumber(date) - first) / span) * (width - pad * 2));
  const y = (kg: number) => pad + ((max - kg) / (max - min)) * (height - pad * 2);
  const avgPoints = points.filter((p) => p.avg7 !== null);
  return {
    width,
    height,
    min,
    max,
    avgPath: avgPoints.map((p, i) => `${i === 0 ? 'M' : 'L'}${x(p.date).toFixed(1)} ${y(p.avg7!).toFixed(1)}`).join(' '),
    dots: points.map((p) => ({ x: Number(x(p.date).toFixed(1)), y: Number(y(p.kg).toFixed(1)), date: p.date, kg: p.kg })),
  };
}

// B14b: 自分・設定・記録につなぐ入口の文言。判定の言葉（肥満・標準など）は出さない
export const BODY_CONNECT_MESSAGES = {
  summaryTitle: 'からだ',
  summaryAvg7: '体重 7日の平均',
  summaryBmi: 'BMI',
  summaryOpen: 'からだを見る',
  invite: '体重を入れてみる',
  inviteNote: '入れると、7日の平均と BMI が出ます。自分だけに見えます',
  settingsTitle: 'からだ',
  settingsNote: '身長は自分だけに見えます。プロフィールは同じグループの仲間に見えます',
  heightLink: '「からだ」で変える',
  kcalNote: '推定（自分だけに見えます）',
} as const;

// 推定消費カロリーの表示。出せないとき（null・0 以下）は null → 何も出さない
export function formatKcal(kcal: number | null | undefined): string | null {
  if (kcal === null || kcal === undefined || !(kcal > 0)) return null;
  return `約 ${kcal} kcal`;
}

export const PERIODS = [
  { value: 'week', label: '週', days: 7 },
  { value: 'month', label: '月', days: 30 },
  { value: 'year', label: '年', days: 365 },
] as const;
export type Period = (typeof PERIODS)[number]['value'];

// 期間に入る点だけにする。today を含む直近 days 日（週＝7日・月＝30日・年＝365日）
export function filterByPeriod(points: ChartPoint[], period: Period, today: string): ChartPoint[] {
  const days = PERIODS.find((p) => p.value === period)!.days;
  const from = dayNumber(today) - (days - 1);
  return points.filter((p) => dayNumber(p.date) >= from);
}

// ルーラーの範囲と、0.1 ごとの幅（px）
export const RULER_PX = 10;

// 0.1 刻みに丸めて範囲内に収める
export function clampWeight(kg: number): number {
  return Math.min(WEIGHT_MAX, Math.max(WEIGHT_MIN, Math.round(kg * 10) / 10));
}

// 体重の記録が無い人の、ルーラーの始まりの目安。身長から BMI 22 の体重（0.1kg 刻み）。身長が無ければ 60kg
export const RULER_DEFAULT_KG = 60;
export const GUESS_BMI = 22;
export function guessWeight(heightCm: number | null): number {
  if (heightCm === null || !(heightCm >= HEIGHT_MIN && heightCm <= HEIGHT_MAX)) return RULER_DEFAULT_KG;
  const m = heightCm / 100;
  return clampWeight(GUESS_BMI * m * m);
}

// BMI の帯。左端 15・右端 35 の直線で位置（%）を出す。帯の色の境目は 18.5・25・30 の目盛り
export const BMI_SCALE = { min: 15, max: 35, marks: [18.5, 25, 30] } as const;
export function bmiPercent(bmi: number): number {
  const { min, max } = BMI_SCALE;
  const clamped = Math.min(max, Math.max(min, bmi));
  return Math.round(((clamped - min) / (max - min)) * 1000) / 10;
}
