import type { Metadata } from 'next';
import { AppShell } from '@/components/fitlog/app-shell';
import { NotificationsView } from '@/components/notifications/notifications-view';

export const metadata: Metadata = { title: '通知' };

export default function NotificationsPage() {
  return (
    <AppShell>
      <NotificationsView />
    </AppShell>
  );
}
