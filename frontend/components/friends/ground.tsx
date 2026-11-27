'use client';

import { useEffect, useRef, useState } from 'react';
import { Chara } from '@/components/fitlog/chara';
import type { PoseKey } from '@/components/fitlog/sprite';
import { normalizeChara } from '@/lib/chara';
import { usePrefersReducedMotion } from '@/lib/use-browser-state';
import type { GroupBackground, GroupDetailResponse, MemberToday } from '@/lib/api/generated';
import { GROUND_NAMES, TODAY_LABEL } from './friends-text';

// 今日のようす → ポーズ。筋トレ済み＝ガッツポーズ・ラン済み＝走る・休み＝くつろぎ・まだ＝待機（02-9 PR 6 ③）
export const TODAY_POSE: Record<MemberToday, PoseKey> = { workout: 'cheer', run: 'run', rest: 'relax', none: 'idle' };

const CHARA_SIZE = 64;
// 足もとの高さ（床の部分に収める）。人によって少しずらして、横一列に並んだ感じを避ける
const FEET = [10, 3, 14, 6, 12];
// ときどき1人が少し歩く。間隔と歩く長さ（px）
const WALK_EVERY_MS = 7000;
const WALK_MS = 2400;
const WALK_PX = 36;

// 運動場（仲間タブ）。ミッションの背景の上に、メンバーのキャラが今日のポーズで立つ。名前が上に出る。
// 動き（ときどき歩く）は、「動きを減らす」設定のときと、画面の外にあるときは止める
export function Ground({ group }: { group: GroupDetailResponse }) {
  const reduced = usePrefersReducedMotion();
  const sceneRef = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(true);
  const [walk, setWalk] = useState<{ id: string; dir: 1 | -1 } | null>(null);
  const members = group.members;

  useEffect(() => {
    const el = sceneRef.current;
    if (!el || typeof IntersectionObserver === 'undefined') return;
    const observer = new IntersectionObserver(([entry]) => setVisible(entry.isIntersecting));
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (reduced || !visible || members.length < 2) return;
    let turn = 0;
    let stop: ReturnType<typeof setTimeout> | undefined;
    const timer = setInterval(() => {
      const member = members[turn % members.length];
      // 端の人は内側へ歩く（はみ出さない）
      const index = turn % members.length;
      const dir: 1 | -1 = index === members.length - 1 ? -1 : index === 0 ? 1 : turn % 2 === 0 ? 1 : -1;
      turn += 1;
      setWalk({ id: member.id, dir });
      stop = setTimeout(() => setWalk(null), WALK_MS);
    }, WALK_EVERY_MS);
    return () => {
      clearInterval(timer);
      if (stop) clearTimeout(stop);
      setWalk(null);
    };
  }, [reduced, visible, members]);

  const label = `${GROUND_NAMES[group.background as GroupBackground]}：${members.map((m) => `${m.name}は${TODAY_LABEL[m.today]}`).join('、')}`;
  const step = 100 / members.length;

  return (
    <div
      ref={sceneRef}
      role="img"
      aria-label={label}
      data-testid="ground"
      data-background={group.background}
      className="relative aspect-video w-full overflow-hidden rounded-fl border-2 border-fg/10 bg-canvas bg-cover bg-bottom [image-rendering:pixelated]"
      style={{ backgroundImage: `url(/ground/${group.background}.png)` }}
    >
      {members.map((m, i) => {
        const walking = walk?.id === m.id;
        return (
          <div
            key={m.id}
            data-testid="ground-member"
            data-today={m.today}
            data-walking={walking ? 'true' : undefined}
            className="absolute flex flex-col items-center"
            style={{
              left: `${step * i + step / 2}%`,
              bottom: `${FEET[i % FEET.length]}%`,
              width: CHARA_SIZE,
              marginLeft: -CHARA_SIZE / 2,
              transform: `translateX(${walking ? walk.dir * WALK_PX : 0}px)`,
              transition: reduced ? undefined : `transform ${WALK_MS}ms linear`,
              zIndex: 100 - FEET[i % FEET.length],
            }}
          >
            <span className="mb-[-10px] max-w-20 truncate rounded bg-card/80 px-1 text-note font-extrabold leading-tight text-fg">{m.name}</span>
            <div style={{ transform: walking && walk.dir < 0 ? 'scaleX(-1)' : undefined }}>
              <Chara settings={normalizeChara(m.avatar)} pose={walking ? 'run' : TODAY_POSE[m.today]} size={CHARA_SIZE} />
            </div>
          </div>
        );
      })}
    </div>
  );
}
