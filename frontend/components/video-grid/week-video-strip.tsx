'use client';

import { useRouter } from 'next/navigation';
import { useGetVideosThisWeek, type VideoWeekResponse } from '@/lib/api/generated';
import { VIDEO_GRID_MESSAGES } from './messages';
import { ShootButton } from './shoot-button';
import { VideoGrid, type VideoGridItem } from './video-grid';

// 仲間タブの「今週の2秒動画」（台帳 A14-2。#373 で外し、#438 で「1本以上ある週だけ出す」形で戻した）。GET /videos/week をそのまま VideoGrid の strip に渡す。
// 0本の週・読み込み中・失敗のときは何も出さない（足跡の邪魔をしない。動画は足跡カードからも見られる）。
// 見られる条件（その週に自分が1本撮った人だけ仲間の動画が見える）は API の unlocked と GET /videos/{id}/url が守る。ここでは決めない
export function WeekVideoStrip() {
  const router = useRouter();
  const { data } = useGetVideosThisWeek();
  if (data?.status !== 200 || data.data.items.length === 0) return null;

  return (
    <section className="space-y-2">
      <h2 className="text-lg font-extrabold">{VIDEO_GRID_MESSAGES.stripLabel}</h2>
      <WeekBody week={data.data} onOpen={(href) => router.push(href)} />
    </section>
  );
}

function WeekBody({ week, onOpen }: { week: VideoWeekResponse; onOpen: (href: string) => void }) {
  const items: VideoGridItem[] = week.items.map((v) => ({ id: v.id, label: v.mine ? '自分' : v.author.name, mine: v.mine }));
  const hrefOf = (id: string): string | undefined => {
    const v = week.items.find((x) => x.id === id);
    if (!v) return undefined;
    const rid = encodeURIComponent(v.recordId);
    return v.mine ? `/record-detail?id=${rid}&from=me` : `/record-detail?id=${rid}&by=${encodeURIComponent(v.author.id)}`;
  };
  const hasOthers = week.items.some((v) => !v.mine);
  return (
    <>
      <VideoGrid
        items={items}
        layout="strip"
        locked={!week.unlocked}
        onSelect={(id) => {
          const href = hrefOf(id);
          if (href) onOpen(href);
        }}
      />
      {!week.unlocked && hasOthers ? (
        <div className="space-y-2">
          <p className="text-sm font-bold text-fg-muted">{VIDEO_GRID_MESSAGES.lockedNote}</p>
          <ShootButton />
        </div>
      ) : null}
    </>
  );
}
