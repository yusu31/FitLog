import type { Metadata } from 'next';
import { CharaPage } from '@/components/chara/chara-editor';

export const metadata: Metadata = { title: 'キャラを変える' };

export default function MeCharaPage() {
  return <CharaPage />;
}
