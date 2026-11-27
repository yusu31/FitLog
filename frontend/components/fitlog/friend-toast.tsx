'use client';

import { useEffect, useRef, useState } from 'react';
import type { FeedLatestFriendRecord } from '@/lib/api/generated';
import { usePreferences } from '@/lib/use-preferences';

// 仲間が記録したら、右下にふわっと出て消える知らせ（02-9 PR 7b）。
// 材料は GET /feed/unread の latestFriendRecord（TabBar が1分ごとに取り直している）。専用の通信は増やさない。
// ・最初に取れた分は「基準」にするだけで出さない（アプリを開いたとき、すでにあった記録では出ない）
// ・基準より新しい記録が来たときだけ約4秒出す。設定の「仲間が記録したとき」がオフなら出さない
// ・中央の ● の扇を開いている間は出さない（重なるため）。読み上げは role="status"（割り込まず静かに）
export const TOAST_MS = 4000;

const KIND_TEXT: Record<FeedLatestFriendRecord['kind'], string> = {
  workout: '筋トレを記録しました',
  run: 'ランを記録しました',
  rest: 'おやすみを記録しました',
  post: '投稿しました',
};

export const friendToastText = (r: Pick<FeedLatestFriendRecord, 'authorName' | 'kind'>) => `${r.authorName}さんが${KIND_TEXT[r.kind]}`;

const fanIsOpen = () => typeof document !== 'undefined' && document.querySelector('[data-open="true"]') !== null;

export function FriendToast({ latest, loaded }: { latest: FeedLatestFriendRecord | undefined; loaded: boolean }) {
  const prefs = usePreferences();
  const baseline = useRef<string | null>(null);
  const [text, setText] = useState<string | null>(null);
  const [visible, setVisible] = useState(false);
  const enabled = prefs.notify.friend_record;

  useEffect(() => {
    if (!loaded) return;
    // 最初に取れたとき: 基準にするだけ（記録が無ければ空の基準）
    if (baseline.current === null) {
      baseline.current = latest?.createdAt ?? '';
      return;
    }
    if (!latest || latest.createdAt <= baseline.current) return;
    baseline.current = latest.createdAt;
    if (!enabled || fanIsOpen()) return;
    // 外（サーバーからの取り直し）の変化に合わせて出す知らせなので、effect の中で state を変える
    /* eslint-disable react-hooks/set-state-in-effect */
    setText(friendToastText(latest));
    setVisible(true);
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [loaded, latest, enabled]);

  // 消すタイマーは別にする（取り直しのたびに上の effect が走り直しても、消えるのが遅れない）。続けて来たら数え直す
  useEffect(() => {
    if (!visible) return;
    const timer = setTimeout(() => setVisible(false), TOAST_MS);
    return () => clearTimeout(timer);
  }, [visible, text]);

  return (
    <div
      role="status"
      aria-live="polite"
      data-testid="friend-toast"
      data-visible={visible ? 'true' : 'false'}
      className="pointer-events-none fixed right-3 bottom-24 z-20 max-w-[min(18rem,calc(100vw-1.5rem))] motion-safe:transition-opacity motion-safe:duration-500 data-[visible=false]:opacity-0 lg:bottom-6"
    >
      {text && (
        <p className="fl-slab bg-night px-4 py-2.5 text-sm font-extrabold text-white">
          {text}
        </p>
      )}
    </div>
  );
}
