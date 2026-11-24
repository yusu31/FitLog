import type { Metadata } from 'next';
import { HelpView } from '@/components/settings/help-view';

export const metadata: Metadata = { title: 'ヘルプ・使い方' };

export default function HelpPage() {
  return <HelpView />;
}
