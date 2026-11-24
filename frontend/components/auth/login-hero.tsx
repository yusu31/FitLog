'use client';

import { Logo } from '@/components/fitlog/logo';
import { Sprite } from '@/components/fitlog/sprite';
import { useLastKind } from '@/lib/last-kind';

// ログイン画面の上半分（D1・判断ログ 66）。この端末で最後に保存した運動の種類で、筋トレ版とラン版を切り替える。
// 枠・高さ・並びは同じで、中身だけ替える。筋トレ＝トレーニング中のキャラと前回の重さ、ラン＝走るキャラと薄い「前回の自分」と前回の距離。
// 初めての端末・覚えていないときは筋トレ版。動きを減らす設定のときは Sprite が1コマで止まる。数字は見本（本人の記録ではない）
const VIEW = {
  lift: { lead: '前回の自分と並べて記録', name: 'ベンチプレス · 前回の例', value: '60kg × 8', action: 'できた' },
  run: { lead: '前回の自分と並んで走る', name: 'ラン · 前回の例', value: '5.0km · 5\'41"', action: '前回の自分と走る' },
} as const;

export function LoginHero() {
  const kind = useLastKind();
  const v = VIEW[kind];
  return (
    <div data-testid="login-hero" data-kind={kind}>
      <Logo size={36} withName className="text-lg" />
      <h1 className="mt-2 text-page-title leading-tight font-extrabold">{v.lead}</h1>
      <p className="mt-0.5 text-sm font-bold">仲間と見せ合える</p>
      <div className="mt-3 flex h-24 items-end gap-2">
        <div className="relative -mr-1.5 -mb-4 -ml-2 size-24 shrink-0">
          {kind === 'run' ? (
            <>
              <Sprite pose="run" size={96} className="absolute -left-5 opacity-40 brightness-150 grayscale" />
              <Sprite pose="run" size={96} className="absolute left-0" />
            </>
          ) : (
            <Sprite pose="train" size={96} className="absolute left-0" />
          )}
        </div>
        <div className="grid flex-1 gap-1 rounded-xl bg-surface px-3 py-2 text-note font-bold text-fg shadow-[0_4px_0_rgb(0_0_0/0.18)]">
          <span className="text-fg-muted">{v.name}</span>
          <span className="fl-num text-lg">{v.value}</span>
          <span className="rounded-lg bg-teal-dark py-1 text-center font-extrabold text-white">{v.action}</span>
        </div>
      </div>
    </div>
  );
}
