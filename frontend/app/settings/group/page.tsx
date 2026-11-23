import type { Metadata } from 'next';
import { Suspense } from 'react';
import { GroupSettingsView } from '@/components/settings/group-settings-view';

export const metadata: Metadata = { title: 'グループの設定' };

export default function GroupSettingsPage() {
  // 戻り先を ?back= で受ける（useSearchParams）。静的書き出しでは Suspense で包む必要がある
  return (
    <Suspense>
      <GroupSettingsView />
    </Suspense>
  );
}
