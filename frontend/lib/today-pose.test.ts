import { describe, expect, it } from 'vitest';
import { jstHour, todayPose } from './today-pose';

// 日本時間 09:59 / 10:00 は UTC の前日 00:59 / 01:00
const at = (utc: string) => new Date(utc);
const base = { restToday: false, allDone: false, welcomeBack: false };

describe('todayPose（デシジョンテーブル）', () => {
  it('休みの日はくつろぎ（ほかの条件より優先）', () => {
    expect(todayPose({ ...base, restToday: true, allDone: true, welcomeBack: true, now: at('2026-11-10T03:00:00Z') })).toBe('relax');
  });
  it('今日の分が終わっていればガッツポーズ（おかえりより優先）', () => {
    expect(todayPose({ ...base, allDone: true, welcomeBack: true, now: at('2026-11-10T03:00:00Z') })).toBe('cheer');
  });
  it('3日以上あいていればおかえり（朝でも）', () => {
    expect(todayPose({ ...base, welcomeBack: true, now: at('2026-11-09T22:00:00Z') })).toBe('welcome');
  });
  it('朝（日本時間 10時前）は朝の伸び。境界: 9:59→伸び・10:00→準備OK', () => {
    expect(todayPose({ ...base, now: at('2026-11-10T00:59:00Z') })).toBe('stretch');
    expect(todayPose({ ...base, now: at('2026-11-10T01:00:00Z') })).toBe('ready');
  });
  it('日本時間の0時台も朝（UTC では前日の15時台）', () => {
    expect(jstHour(at('2026-11-09T15:30:00Z'))).toBe(0);
    expect(todayPose({ ...base, now: at('2026-11-09T15:30:00Z') })).toBe('stretch');
  });
});
