'use client';

import { ChevronLeft } from 'lucide-react';
import Link from 'next/link';
import { FullScreen } from '@/components/fitlog/full-screen';
import { CREDIT_PARTS, CREDIT_SOURCE_URL } from '@/lib/credits-data';
import { useRequireSession } from '@/lib/use-require-session';

// S-34 クレジット（docs/screen-design.md 1章・F-33）。キャラ素材（LPC）のライセンスが作者表示を求めるため、
// キャラを出すなら必ず置く。作者・ライセンス・配布元の URL・加工した旨を載せる
export function CreditsView() {
  useRequireSession();
  return (
    <FullScreen>
      <header className="flex items-center gap-1 px-2 pt-3">
        <Link
          href="/settings"
          aria-label="設定へ戻る"
          className="flex size-11 items-center justify-center rounded-fl text-sub-strong outline-none focus-visible:ring-4 focus-visible:ring-teal/40"
        >
          <ChevronLeft aria-hidden className="size-7" />
        </Link>
        <h1 className="text-[28px] font-extrabold">クレジット</h1>
      </header>

      <div className="space-y-5 px-4 pt-3 pb-10">
        <section aria-labelledby="credits-chara" className="fl-slab space-y-2 px-4 py-3">
          <h2 id="credits-chara" className="font-extrabold">
            キャラクターの素材
          </h2>
          <p className="text-sm leading-relaxed">
            アプリの中のドット絵のキャラは、Liberated Pixel Cup（LPC）の素材で作っています。配布元:{' '}
            <a href={CREDIT_SOURCE_URL} target="_blank" rel="noopener noreferrer" className="font-bold break-all text-teal-dark underline">
              Universal LPC Spritesheet Character Generator
            </a>
          </p>
          <p className="text-sm leading-relaxed">
            各部品は複数のライセンスから選べるため、作者の表示だけが条件のもの（OGA-BY 3.0・CC-BY 4.0・CC0）を選んで使っています。
            この素材から、色（ティール・紺・白・茶）の塗り替え、コマの切り出し、小物（ダンベル・星・クッション・マグ・ハート・太陽・後光・メダル）の描き足しをしました。
          </p>
        </section>

        <section aria-labelledby="credits-parts">
          <h2 id="credits-parts" className="pb-2 text-xs font-bold tracking-widest text-sub">
            部品ごとの作者とライセンス
          </h2>
          <ul className="space-y-2">
            {CREDIT_PARTS.map((p) => (
              <li key={p.part} className="fl-slab px-4 py-2.5">
                <p className="text-sm font-extrabold break-all">{p.part}</p>
                <p className="text-xs font-bold text-teal-dark">{p.license}</p>
                <p className="text-xs leading-relaxed text-sub-strong">{p.authors}</p>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </FullScreen>
  );
}
