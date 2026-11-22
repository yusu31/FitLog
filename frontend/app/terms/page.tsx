import type { Metadata } from 'next';
import { TermsView } from '@/components/legal/legal-views';

export const metadata: Metadata = { title: '利用規約' };

export default function TermsPage() {
  return <TermsView />;
}
