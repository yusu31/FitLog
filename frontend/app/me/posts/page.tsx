import type { Metadata } from 'next';
import { AppShell } from '@/components/fitlog/app-shell';
import { MeFrame } from '@/components/me/me-frame';
import { MyVideoGrid } from '@/components/video-grid/my-video-grid';

export const metadata: Metadata = { title: '投稿' };

// 自分 > 投稿（動画のグリッド）
export default function MePostsPage() {
  return (
    <AppShell>
      <MeFrame>
        <MyVideoGrid />
      </MeFrame>
    </AppShell>
  );
}
