import type { Metadata } from 'next';
import { LegacyRedirect } from '@/components/fitlog/legacy-redirect';

// 旧「今日」。今日の中身は「記録」（/log）に移した（02-9 ⑫）。古い URL は新しい場所へ転送する
export const metadata: Metadata = { title: '今日' };

export default function TodayPage() {
  return <LegacyRedirect to="/log" />;
}
