'use client';

import { buttonClass } from '@/components/fitlog/thick-button';
import { ChevronLeft } from 'lucide-react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import type { ReactNode } from 'react';
import { backTarget } from '@/lib/back-target';
import { FullScreen } from '@/components/fitlog/full-screen';

// 利用規約（/terms/）とプライバシーの扱い（/privacy/）。ログイン前の登録画面から開くので、ログインは要らない（useRequireSession を呼ばない）。
// 個人が学習のために作った最大5人の招待制アプリ向けの、やさしい言葉の約束事。書いてあることは実装の事実だけにする（D1 PR-2・判断ログ 65）
function LegalPage({ title, lead, children }: { title: string; lead: string; children: ReactNode }) {
  // 設定から開いたら設定へ戻す（N2。ログイン中に登録画面へ戻ると、ログアウトしたように見える）
  const back = backTarget(useSearchParams().get('back'), ['settings'], { href: '/signup', label: '登録画面へ戻る' });
  return (
    <FullScreen>
      <header className="flex items-center gap-1 px-2 pt-3">
        <Link
          href={back.href}
          aria-label={back.label}
          className={buttonClass({ variant: 'icon' }, '[&_svg]:size-7')}
        >
          <ChevronLeft aria-hidden className="size-7" />
        </Link>
        <h1 className="text-page-title font-extrabold">{title}</h1>
      </header>
      <div className="space-y-4 px-4 pt-3 pb-10">
        <p className="text-sm leading-relaxed text-fg-muted">{lead}</p>
        {children}
      </div>
    </FullScreen>
  );
}

function Item({ id, heading, children }: { id: string; heading: string; children: ReactNode }) {
  return (
    <section aria-labelledby={id} className="fl-slab space-y-2 px-4 py-3">
      <h2 id={id} className="font-extrabold">
        {heading}
      </h2>
      <div className="space-y-2 text-sm leading-relaxed">{children}</div>
    </section>
  );
}

export function TermsView() {
  return (
    <LegalPage title="利用規約" lead="FitLog を使うときの約束です。登録すると、この内容に同意したことになります。">
      <Item id="terms-what" heading="このアプリについて">
        <p>FitLog は、個人が学習のために作った、筋トレとランの記録アプリです。最大5人の招待制で、仲間と見せ合うために使います。</p>
      </Item>
      <Item id="terms-rules" heading="お願いしたいこと">
        <ul className="list-disc space-y-1 pl-5">
          <li>ほかの人になりすまさないでください</li>
          <li>仲間が嫌な思いをする内容（言葉・動画）を送らないでください</li>
          <li>招待リンクを、知らない人に渡さないでください</li>
        </ul>
      </Item>
      <Item id="terms-visible" heading="仲間に見える範囲">
        <p>
          記録の足跡（種目・距離・時間）・スタンプ・コメントは、同じグループの仲間に見えます。2秒動画は、記録した週の日曜までの間、仲間が見られます（自分も今週1本撮ったときだけ）。体重は自分だけが見られます。
        </p>
      </Item>
      <Item id="terms-disclaimer" heading="できないこと・お断り">
        <ul className="list-disc space-y-1 pl-5">
          <li>医療や健康の助言ではありません。体の不調があるときは、無理をせず医師に相談してください</li>
          <li>予告なく内容を変えたり、止めたりすることがあります。記録が消えることもあるので、大事な数字は別に控えてください</li>
          <li>パスワードを忘れたときの再設定の機能はありません。グループの管理者に連絡してください</li>
        </ul>
      </Item>
      <Item id="terms-leave" heading="やめるとき">
        <p>設定の一番下の「退会の手続きへ」から退会できます。退会すると、記録・スタンプ・コメント・体重など自分のデータが消えます（すぐに、元に戻せません）。</p>
      </Item>
    </LegalPage>
  );
}

export function PrivacyView() {
  return (
    <LegalPage title="プライバシーの扱い" lead="FitLog が、どんな情報を何のために使うかの説明です。">
      <Item id="privacy-collect" heading="集める情報">
        <ul className="list-disc space-y-1 pl-5">
          <li>登録のとき: 表示名・メールアドレス・パスワード（パスワードは元に戻せない形に変えて保存します）</li>
          <li>記録したとき: 筋トレ（種目・重さ・回数）・ラン（距離・時間・走った道すじ）・休み・体重・2秒動画</li>
          <li>グループのとき: 参加しているグループ・つけたスタンプ・書いたコメント</li>
        </ul>
      </Item>
      <Item id="privacy-use" heading="使う目的">
        <p>記録を前回と並べて見せるため、仲間と見せ合うため、ログインを確かめるためだけに使います。広告や、利用状況の分析のために使うことはありません。</p>
      </Item>
      <Item id="privacy-share" heading="だれに見えるか">
        <p>同じグループの仲間だけです。グループの外の人には見えません。体重は自分だけです。第三者に売ったり、渡したりしません。</p>
      </Item>
      <Item id="privacy-store" heading="どこに保存するか">
        <p>
          データは、クラウド（Amazon Web Services）のデータベースと保存場所に置きます。ログインの状態を保つため、端末には Cookie（ログインの印）を保存します。
        </p>
      </Item>
      <Item id="privacy-delete" heading="消したいとき">
        <p>設定の一番下の「退会の手続きへ」から退会すると、自分のデータが消えます。コメントや記録を1件ずつ消すこともできます。</p>
      </Item>
    </LegalPage>
  );
}
