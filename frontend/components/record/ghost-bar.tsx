import { cn } from 'cn';
import { AVATAR_BG } from '@/components/friends/member-list';
import { formatSetWithReps } from '@/lib/format';
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
      <div role="group" aria-label="前回との くらべ" className="w-full rounded-fl border-2 border-b-4 border-line bg-canvas px-4 py-3">
        <p className="text-sm font-bold text-fg-muted">{RECORD_MESSAGES.noPrevious}</p>
        <FriendRow friends={friends} both={both} max={max} />
      </div>
    );
  }
  return (
    <div role="group" aria-label="前回との くらべ" className="w-full rounded-fl border-2 border-b-4 border-line bg-canvas px-4 py-3">
      {/* D3-6: 前回の数字は下の「前回」の行に出すので、見出しには出さない（同じ数字が3行並んでいた） */}
      <div className="mb-1 flex items-center gap-2 text-note text-fg-muted">
        {label}
        {isTrial && <span className="fl-tag bg-line-dark !py-0 !text-note !leading-4 text-fg">{RECORD_MESSAGES.trial}</span>}
      </div>
      <Row label={RECORD_MESSAGES.barPrev} value={formatSetWithReps(ghost)} pct={(a / max) * 100} tone="bg-[repeating-linear-gradient(-45deg,var(--color-line)_0_6px,var(--color-line-dark)_6px_12px)]" />
      <Row label={RECORD_MESSAGES.barNow} value={formatSetWithReps(current)} pct={(b / max) * 100} tone="bg-[repeating-linear-gradient(-45deg,var(--color-teal)_0_6px,var(--color-teal-dark)_6px_12px)]" />
      <FriendRow friends={friends} both={both} max={max} />
    </div>
  );
}

function Row({ label, value, pct, tone }: { label: string; value: string; pct: number; tone: string }) {
  return (
    <div className="mt-1.5 flex items-center gap-2.5 text-note text-fg-muted">
      <span className="w-9 shrink-0 font-bold">{label}</span>
      <div className="h-3 flex-1 -skew-x-[14deg] overflow-hidden rounded bg-surface">
        <i className={cn('block h-full transition-[width] duration-300 motion-reduce:transition-none', tone)} style={{ width: `${Math.min(100, pct)}%` }} />
      </div>
      <span className="fl-num shrink-0 text-sm text-fg">{value}</span>
    </div>
  );
}

function FriendRow({ friends, both, max }: { friends: BarFriend[]; both: boolean; max: number }) {
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
              {f.value.weightKg}kg×{f.value.reps}
            </span>
            <span aria-label={f.name} className="mt-0.5 flex size-5 items-center justify-center rounded-full text-note font-extrabold text-white" style={{ background: AVATAR_BG[f.shirtColor] ?? AVATAR_BG.navy }}>
              {Array.from(f.name)[0]}
            </span>
          </span>
        ))}
      </div>
    </div>
  );
}
