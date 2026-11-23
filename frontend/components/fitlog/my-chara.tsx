'use client';

import { Chara } from '@/components/fitlog/chara';
import { Sprite, type PoseKey } from '@/components/fitlog/sprite';
import { useGetMyAvatar } from '@/lib/api/generated';
import { normalizeChara } from '@/lib/chara';

// 画面に立つ「自分のキャラ」（F-32）。保存した見た目（GET /avatar）で組み立てる。
// 読み込み前・読めなかったときは、既定の見た目と同じ Sprite（1枚絵）を出す（見た目が一瞬変わらず、失敗しても画面が崩れない）
export function MyChara({ pose, size, className }: { pose: PoseKey; size?: number; className?: string }) {
  const avatar = useGetMyAvatar();
  if (avatar.data?.status === 200) {
    return <Chara settings={normalizeChara(avatar.data.data)} pose={pose} size={size} className={className} />;
  }
  return <Sprite pose={pose} size={size} className={className} />;
}
