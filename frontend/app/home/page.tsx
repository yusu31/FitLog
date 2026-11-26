import type { Metadata } from 'next';
import { AppShell } from '@/components/fitlog/app-shell';
import { HomeView } from '@/components/home/home-view';

export const metadata: Metadata = { title: 'ホーム' };

// S-05 ホーム（docs/screen-design.md 4章）。自分のキャラと今日の1行、仲間のタイムライン
export default function HomePage() {
  return (
    <AppShell>
      <HomeView />
    </AppShell>
  );
}
