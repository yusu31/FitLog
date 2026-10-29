import type { ButtonHTMLAttributes } from 'react';
import { cn } from 'cn';

// 厚みボタン（docs/screen-design.md 6章）。押すと沈む。タップできる大きさは 44px 以上。
// 白文字を載せる背景は、コントラスト比 4.5 以上の濃い色にする（teal は濃ティール、coral は濃いコーラル）。
const tones = {
  teal: 'bg-teal-dark text-white [--thick:var(--color-teal-deep)]',
  gold: 'bg-gold text-ink [--thick:var(--color-gold-dark)]',
  white: 'border-2 border-teal-light bg-white text-teal-dark [--thick:#b8e3e4]',
  coral: 'bg-coral-strong text-white [--thick:#8f2a20]',
} as const;

const sizes = {
  lg: 'min-h-14 w-full px-5 text-lg tracking-wider',
  sm: 'min-h-11 px-4 text-sm tracking-wide',
} as const;

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  tone?: keyof typeof tones;
  size?: keyof typeof sizes;
};

export function ThickButton({ tone = 'teal', size = 'lg', className, type = 'button', ...props }: Props) {
  return (
    <button
      type={type}
      className={cn(
        'fl-thick inline-flex items-center justify-center gap-2 rounded-fl font-extrabold outline-none',
        'focus-visible:ring-4 focus-visible:ring-teal/40 disabled:cursor-not-allowed disabled:opacity-60',
        '[&_svg]:size-5 [&_svg]:shrink-0',
        tones[tone],
        sizes[size],
        className,
      )}
      {...props}
    />
  );
}
