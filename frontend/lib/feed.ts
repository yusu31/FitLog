// 仲間タブ（S-20）の足跡・スタンプ・コメントの決まりごと（docs/screen-design.md「スタンプと定型コメント（F-10）」）。
// 画面の部品から切り離した純粋な関数・定数。順位・数を競う言い方は入れない。
import { formatDistance } from '@/lib/format';
import type { FeedItem, FeedItemKind, FeedStamp, FeedTotals } from '@/lib/api/generated';

export type StampKey = FeedStamp['stampKey'];

// 記録の種類ごとに付けられるスタンプ（キーは DB の reactions.stamp_key。表示順もこの順）
export const STAMP_KEYS: Record<FeedItemKind, readonly StampKey[]> = {
  workout: ['nice', 'fire', 'clap', 'smile'],
  run: ['nice', 'fire', 'clap', 'smile'],
  rest: ['rest_slow', 'rest_again'],
};

export const STAMP_LABELS: Record<StampKey, string> = {
  nice: 'ナイス',
  fire: 'すごい',
  clap: 'おつかれ',
  smile: 'いいね',
  rest_slow: 'ゆっくりね',
  rest_again: 'またあした',
};

// 定型コメント（本文そのまま保存する）
export const QUICK_COMMENTS: Record<FeedItemKind, readonly string[]> = {
  workout: ['ナイス！', 'いい調子！', 'おつかれさま', '今度いっしょにやろう'],
  run: ['ナイス！', 'いい調子！', 'おつかれさま', '今度いっしょにやろう'],
  rest: ['ゆっくり休んでね', 'また一緒にやろう'],
};

export const COMMENT_MAX = 50;

// コメントの本文を整える。前後の空白を除き、1〜50字（見た目の1文字を1と数える。API と同じ数え方）。
// 範囲外のときは null（送らない）
export function normalizeComment(raw: string): string | null {
  const body = raw.trim();
  const length = Array.from(body).length;
  return length >= 1 && length <= COMMENT_MAX ? body : null;
}

// 12400 → "12,400kg"（小数は四捨五入）
export const formatVolumeKg = (kg: number): string => `${Math.round(kg).toLocaleString('en-US')}kg`;

export type TotalsView = { empty: boolean; recorded: string; volume: string; distance: string };

// 週の合計の見せ方。だれも記録していない週は empty（数字ではなく一言を出す）
export function describeTotals(totals: FeedTotals): TotalsView {
  return {
    empty: totals.recordedUserCount <= 0,
    recorded: `${totals.recordedUserCount}人が記録`,
    volume: formatVolumeKg(totals.totalVolumeKg),
    distance: formatDistance(totals.totalDistanceM),
  };
}

// 足跡の1行目（何をしたか）。筋トレは最初の種目名＋「ほかN種目」
export function describeItem(item: Pick<FeedItem, 'kind' | 'exerciseNames' | 'run'>): { title: string; detail: string } {
  if (item.kind === 'rest') return { title: 'おやすみ', detail: '' };
  if (item.kind === 'run') return { title: 'ラン', detail: item.run ? formatDistance(item.run.distanceM) : '' };
  const [first, ...rest] = item.exerciseNames;
  if (!first) return { title: '筋トレ', detail: '' };
  return { title: first, detail: rest.length > 0 ? `ほか${rest.length}種目` : '' };
}

// そのスタンプの現在の状態（付いた人の数・自分が付けているか）。誰も付けていなければ count 0
export function stampState(stamps: readonly FeedStamp[], key: StampKey): { count: number; mine: string | null } {
  const found = stamps.find((s) => s.stampKey === key);
  return { count: found?.count ?? 0, mine: found?.mine ?? null };
}
