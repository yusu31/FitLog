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
}: {
  stampKey: StampKey;
  count: number;
  pressed: boolean;
  disabled: boolean;
  onClick: () => void;
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
        'flex min-h-14 min-w-16 flex-col items-center justify-center gap-0.5 rounded-2xl border-2 px-2.5 py-1.5 outline-none focus-visible:ring-4 focus-visible:ring-teal/40 disabled:opacity-60',
        pressed ? 'border-teal-dark bg-teal-light text-teal-dark' : 'border-line bg-white text-sub-strong',
      )}
    >
      <span className="flex items-center gap-1">
        <span aria-hidden data-testid="stamp-emoji" className="text-[26px] leading-none">
          {STAMP_EMOJI[stampKey]}
        </span>
        {count > 0 && <span className="fl-num text-base">{count}</span>}
      </span>
      <span className="text-[11px] leading-none font-extrabold">{label}</span>
    </button>
  );
}
