import type { Metadata } from 'next';
import { RestView } from '@/components/rest/rest-view';

export const metadata: Metadata = { title: 'おやすみ' };

// S-14 おやすみ（docs/screen-design.md）。タブの無い全画面
export default function RestPage() {
  return <RestView />;
}
