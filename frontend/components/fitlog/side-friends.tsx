'use client';

import { useSyncExternalStore } from 'react';
import { FriendsToday } from '@/components/today/friends-today';
import { usePhoneView } from '@/lib/phone-view';
import { toLocalDate } from '@/lib/shared/local-date';

// PC（1024px 以上）だけの右の列「仲間の今日」。スマホ幅と「スマホと同じ画面」のときは出さない（出さないときは API も呼ばない）。
// 上は、右上に浮かぶ切替ボタン（phone-view-switch）と重ならないように空ける
const LG = '(min-width: 1024px)';
const subscribe = (notify: () => void) => {
  if (typeof window === 'undefined' || !window.matchMedia) return () => {};
  const mq = window.matchMedia(LG);
  mq.addEventListener('change', notify);
  return () => mq.removeEventListener('change', notify);
};
const isDesktop = () => typeof window !== 'undefined' && !!window.matchMedia && window.matchMedia(LG).matches;

export function SideFriends() {
  const desktop = useSyncExternalStore(subscribe, isDesktop, () => false);
  const phone = usePhoneView(); // 「スマホと同じ画面」のときは出さない（API も呼ばない）
  if (!desktop || phone) return null;
  return (
    <aside aria-label="仲間の今日" className="sticky top-0 hidden w-72 shrink-0 space-y-3 self-start px-2 pt-[72px] pc:block">
      <h2 className="px-2 text-sm font-extrabold text-fg-muted">仲間の今日</h2>
      <FriendsToday today={toLocalDate(new Date())} />
    </aside>
  );
}
