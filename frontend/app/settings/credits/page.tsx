import type { Metadata } from 'next';
import { CreditsView } from '@/components/settings/credits-view';

export const metadata: Metadata = { title: 'クレジット' };

export default function CreditsPage() {
  return <CreditsView />;
}
