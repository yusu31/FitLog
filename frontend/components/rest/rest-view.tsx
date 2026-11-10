'use client';

import Link from 'next/link';
import { FullScreen } from '@/components/fitlog/full-screen';
import { Sprite } from '@/components/fitlog/sprite';
import { REST_MESSAGES } from '@/lib/messages';
import { useRequireSession } from '@/lib/use-require-session';

// S-14 おやすみ（docs/screen-design.md 1章。prototype/v8 の vRest）。
// くつろぐ姿と、責めない一言だけの静かな画面。休んだ日を「できなかった日」にしない（features.md UC-12）
export function RestView() {
  useRequireSession();
  return (
    <FullScreen
      footer={
        <Link
          href="/today"
          className="fl-thick inline-flex min-h-14 w-full items-center justify-center rounded-fl bg-grape-dark text-lg font-extrabold tracking-wider text-white outline-none [--thick:#4b3ba8] focus-visible:ring-4 focus-visible:ring-grape/50"
        >
          {REST_MESSAGES.back}
        </Link>
      }
    >
      <div className="flex flex-1 flex-col items-center justify-center gap-3 px-6 pb-8 text-center">
        <RelaxFigure />
        <h1 className="text-[32px] leading-tight font-extrabold text-grape-dark">{REST_MESSAGES.title}</h1>
        <p className="max-w-[18em] text-sm leading-relaxed text-balance [word-break:auto-phrase] font-bold text-sub-strong">{REST_MESSAGES.body}</p>
      </div>
    </FullScreen>
  );
}

// くつろぐ姿（F-31 の「くつろぎ」ポーズ。prototype/v8）。飾りなので読み上げからは外す。
// コマの切り替えは Sprite が行い、「動きを減らす」設定のときは1コマ目で止める（screen-design.md 6章）
function RelaxFigure() {
  return (
    <div data-testid="rest-figure" aria-hidden="true" className="relative mb-2 leading-none">
      <span className="absolute bottom-2 left-1/2 -z-0 h-10 w-56 -translate-x-1/2 rounded-[50%] bg-[#ece8fd]" />
      <Sprite pose="relax" size={192} className="relative" />
    </div>
  );
}
