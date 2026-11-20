import Link from 'next/link';
import type { ReactNode } from 'react';
import { cn } from 'cn';

// ログイン前の紹介（F8）。柱の2つと、責めない方針を1行ずつ
const INTRO_LINES = [
  '前回の自分と並べて、前回値入りの「できた」1タップで記録',
  '最大5人の仲間と、足跡・スタンプ・コメントで見せ合う',
  '連続日数はなし。休んだ日を責めない「今週の7マス」',
];

// A01-1: 実画面の見本（静止画。docs/images の画面を public/previews に置いたもの）
const PREVIEWS = [
  { src: '/previews/today.png', alt: '今日の画面の見本', caption: '今日：前回値入りで記録' },
  { src: '/previews/friends.png', alt: '仲間の画面の見本', caption: '仲間：足跡とスタンプ' },
];

// 入口の「塗りのボタン」に見えるリンク（A01-2・N-06）。厚みボタンと同じく押すと沈み、高さは 44px 以上
export const AUTH_LINK_BUTTON =
  'fl-thick inline-flex min-h-11 w-full items-center justify-center rounded-fl border-2 border-teal-light bg-surface px-4 text-base font-extrabold tracking-wide text-brand outline-none [--thick:#b8e3e4] focus-visible:ring-4 focus-visible:ring-teal/40';

export function AuthLinkButton({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link href={href} className={cn(AUTH_LINK_BUTTON)}>
      {children}
    </Link>
  );
}

// ログイン・新規登録の枠（S-01・S-02）。上にアプリ名の帯、下にフォーム。幅は 430px までで中央に寄せる。
// 大見出し（h1）は「何ができるか」の一文。ログインか登録かは、フォームの上の見出し（h2）で伝える
export function AuthLayout({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="min-h-dvh bg-line">
      <main className="mx-auto flex min-h-dvh max-w-[430px] flex-col bg-canvas">
        <header className="fl-stripes relative overflow-hidden bg-teal-dark [--stripe:rgb(0_0_0/0.14)] px-6 pt-12 pb-8 text-white">
          <span className="fl-tag bg-gold text-fg">フィットログ</span>
          <p className="mt-3 text-sm font-bold">筋トレとランの記録アプリ</p>
          <h1 className="mt-6 text-page-title leading-tight font-extrabold">前回の自分と並べて記録。仲間と見せ合う</h1>
          {/* F8: ログイン前の人に、アプリが何かを3行で伝える */}
          <ul aria-label="FitLogでできること" className="mt-4 space-y-1.5 text-[13px] leading-snug font-medium">
            {INTRO_LINES.map((line) => (
              <li key={line} className="flex gap-2">
                <span aria-hidden="true" className="text-gold">●</span>
                <span>{line}</span>
              </li>
            ))}
          </ul>
        </header>
        <div className="flex flex-1 flex-col gap-6 px-6 pt-6 pb-10">
          <h2 className="text-xl font-extrabold">{title}</h2>
          {children}
          <section aria-label="画面の見本" className="mt-2 grid grid-cols-2 gap-3">
            {PREVIEWS.map((p) => (
              <figure key={p.src} className="flex flex-col gap-1.5">
                {/* 静的書き出しでは画像の最適化を使わない（next.config.ts）ので img を使う */}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={p.src}
                  alt={p.alt}
                  width={780}
                  height={1688}
                  loading="lazy"
                  className="h-auto w-full rounded-lg border-2 border-teal-light"
                />
                <figcaption className="text-center text-sm font-bold text-fg-subtle">{p.caption}</figcaption>
              </figure>
            ))}
          </section>
        </div>
      </main>
    </div>
  );
}
