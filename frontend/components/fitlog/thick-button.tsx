import type { ComponentProps } from 'react';
import { cn } from 'cn';

// 厚みボタン（docs/screen-design.md 6章）。押すと沈む。タップできる大きさは 44px 以上。
// 白文字を載せる背景は、コントラスト比 4.5 以上の濃い色にする（teal は濃ティール、coral は濃いコーラル）。
const tones = {
  teal: 'bg-teal-dark text-white [--thick:var(--color-teal-deep)]',
  gold: 'bg-gold text-night [--thick:var(--color-gold-dark)]',
  white: 'bg-teal-light text-brand',
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
  icon: { tone: 'white', link: false },
} as const;

// 立体にするのは主ボタン（teal・gold・coral）だけ。副ボタン（white）は薄い色の面
const FLAT_TONES: readonly string[] = ['white'];
// アイコンだけのボタン（ベル・もどる・とじる）。枠なし・44px。aria-label が必須
const iconClass = 'size-11 shrink-0 rounded-full text-fg-muted hover:bg-teal-light';

const linkClass = 'min-h-11 px-2 text-sm font-bold text-brand underline underline-offset-4 decoration-2 hover:text-brand';

// ComponentProps にして ref（React 19 では props として渡せる）も受ける。確認ダイアログが最初のフォーカス先を決めるのに使う
type Props = ComponentProps<'button'> &
  (
    | { variant: 'icon'; 'aria-label': string; tone?: keyof typeof tones; size?: keyof typeof sizes }
    | { variant?: Exclude<keyof typeof variants, 'icon'>; tone?: keyof typeof tones; size?: keyof typeof sizes }
  );

export function ThickButton({ variant, tone = 'teal', size = 'lg', className, type = 'button', ...props }: Props) {
  const v = variant ? variants[variant] : undefined;
  const isLink = v?.link === true;
  const resolvedTone = v ? v.tone : tone;
  return (
    <button
      type={type}
      className={cn(
        'inline-flex items-center justify-center gap-2 outline-none',
        'focus-visible:ring-4 focus-visible:ring-teal/40 disabled:cursor-not-allowed disabled:opacity-60',
        '[&_svg]:size-5 [&_svg]:shrink-0',
        variant === 'icon'
          ? iconClass
          : isLink
            ? linkClass
            : [FLAT_TONES.includes(resolvedTone) ? 'rounded-fl font-extrabold' : 'fl-thick rounded-fl font-extrabold', tones[resolvedTone], sizes[size]],
        className,
      )}
      {...props}
    />
  );
}
