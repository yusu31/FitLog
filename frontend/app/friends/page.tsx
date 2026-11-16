import type { Metadata } from 'next';
import { AppShell } from '@/components/fitlog/app-shell';
import { FriendsView } from '@/components/friends/friends-view';

export const metadata: Metadata = { title: '仲間' };

export default function FriendsPage() {
  return (
    <AppShell>
      <FriendsView />
    </AppShell>
  );
}
