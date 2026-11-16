import type { Metadata } from 'next';
import { AppShell } from '@/components/fitlog/app-shell';
import { MeView } from '@/components/me/me-view';

export const metadata: Metadata = { title: '自分' };

export default function MePage() {
  return (
    <AppShell>
      <MeView />
    </AppShell>
  );
}
