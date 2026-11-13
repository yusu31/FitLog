import { cn } from 'cn';
import { AVATAR_BG } from '@/components/friends/member-list';
import { FRIEND_MESSAGES, RECORD_MESSAGES } from '@/lib/messages';
import { volumeOf, type SetValue } from '@/lib/shared/ghost';

// バーの長さに使う量。重量が両方あれば 重量×回数、自重（0kg）が混じるときは回数
const amount = (s: SetValue, bothWeighted: boolean) => (bothWeighted ? volumeOf(s) : s.reps);

// 前回のバー（features.md 2.5・prototype/v8 の .cmp）。前回の値と今回の値を並べて見せる。
// 前回の記録が無く、種目のお試し値のときは「お試し」の札を付ける
// 選んだ仲間（F-16）は「仲間」の行に、記録の位置へアイコンで置く。数字はアイコンの上に小さく出す
export type BarFriend = { id: string; name: string; shirtColor: string; value: SetValue };

export function GhostBar({ ghost, current, isTrial, friends = [], label = '前回のじぶん' }: { ghost: SetValue | null; current: SetValue; isTrial: boolean; friends?: BarFriend[]; label?: string }) {
  const all = [ghost, current, ...friends.map((f) => f.value)].filter((v): v is SetValue => !!v);
  const both = all.every((v) => v.weightKg > 0);
  const b = amount(current, both);
  const a = ghost ? amount(ghost, both) : 0;
  const max = Math.max(a, b, ...friends.map((f) => amount(f.value, both)), 1) * 1.15;
  if (!ghost) {
    return (
      <div role="group" aria-label="前回との くらべ" className="w-full rounded-fl border-2 border-b-4 border-line bg-face px-4 py-3">
        <p className="text-sm font-bold text-sub-strong">{RECORD_MESSAGES.noPrevious}</p>
        <FriendRow friends={friends} both={both} max={max} />
      </div>
    );
  }
  return (
    <div role="group" aria-label="前回との くらべ" className="w-full rounded-fl border-2 border-b-4 border-line bg-face px-4 py-3">
      <div className="mb-2 flex items-baseline justify-between text-xs text-sub-strong">
        <span className="flex items-center gap-2">
          {label}
          {isTrial && <span className="fl-tag bg-line-dark !py-0 !text-xs !leading-4 text-ink">{RECORD_MESSAGES.trial}</span>}
        </span>
        <span className="fl-num text-[22px] text-ink">
          {ghost.weightKg}kg × {ghost.reps}回
        </span>
      </div>
      <Row label="前回" pct={(a / max) * 100} tone="bg-[repeating-linear-gradient(-45deg,var(--color-line)_0_6px,var(--color-line-dark)_6px_12px)]" />
      <Row label="今回" pct={(b / max) * 100} tone="bg-[repeating-linear-gradient(-45deg,var(--color-teal)_0_6px,var(--color-teal-dark)_6px_12px)]" />
      <FriendRow friends={friends} both={both} max={max} />
    </div>
  );
}

function Row({ label, pct, tone }: { label: string; pct: number; tone: string }) {
  return (
    <div className="mt-1.5 flex items-center gap-2.5 text-[11px] text-sub-strong">
      <span className="w-8">{label}</span>
      <div className="h-3 flex-1 -skew-x-[14deg] overflow-hidden rounded bg-white">
        <i className={cn('block h-full transition-[width] duration-300 motion-reduce:transition-none', tone)} style={{ width: `${Math.min(100, pct)}%` }} />
      </div>
    </div>
  );
}

function FriendRow({ friends, both, max }: { friends: BarFriend[]; both: boolean; max: number }) {
  if (friends.length === 0) return null;
  return (
    <div className="mt-1.5 flex items-end gap-2.5 text-[11px] text-sub-strong">
      <span className="w-8 pb-0.5">{FRIEND_MESSAGES.rowLabel}</span>
      <div className="relative h-10 flex-1 overflow-visible">
        {friends.map((f) => (
          <span
            key={f.id}
            data-testid={`friend-marker-${f.id}`}
            className="absolute bottom-0 flex -translate-x-1/2 flex-col items-center"
            style={{ left: `${Math.min(100, (amount(f.value, both) / max) * 100)}%` }}
          >
            <span className="fl-num text-[10px] leading-none whitespace-nowrap text-ink">
              {f.value.weightKg}kg×{f.value.reps}
            </span>
            <span aria-label={f.name} className="mt-0.5 flex size-5 items-center justify-center rounded-full text-[10px] font-extrabold text-white" style={{ background: AVATAR_BG[f.shirtColor] ?? AVATAR_BG.navy }}>
              {Array.from(f.name)[0]}
            </span>
          </span>
        ))}
      </div>
    </div>
  );
}
