import type { ReactNode } from 'react';

// ログイン・新規登録の枠（S-01・S-02）。上にアプリ名の帯、下にフォーム。幅は 430px までで中央に寄せる
export function AuthLayout({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="min-h-dvh bg-[#e9ecef]">
      <main className="mx-auto flex min-h-dvh max-w-[430px] flex-col bg-white">
        <header className="fl-stripes relative overflow-hidden bg-teal-dark [--stripe:rgb(0_0_0/0.14)] px-6 pt-12 pb-8 text-white">
          <span className="fl-tag bg-gold text-ink">FITLOG</span>
          <p className="mt-3 text-sm font-bold">前回の自分と、仲間と。筋トレとランの記録</p>
          <h1 className="mt-6 text-[28px] leading-tight font-extrabold">{title}</h1>
        </header>
        <div className="flex flex-1 flex-col gap-6 px-6 pt-6 pb-10">{children}</div>
      </main>
    </div>
  );
}
