import { cn } from 'cn';
import { AVATAR_BG } from '@/components/friends/member-list';
import type { FriendGhost } from '@/lib/use-friend-ghosts';
import { FRIEND_MESSAGES } from '@/lib/messages';

// 仲間と くらべる（F-16）。並べる仲間を選ぶボタン（最大4人）。前回が無い仲間はグレーで押せない
export function FriendPicker({ friends, selected, onToggle }: { friends: FriendGhost[]; selected: string[]; onToggle: (id: string) => void }) {
  if (friends.length === 0) return null;
  return (
    <section aria-label={FRIEND_MESSAGES.heading} className="w-full">
      <h2 className="pb-1.5 text-xs font-bold tracking-widest text-sub">{FRIEND_MESSAGES.heading}</h2>
      <ul className="flex flex-wrap gap-2">
        {friends.map((f) => {
          const empty = f.value === null;
          const on = selected.includes(f.id);
          return (
            <li key={f.id}>
              <button
                type="button"
                aria-pressed={on}
                disabled={empty}
                onClick={() => onToggle(f.id)}
                className={cn(
                  'flex min-h-11 items-center gap-2 rounded-full border-2 px-3 text-sm font-extrabold outline-none focus-visible:ring-4 focus-visible:ring-teal/40',
                  on ? 'border-teal-dark bg-teal-light text-ink' : 'border-line bg-white text-ink',
                  empty && 'opacity-50',
                )}
              >
                <span aria-hidden className="flex size-6 items-center justify-center rounded-full text-xs text-white" style={{ background: AVATAR_BG[f.shirtColor] ?? AVATAR_BG.navy }}>
                  {Array.from(f.name)[0]}
                </span>
                {f.name}
                {empty && <span className="text-[11px] font-bold text-sub-strong">{FRIEND_MESSAGES.none}</span>}
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
