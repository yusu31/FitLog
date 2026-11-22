import Link from 'next/link';
import type { ReactNode } from 'react';
import { cn } from 'cn';

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

// 登録画面の上の帯の中身。ロゴと一言だけ（入力欄を画面の上のほうに置くため。D1）。大見出し（h1）は「何ができるか」の一文
export function SignupHero() {
  return (
    <>
      <span className="fl-tag bg-gold text-fg">フィットログ</span>
      <h1 className="mt-2 text-page-title leading-tight font-extrabold">前回の自分と並べて記録</h1>
    </>
  );
}

// ログイン・新規登録の枠（S-01・S-02）。上にアプリ名の帯（中身の hero は呼ぶ側が決める）、下にフォーム。幅は 430px までで中央に寄せる。
// ログインか登録かは、フォームの上の見出し（h2）で伝える。3行の紹介文は置かない（D1・判断ログ 65）
export function AuthLayout({ title, hero, children }: { title: string; hero: ReactNode; children: ReactNode }) {
  return (
    <div className="min-h-dvh bg-line">
      <main className="mx-auto flex min-h-dvh max-w-[430px] flex-col bg-canvas">
        <header className="fl-stripes relative overflow-hidden bg-teal-dark [--stripe:rgb(0_0_0/0.14)] px-6 pt-10 pb-6 text-white">{hero}</header>
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
