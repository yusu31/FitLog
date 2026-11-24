import { ArrowRight } from 'lucide-react';
import { Avatar } from '@/components/fitlog/avatar';
import { formatSet, formatSetWithReps } from '@/lib/format';
import { FRIEND_MESSAGES, RECORD_MESSAGES } from '@/lib/messages';
import { volumeOf, type SetValue } from '@/lib/shared/ghost';
import { useWeightUnit } from '@/lib/use-preferences';

// バーの長さに使う量。重量が両方あれば 重量×回数、自重（0kg）が混じるときは回数
const amount = (s: SetValue, bothWeighted: boolean) => (bothWeighted ? volumeOf(s) : s.reps);

// 前回のバー（features.md 2.5・prototype/v8 の .cmp）。前回の値と今回の値を並べて見せる。
// 前回の記録が無く、種目のお試し値のときは「お試し」の札を付ける
// 選んだ仲間（F-16）は「仲間」の行に、記録の位置へアイコンで置く。数字はアイコンの上に小さく出す
export type BarFriend = { id: string; name: string; shirtColor: string; value: SetValue };

export function GhostBar({ ghost, current, isTrial, friends = [], label = RECORD_MESSAGES.barPrev }: { ghost: SetValue | null; current: SetValue; isTrial: boolean; friends?: BarFriend[]; label?: string }) {
  const unit = useWeightUnit();
  const all = [ghost, current, ...friends.map((f) => f.value)].filter((v): v is SetValue => !!v);
  const both = all.every((v) => v.weightKg > 0);
  const max = Math.max(...all.map((v) => amount(v, both)), 1) * 1.15;
  return (
    <div role="group" aria-label="前回との くらべ" className="w-full rounded-fl border-2 border-b-4 border-line bg-canvas px-4 py-3">
      {ghost ? (
        // D3-6: 「前回 60kg × 8回 → 今回 60kg × 8回」の1行。お試し値のときは前回ではなく「目安」と書く
        <p className="flex flex-wrap items-baseline gap-x-2 text-sm font-bold text-fg-muted">
          <span>{isTrial ? RECORD_MESSAGES.trial : label} </span>
          <span className="fl-num text-fg">{formatSetWithReps(ghost, unit)} </span>
          <ArrowRight aria-hidden className="size-4 self-center" />
          <span>{RECORD_MESSAGES.barNow} </span>
          <span className="fl-num text-fg">{formatSetWithReps(current, unit)}</span>
        </p>
      ) : (
        <p className="text-sm font-bold text-fg-muted">{RECORD_MESSAGES.noPrevious}</p>
      )}
      <FriendRow friends={friends} both={both} max={max} />
    </div>
  );
}

function FriendRow({ friends, both, max }: { friends: BarFriend[]; both: boolean; max: number }) {
  const unit = useWeightUnit();
  if (friends.length === 0) return null;
  return (
    <div className="mt-1.5 flex items-end gap-2.5 text-note text-fg-muted">
      <span className="w-8 pb-0.5">{FRIEND_MESSAGES.rowLabel}</span>
      <div className="relative h-10 flex-1 overflow-visible">
        {friends.map((f) => (
          <span
            key={f.id}
            data-testid={`friend-marker-${f.id}`}
            className="absolute bottom-0 flex -translate-x-1/2 flex-col items-center"
            style={{ left: `${Math.min(100, (amount(f.value, both) / max) * 100)}%` }}
          >
            <span className="fl-num text-note leading-none whitespace-nowrap text-fg">
              {formatSet(f.value, unit).replace(/ /g, '')}
            </span>
            <span aria-label={f.name} role="img" className="mt-0.5 block">
              <Avatar shirtColor={f.shirtColor} size={20} />
            </span>
          </span>
        ))}
      </div>
    </div>
  );
}
