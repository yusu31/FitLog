import type { Metadata } from 'next';
import { GroupSettingsView } from '@/components/settings/group-settings-view';

export const metadata: Metadata = { title: 'グループの設定' };

export default function GroupSettingsPage() {
  return <GroupSettingsView />;
}
