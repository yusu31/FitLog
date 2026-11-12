import { BodyPart } from '@/lib/api/generated';

// 筋肉ヒートマップ（F-12）の色の段階。0=まだ／1=1〜2セット／2=3セット／3=4セット以上（プロトタイプ v8 の凡例に合わせる。docs/features.md 2.10）
export type HeatLevel = 0 | 1 | 2 | 3;

export function heatLevel(sets: number): HeatLevel {
  if (sets <= 0) return 0;
  if (sets <= 2) return 1;
  if (sets === 3) return 2;
  return 3;
}

export const HEAT_COLORS: Record<HeatLevel, string> = { 0: '#E5E7EB', 1: '#8FD4D6', 2: '#17A2A6', 3: '#FFC21A' };

export const HEAT_LEGEND: ReadonlyArray<{ level: HeatLevel; label: string }> = [
  { level: 0, label: 'まだ' },
  { level: 1, label: '1〜2' },
  { level: 2, label: '3' },
  { level: 3, label: '4〜' },
];

export type PartLevels = Record<BodyPart, HeatLevel>;

// セット数（部位ごと）→ 段階（部位ごと）。部位の一覧は API の応答から作る（部位の数を決め打ちしない。T-HEAT-07）
export function levelsOf(parts: ReadonlyArray<{ bodyPart: BodyPart; sets: number }>): PartLevels {
  const levels = Object.fromEntries(Object.values(BodyPart).map((p) => [p, 0])) as PartLevels;
  for (const p of parts) levels[p.bodyPart] = heatLevel(p.sets);
  return levels;
}
