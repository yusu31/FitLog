'use client';

import { Avatar } from '@/components/fitlog/avatar';
import { FeedBand } from '@/components/friends/feed-media';
import { StampChip } from '@/components/friends/stamp-button';
import { DEMO_FRIENDS } from '@/lib/demo-friends';
import { describeItem } from '@/lib/feed';
import { DEMO_FRIENDS_MESSAGES } from '@/lib/messages';

// 「デモ仲間 有り」のときだけ、ホームのタイムラインの上に出す仲間の足跡の見本（02-9 ⑭）。触れない（スタンプ・コメント・詳細へのリンクは置かない）。
// 本物と混ざらないよう、各カードに「見本」の札を付け、見出しでも見本と言う
export function DemoFriends() {
  return (
    <section aria-label={DEMO_FRIENDS_MESSAGES.label} data-testid="demo-friends" className="space-y-2">
      <div className="rounded-fl bg-gold-light px-4 py-3">
        <p className="text-sm font-extrabold">{DEMO_FRIENDS_MESSAGES.title}</p>
        <p className="mt-1 text-note leading-relaxed font-bold text-fg-muted">{DEMO_FRIENDS_MESSAGES.lead}</p>
      </div>
      <ul aria-label={DEMO_FRIENDS_MESSAGES.listLabel} className="space-y-2">
        {DEMO_FRIENDS.map(({ item, note }) => {
          const { title, detail } = describeItem(item);
          return (
            <li key={item.id} className="fl-slab space-y-3 px-4 py-4">
              <div className="flex items-center gap-3">
                <Avatar avatar={item.author.avatar} size={44} />
                <p className="min-w-0 flex-1 truncate text-[15px] leading-tight font-extrabold">{item.author.name}</p>
                <span className="rounded-full bg-gold-light px-2.5 py-0.5 text-note font-extrabold text-fg">{DEMO_FRIENDS_MESSAGES.tag}</span>
              </div>
              <FeedBand item={item} title={title} detail={detail} thin={item.kind === 'rest'} />
              <p className="text-base font-bold">{note}</p>
              <ul aria-label={`${item.author.name}へのスタンプ`} className="flex flex-wrap gap-1.5">
                {item.stamps.map((s) => (
                  <li key={s.stampKey}>
                    <StampChip stampKey={s.stampKey} count={s.count} />
                  </li>
                ))}
              </ul>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
