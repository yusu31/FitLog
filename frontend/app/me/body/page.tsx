import type { Metadata } from 'next';
import { BodyPage } from '@/components/body/body-view';

export const metadata: Metadata = { title: 'からだ' };

export default function MeBodyPage() {
  return <BodyPage />;
}
