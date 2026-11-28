import { buttonClass } from '@/components/fitlog/thick-button';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { Logo } from '@/components/fitlog/logo';
import { LoginBackdrop } from '@/components/auth/login-backdrop';

// 入口の「塗りのボタン」に見えるリンク（A01-2・N-06）。副ボタンと同じ見た目

export function AuthLinkButton({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link href={href} className={buttonClass({ variant: 'secondary' })}>
      {children}
    </Link>
  );
}

// 登録画面の上の帯の中身（見本「登録-1」）。明るい地に、実際の画面3枚を少し傾けて重ね、大見出しを下に置く。文字は紺（明るい地なので）。画像は飾り（alt なし）
const SIGNUP_SHOTS = [
  { src: '/auth/shot-1.webp', tilt: '-rotate-6 translate-y-2' },
  { src: '/auth/shot-2.webp', tilt: 'z-10 -mx-3 -translate-y-1' },
  { src: '/auth/shot-3.webp', tilt: 'rotate-6 translate-y-2' },
] as const;

export function SignupHero() {
  return (
    <div data-testid="signup-hero">
      <Logo size={36} withName className="text-lg" />
      <div className="mt-4 flex items-end justify-center" aria-hidden="true">
        {SIGNUP_SHOTS.map((shot) => (
          // eslint-disable-next-line @next/next/no-img-element -- 静的書き出し（画像の最適化は使わない）。飾りの画像
          <img key={shot.src} src={shot.src} alt="" width={112} height={242} className={`relative w-28 rounded-2xl border-2 border-white shadow-[0_8px_0_rgb(0_0_0/0.12)] ${shot.tilt}`} />
        ))}
      </div>
      <h1 className="mt-5 text-page-title leading-tight font-extrabold">前回の自分と並べて記録</h1>
    </div>
  );
}

// ログイン・新規登録の枠（S-01・S-02）。幅は 430px までで中央に寄せる。ログインか登録かは、フォームの上の見出し（h2）で伝える（D1・判断ログ 65）。
// tone="photo"（ログイン）: 上は暗い帯（背景の絵はあとから差し替え）に白い文字、フォームはガラス風のカードにして帯へ重ねる。
// tone="light"（登録）: 上は明るい地に紺の文字。
export function AuthLayout({ title, hero, tone = 'light', children }: { title: string; hero: ReactNode; tone?: 'photo' | 'light'; children: ReactNode }) {
  const body = (
    <>
      <h2 className="text-xl font-extrabold">{title}</h2>
      {children}
    </>
  );
  if (tone === 'photo') {
    return (
      <div className="min-h-dvh bg-line">
        <main className="mx-auto flex min-h-dvh max-w-[430px] flex-col bg-canvas">
          <header className="fl-stripes relative overflow-hidden bg-teal-dark [--stripe:rgb(0_0_0/0.14)] px-6 pt-10 pb-24 text-white">
            <LoginBackdrop />
            <div className="relative">{hero}</div>
          </header>
          <div className="relative z-10 mx-4 -mt-16 mb-8 flex flex-col gap-6 rounded-3xl border border-white/50 bg-surface/90 px-5 pt-6 pb-8 shadow-[0_12px_32px_rgb(0_0_0/0.18)] backdrop-blur-md">{body}</div>
        </main>
      </div>
    );
  }
  return (
    <div className="min-h-dvh bg-line">
      <main className="mx-auto flex min-h-dvh max-w-[430px] flex-col bg-canvas">
        <header className="relative overflow-hidden bg-teal-light px-6 pt-10 pb-6 text-fg">{hero}</header>
        <div className="flex flex-1 flex-col gap-6 px-6 pt-6 pb-10">{body}</div>
      </main>
    </div>
  );
}
