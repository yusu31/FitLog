'use client';

import Link from 'next/link';
import { FullScreen } from '@/components/fitlog/full-screen';
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

// くつろぐ姿（ビーズクッションに座って、月を見ている）。飾りなので読み上げからは外す。
// 眠気の「z」はゆっくり浮かぶ。「動きを減らす」設定のときは止める（screen-design.md 6章）
function RelaxFigure() {
  return (
    <div data-testid="rest-figure" aria-hidden="true" className="relative mb-2 leading-none">
      <span className="absolute bottom-3 left-1/2 -z-0 h-10 w-56 -translate-x-1/2 rounded-[50%] bg-[#ece8fd]" />
      <svg viewBox="0 0 200 170" width="220" height="187" className="relative">
        {/* 月 */}
        <path d="M150 18a26 26 0 1 0 22 40a21 21 0 0 1-22-40z" fill="#ffc21a" />
        {/* クッション */}
        <ellipse cx="86" cy="138" rx="62" ry="22" fill="#8e7cf0" />
        <ellipse cx="86" cy="132" rx="52" ry="16" fill="#a99cf5" />
        {/* 足 */}
        <rect x="88" y="112" width="52" height="16" rx="8" fill="#1e2a3a" />
        <rect x="132" y="116" width="16" height="12" rx="6" fill="#ffd9b8" />
        {/* 体 */}
        <rect x="58" y="74" width="44" height="52" rx="16" fill="#17a2a6" />
        {/* 腕（ひざの上でのんびり） */}
        <rect x="86" y="92" width="40" height="12" rx="6" fill="#0e7f83" />
        {/* 頭 */}
        <circle cx="76" cy="54" r="22" fill="#ffd9b8" />
        <path d="M54 50a22 22 0 0 1 44-6c-8-2-14-8-18-14c-6 10-16 14-26 20z" fill="#1e2a3a" />
        {/* 閉じた目と口 */}
        <path d="M66 56q4 4 8 0M80 56q4 4 8 0" fill="none" stroke="#1e2a3a" strokeWidth="2.5" strokeLinecap="round" />
        <path d="M74 66q5 4 10 0" fill="none" stroke="#1e2a3a" strokeWidth="2.5" strokeLinecap="round" />
        {/* z z */}
        <g fill="#6a57cf" fontWeight="800" fontStyle="italic" fontFamily="sans-serif">
          <text x="108" y="38" fontSize="20" className="motion-safe:animate-pulse">
            z
          </text>
          <text x="124" y="26" fontSize="14" className="motion-safe:animate-pulse">
            z
          </text>
        </g>
      </svg>
    </div>
  );
}
