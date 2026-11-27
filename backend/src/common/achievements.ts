// 足跡のカードの帯に出す「達成」の決まり（純粋な関数。DB・Nest に依存しない）。
// 比べ方・数え方は、すでにある仕組みと同じ: 自己ベスト＝ゴースト（ghost.ts の volumeOf）、節目＝運動した日数（stats.ts の rec の日）、スタンプ＝スタンプ帳（stats.ts）

export const MILESTONE_DAYS = [1, 7, 30, 100] as const;

// 運動した日（rec の日）の一覧から、date が何日目か。節目（1・7・30・100日目）のときだけその数を返す。運動した日でなければ undefined
export function milestoneOf(recDates: readonly string[], date: string): number | undefined {
  const sorted = [...new Set(recDates)].sort();
  const index = sorted.indexOf(date);
  if (index < 0) return undefined;
  const nth = index + 1;
  return (MILESTONE_DAYS as readonly number[]).includes(nth) ? nth : undefined;
}

// 自己ベスト: 今回の最大が、過去の最大を超えた（同じは違う）。過去が無い（初めて）ときは比べる相手がいないので false。ghost.ts の isPersonalBest と同じ考え方
export const beatsPast = (current: number, pastMax: number | null): boolean => pastMax !== null && current > pastMax;
