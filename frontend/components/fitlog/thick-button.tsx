import type { ComponentProps } from 'react';
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

// ボタンの型は3つ（A13-3）。主＝その画面でいちばん大事な1つ／副＝ほかの選択肢／文字リンク＝戻る・やめるなど軽い操作。
// variant を渡すと tone より優先する。渡さなければ従来どおり tone で決まる（画面の置き換えは後の束で進める）
const variants = {
  primary: { tone: 'teal', link: false },
  secondary: { tone: 'white', link: false },
  link: { tone: 'teal', link: true },
} as const;

const linkClass = 'min-h-11 px-2 text-sm font-bold text-teal-dark underline underline-offset-4 decoration-2 hover:text-teal-deep';

// ComponentProps にして ref（React 19 では props として渡せる）も受ける。確認ダイアログが最初のフォーカス先を決めるのに使う
type Props = ComponentProps<'button'> & {
  variant?: keyof typeof variants;
  tone?: keyof typeof tones;
  size?: keyof typeof sizes;
};

export function ThickButton({ variant, tone = 'teal', size = 'lg', className, type = 'button', ...props }: Props) {
  const v = variant ? variants[variant] : undefined;
  const isLink = v?.link === true;
  return (
    <button
      type={type}
      className={cn(
        'inline-flex items-center justify-center gap-2 outline-none',
        'focus-visible:ring-4 focus-visible:ring-teal/40 disabled:cursor-not-allowed disabled:opacity-60',
        '[&_svg]:size-5 [&_svg]:shrink-0',
        isLink
          ? linkClass
          : ['fl-thick rounded-fl font-extrabold', tones[v ? v.tone : tone], sizes[size]],
        className,
      )}
      {...props}
    />
  );
}
