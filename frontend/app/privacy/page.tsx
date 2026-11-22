import type { Metadata } from 'next';
import { PrivacyView } from '@/components/legal/legal-views';

export const metadata: Metadata = { title: 'プライバシーの扱い' };

export default function PrivacyPage() {
  return <PrivacyView />;
}
