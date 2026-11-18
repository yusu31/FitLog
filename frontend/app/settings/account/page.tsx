import type { Metadata } from 'next';
import { AccountSettingsView } from '@/components/settings/account-settings-view';

export const metadata: Metadata = { title: 'アカウントの設定' };

export default function AccountSettingsPage() {
  return <AccountSettingsView />;
}
