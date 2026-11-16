import type { ReactNode } from 'react';

// ログイン前の紹介（F8）。柱の2つと、責めない方針を1行ずつ
const INTRO_LINES = [
  '前回の自分と並べて、前回値入りの「できた」1タップで記録',
  '最大5人の仲間と、足跡・スタンプ・コメントで見せ合う',
  '連続日数はなし。休んだ日を責めない「今週の7マス」',
];

// ログイン・新規登録の枠（S-01・S-02）。上にアプリ名の帯、下にフォーム。幅は 430px までで中央に寄せる
export function AuthLayout({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="min-h-dvh bg-[#e9ecef]">
      <main className="mx-auto flex min-h-dvh max-w-[430px] flex-col bg-white">
        <header className="fl-stripes relative overflow-hidden bg-teal-dark [--stripe:rgb(0_0_0/0.14)] px-6 pt-12 pb-8 text-white">
          <span className="fl-tag bg-gold text-ink">FITLOG</span>
          <p className="mt-3 text-sm font-bold">前回の自分と、仲間と。筋トレとランの記録</p>
          <h1 className="mt-6 text-[28px] leading-tight font-extrabold">{title}</h1>
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
        <div className="flex flex-1 flex-col gap-6 px-6 pt-6 pb-10">{children}</div>
      </main>
    </div>
  );
}
