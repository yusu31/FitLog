import type { Metadata } from 'next';
import { AppShell } from '@/components/fitlog/app-shell';
import { MeFrame } from '@/components/me/me-frame';
import { ProfileView } from '@/components/me/profile-view';

export const metadata: Metadata = { title: 'プロフィール' };

// 自分 > プロフィール（名前・キャラ・からだ）
export default function MeProfilePage() {
  return (
    <AppShell>
      <MeFrame>
        <ProfileView />
      </MeFrame>
    </AppShell>
  );
}
