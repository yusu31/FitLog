'use client';

import { ChevronLeft } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';
import { FullScreen } from '@/components/fitlog/full-screen';
import { buttonClass, ThickButton } from '@/components/fitlog/thick-button';
import { GPS_NOTICE_SEEN_KEY } from '@/lib/gps/device';
import { useRequireSession } from '@/lib/use-require-session';
import { DISMISSED_KEY, DISMISS_EVENT } from './add-to-home';

// よくある質問。答えは今の画面の動きに合わせる（変えたらここも直す）
export const FAQ: readonly { q: string; a: string }[] = [
  { q: '「前回の自分」と並べるって、どういうこと？', a: '種目ごとに、前回の重さと回数が入った状態で始まります。同じなら「できた」を1回押すだけで記録できます。数字を変えたいときは＋と−で動かします。' },
  { q: '記録しない日があってもいい？', a: 'はい。連続日数は数えません。今週の7マスで、動いた日を眺めるだけです。休んだ日は「おやすみ」として残すこともできます。' },
  { q: '間違えて記録したときは？', a: 'セットの横の「…」から削除できます。記録の編集はないので、消して入れ直してください。' },
  { q: '仲間には何が見える？', a: '同じグループ（最大5人）の仲間には、記録した種目と数字、足跡が見えます。体重と身長は自分だけに見えます。' },
  { q: 'ランの記録はどうやって入れる？', a: '中央の ● を押して「ラン」を選び、スマホの位置情報で記録するか、GPX ファイルを取り込みます。ブラウザの画面を消すと止まる端末では、画面を点けたままにしてください。' },
  { q: '電波のない場所でも使える？', a: '記録は端末に先にたまり、電波が戻ると送られます。画面の上の帯で、送信待ちの数が分かります。' },
  { q: 'kg を lb にしたい', a: '設定の「重さの単位」で切り替えます。表示だけが変わり、記録は kg のまま保存されます。lb で入れるときは 5lb ずつ動き、kg に直して保存します。' },
  { q: 'アプリを開いたとき、今日ではなく仲間を最初に見たい', a: '設定の「最初に開くタブ」で、今日か仲間を選べます。' },
  { q: 'パスワードを忘れた', a: 'パスワードの再設定の機能はありません。グループの管理者に連絡してください。' },
  { q: 'やめたいとき', a: '設定の「アカウント」にある「退会の手続きへ」から、パスワードを入れて退会できます。記録は消えます。元には戻せません。' },
];

// ヘルプ・使い方（設定から開く）。よくある質問と、初回の案内をもう一度見る操作
export function HelpView() {
  useRequireSession();
  const [replayed, setReplayed] = useState(false);

  // 「ホーム画面に追加」の案内と、ランの案内（初回だけ出るもの）を、もう一度出す
  function onReplay() {
    try {
      localStorage.removeItem(DISMISSED_KEY);
      localStorage.removeItem(GPS_NOTICE_SEEN_KEY);
    } catch {
      // 消せない端末では、もともと毎回出る
    }
    window.dispatchEvent(new Event(DISMISS_EVENT));
    setReplayed(true);
  }

  return (
    <FullScreen>
      <header className="flex items-center gap-1 px-2 pt-3">
        <Link
          href="/settings"
          aria-label="設定へ戻る"
          className={buttonClass({ variant: 'icon' }, '[&_svg]:size-7')}
        >
          <ChevronLeft aria-hidden className="size-7" />
        </Link>
        <h1 className="text-page-title font-extrabold">ヘルプ・使い方</h1>
      </header>

      <div className="space-y-5 px-4 pt-3 pb-10">
        <section aria-labelledby="help-faq" className="space-y-2">
          <h2 id="help-faq" className="text-note font-bold tracking-widest text-fg-subtle">
            よくある質問
          </h2>
          <ul className="space-y-2">
            {FAQ.map(({ q, a }) => (
              <li key={q}>
                <details className="fl-slab px-4 py-1">
                  <summary className="flex min-h-12 cursor-pointer items-center font-extrabold outline-none focus-visible:ring-4 focus-visible:ring-teal/40">{q}</summary>
                  <p className="pt-1 pb-3 text-sm leading-relaxed">{a}</p>
                </details>
              </li>
            ))}
          </ul>
        </section>

        <section aria-labelledby="help-replay" className="fl-slab space-y-2 px-4 py-3">
          <h2 id="help-replay" className="font-extrabold">
            初回の案内をもう一度見る
          </h2>
          <p className="text-note text-fg-muted">「ホーム画面に追加」の案内と、ランの最初の案内を、もう一度出します</p>
          <ThickButton tone="white" size="sm" className="w-full" onClick={onReplay}>
            案内をもう一度出す
          </ThickButton>
          {replayed && (
            <p role="status" className="text-sm font-bold text-fg">
              出すようにしました。設定とランの画面で見られます
            </p>
          )}
        </section>
      </div>
    </FullScreen>
  );
}
