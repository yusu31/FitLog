import { cn } from 'cn';
import { RECORD_MESSAGES } from '@/lib/messages';
import { volumeOf, type SetValue } from '@/lib/shared/ghost';

// バーの長さに使う量。重量が両方あれば 重量×回数、自重（0kg）が混じるときは回数
const amount = (s: SetValue, bothWeighted: boolean) => (bothWeighted ? volumeOf(s) : s.reps);

// 前回のバー（features.md 2.5・prototype/v8 の .cmp）。前回の値と今回の値を並べて見せる。
// 前回の記録が無く、種目のお試し値のときは「お試し」の札を付ける
export function GhostBar({ ghost, current, isTrial }: { ghost: SetValue | null; current: SetValue; isTrial: boolean }) {
  if (!ghost) {
    return (
      <div role="group" aria-label="前回との くらべ" className="w-full rounded-fl border-2 border-b-4 border-line bg-face px-4 py-3">
        <p className="text-sm font-bold text-sub-strong">{RECORD_MESSAGES.noPrevious}</p>
      </div>
    );
  }
  const both = ghost.weightKg > 0 && current.weightKg > 0;
  const a = amount(ghost, both);
  const b = amount(current, both);
  const max = Math.max(a, b, 1) * 1.15;
  return (
    <div role="group" aria-label="前回との くらべ" className="w-full rounded-fl border-2 border-b-4 border-line bg-face px-4 py-3">
      <div className="mb-2 flex items-baseline justify-between text-xs text-sub-strong">
        <span className="flex items-center gap-2">
          前回のじぶん
          {isTrial && <span className="fl-tag bg-line-dark !py-0 !text-xs !leading-4 text-ink">{RECORD_MESSAGES.trial}</span>}
        </span>
        <span className="fl-num text-[22px] text-ink">
          {ghost.weightKg}kg × {ghost.reps}回
        </span>
      </div>
      <Row label="前回" pct={(a / max) * 100} tone="bg-[repeating-linear-gradient(-45deg,var(--color-line)_0_6px,var(--color-line-dark)_6px_12px)]" />
      <Row label="今回" pct={(b / max) * 100} tone="bg-[repeating-linear-gradient(-45deg,var(--color-teal)_0_6px,var(--color-teal-dark)_6px_12px)]" />
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
