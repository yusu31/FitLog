'use client';

import { BarChart3 } from 'lucide-react';
import Link from 'next/link';
import { buttonClass } from '@/components/fitlog/thick-button';
import { WeightBand } from '@/components/log/weight-band';
import { RecordsList } from '@/components/me/records-list';
import { TodayView } from '@/components/today/today-view';

// 記録タブ（02-9 ⑫）: したことを見る・直す・足す。上＝今日の中身（7マス・今日のメニュー・続ける・できた・きのう）、
// その下＝記録の一覧（「…」から削除）、「レポートを見る」で自分タブのレポート（/me）へ
export function LogView() {
  return (
    <>
      <TodayView />
      <div className="space-y-4 px-4 pb-6">
        <WeightBand />
        <Link href="/me" className={buttonClass({ variant: 'secondary' })}>
          <BarChart3 aria-hidden />
          レポートを見る
        </Link>
        <RecordsList />
      </div>
    </>
  );
}
