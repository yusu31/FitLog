import Link from 'next/link';
import type { ReactNode } from 'react';
import { cn } from 'cn';
import { Logo } from '@/components/fitlog/logo';

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
      <Logo size={36} withName className="text-lg" />
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
        </div>
      </main>
    </div>
  );
}
