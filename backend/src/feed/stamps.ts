// スタンプの固定の一覧（docs/screen-design.md「スタンプと定型コメント」・docs/features.md UC-16）。
// DB には一覧を持たず（増やすたびにマイグレーションを要さないため）、ここの定数が正。表示名・アイコンは画面が持つ。
// 順位・数を競う言い方は入れない。

export const WORKOUT_STAMPS = ['nice', 'fire', 'clap', 'smile'] as const; // ナイス・すごい・おつかれ・いいね（筋トレ・ラン用）
export const REST_STAMPS = ['rest_slow', 'rest_again'] as const; // ゆっくりね・またあした（休み用）

export const STAMP_KEYS = [...WORKOUT_STAMPS, ...REST_STAMPS] as const;
export type StampKey = (typeof STAMP_KEYS)[number];

export const isStampKey = (value: unknown): value is StampKey => (STAMP_KEYS as readonly unknown[]).includes(value);

// そのスタンプを付けられる記録の種類。休みの記録には休み用だけ、筋トレ・ランには通常のスタンプだけ（testing-design.md T-STP-06）
export const stampFitsKind = (stampKey: StampKey, kind: 'workout' | 'run' | 'rest'): boolean =>
  (REST_STAMPS as readonly string[]).includes(stampKey) === (kind === 'rest');

// 1つの記録に付いたスタンプの行を「スタンプごとの数」にまとめる。付いたものだけ、スタンプの一覧の順に並べる。
// mine は自分が付けているスタンプの id（外すときに使う。付けていなければ null）。足跡（GET /feed）と一覧（GET /records/{id}/reactions）で同じ形にするため、ここに1つだけ置く
export const summarizeStamps = (
  rows: ReadonlyArray<{ id: string; userId: string; stampKey: string }>,
  userId: string,
): Array<{ stampKey: StampKey; count: number; mine: string | null }> => {
  const list: Array<{ stampKey: StampKey; count: number; mine: string | null }> = [];
  for (const stampKey of STAMP_KEYS) {
    const same = rows.filter((r) => r.stampKey === stampKey);
    if (same.length > 0) list.push({ stampKey, count: same.length, mine: same.find((r) => r.userId === userId)?.id ?? null });
  }
  return list;
};
