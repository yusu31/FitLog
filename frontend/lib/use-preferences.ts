'use client';

import { useSyncExternalStore } from 'react';
import type { WeightUnit } from '@/lib/unit';
import { readPrefs, SERVER_PREFS, subscribePrefs, type Preferences } from '@/lib/preferences';

// 端末の設定を読む。書き換えると、読んでいるすべての画面が切り替わる
export function usePreferences(): Preferences {
  return useSyncExternalStore(subscribePrefs, readPrefs, () => SERVER_PREFS);
}

// 重さの表示単位（設定の kg / lb）
export function useWeightUnit(): WeightUnit {
  return usePreferences().unit;
}
