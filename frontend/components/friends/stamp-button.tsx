import { cn } from 'cn';
import { STAMP_LABELS, type StampKey } from '@/lib/feed';

// スタンプの絵。SNS で見慣れた絵文字にする（Strava の称賛・Facebook の Like に当たる 👍、Instagram の「いいね」に当たる ❤️）。
// キーは DB のまま。絵文字は端末ごとに見た目が少し違うが、意味は同じ
const STAMP_EMOJI: Record<StampKey, string> = {
  nice: '👍',
  fire: '🔥',
  clap: '👏',
  smile: '❤️',
  rest_slow: '😌',
  rest_again: '👋',
};

// 足跡カードと記録の詳細で共通。押した状態は枠・背景・aria-pressed の3つで伝える（色だけに頼らない）。
// 読み上げは「ナイス 2」。絵文字は飾りなので外す
export function StampButton({
  stampKey,
  count,
  pressed,
  disabled,
  onClick,
  compact = false,
}: {
  stampKey: StampKey;
  count: number;
  pressed: boolean;
  disabled: boolean;
  onClick: () => void;
  // 足跡カード用。少し小さくする。絵の下の短いことばは、どちらでも見せる（絵だけでは意味が分からない。A04-1）
  compact?: boolean;
}) {
  const label = STAMP_LABELS[stampKey];
  return (
    <button
      type="button"
      aria-pressed={pressed}
      aria-label={count > 0 ? `${label} ${count}` : label}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        'flex items-center justify-center rounded-2xl border-2 outline-none focus-visible:ring-4 focus-visible:ring-teal/40 disabled:opacity-60',
        compact ? 'min-h-14 min-w-14 flex-col gap-0.5 px-2 py-1' : 'min-h-14 min-w-16 flex-col gap-0.5 px-2.5 py-1.5',
        pressed ? 'border-teal-dark bg-teal-light text-teal-deep' : 'border-line bg-white text-sub-strong',
      )}
    >
      <span className="flex items-center gap-1">
        <span aria-hidden data-testid="stamp-emoji" className={cn('leading-none', compact ? 'text-[22px]' : 'text-[26px]')}>
          {STAMP_EMOJI[stampKey]}
        </span>
        {count > 0 && <span className="fl-num text-base">{count}</span>}
      </span>
      <span className="text-note leading-none font-extrabold">{label}</span>
    </button>
  );
}

// 自分の記録にもらったスタンプ。押せない（自分の記録には自分でスタンプを付けない）ので、ボタンにせず絵と数だけ見せる。
// 読み上げは「ナイス 2」
export function StampChip({ stampKey, count }: { stampKey: StampKey; count: number }) {
  const label = STAMP_LABELS[stampKey];
  return (
    <span
      role="img"
      aria-label={`${label} ${count}`}
      className="flex min-h-14 min-w-16 flex-col items-center justify-center gap-0.5 rounded-2xl border-2 border-line bg-white px-2.5 py-1.5 text-sub-strong"
    >
      <span aria-hidden className="flex items-center gap-1">
        <span className="text-[26px] leading-none">{STAMP_EMOJI[stampKey]}</span>
        <span className="fl-num text-base">{count}</span>
      </span>
      <span aria-hidden className="text-note leading-none font-extrabold">
        {label}
      </span>
    </span>
  );
}
