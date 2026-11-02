import { ghostDiff } from '@/lib/record-flow';
import { compareSet, isPersonalBest, volumeOf, type GhostResult, type SetValue } from '@/lib/shared/ghost';

// 記録の詳細（S-21）で、各セットの「ゴーストの結果」と「ベスト」を画面で出す。
// 記録した時点のゴースト（前回の同じセット番号）と、その時点までの自己ベストと比べ直す。
// 比べ方は S-12 と同じ関数（shared/ghost）を使う。

export type SetOutcome = { result: GhostResult | null; diff: number; isBest: boolean };

type Numbered = SetValue & { setNo: number };

// sets: この記録の1種目のセット（セット番号の順）。previousSets: 前回の同じ種目のセット（無ければ null）。
// pastMaxVolume: その記録より前の自己ベストの volume（無ければ null）。
// 前回に同じ番号のセットが無ければ、比べる相手がいないので result は null（「記録したよ」）
export function setOutcomes(sets: Numbered[], previousSets: Numbered[] | null, pastMaxVolume: number | null): SetOutcome[] {
  let max = pastMaxVolume;
  return sets.map((s) => {
    const prev = previousSets?.find((p) => p.setNo === s.setNo) ?? null;
    const outcome: SetOutcome = {
      result: prev ? compareSet(prev, s) : null,
      diff: prev ? ghostDiff(prev, s) : 0,
      isBest: isPersonalBest(s, max),
    };
    max = max === null ? volumeOf(s) : Math.max(max, volumeOf(s));
    return outcome;
  });
}
