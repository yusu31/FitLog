// おかえり判定（features.md UC-11・docs/testing-design.md T-DATE-12・14）。純粋な関数。
// 日付は日本時間の日付（YYYY-MM-DD）。今日の日付は共通の関数 toLocalDate(new Date()) で出して渡す。
// 「最後の記録」には休みも含めた最新の日付を渡す（休みは記録に数える。T-DATE-14）。

// おかえりを祝う、最後の記録の日と今日の日付の差（記録のない日が2日以上続いた＝差が3日以上）
export const WELCOME_BACK_MIN_DAYS = 3;

const DAY_MS = 24 * 60 * 60 * 1000;
const toUtcMs = (date: string): number => Date.parse(`${date}T00:00:00Z`);

// from から to までの日数（to が後なら正）。UTC の暦で読むのでタイムゾーンのずれが入らない
export const daysBetween = (from: string, to: string): number => Math.round((toUtcMs(to) - toUtcMs(from)) / DAY_MS);

// 記録がまだ無い人（last が null）は祝わない
export const shouldWelcomeBack = (lastRecordDate: string | null, today: string): boolean =>
  lastRecordDate !== null && daysBetween(lastRecordDate, today) >= WELCOME_BACK_MIN_DAYS;
