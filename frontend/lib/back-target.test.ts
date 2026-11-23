import { describe, expect, it } from 'vitest';
import { backTarget, withBack } from './back-target';

describe('backTarget（来た所へ戻る。許可した値だけ）', () => {
  const fallback = { href: '/settings', label: '設定へ戻る' };

  it('許可した値なら、その画面へ戻る', () => {
    expect(backTarget('friends', ['friends'], fallback)).toEqual({ href: '/friends', label: '仲間へ戻る' });
    expect(backTarget('notifications', ['notifications'], fallback)).toEqual({ href: '/notifications', label: '通知へ戻る' });
  });

  it('値が無い・許可していない・知らない値なら、既定の戻り先', () => {
    expect(backTarget(null, ['friends'], fallback)).toBe(fallback);
    expect(backTarget('settings', ['friends'], fallback)).toBe(fallback);
    expect(backTarget('https://evil.example', ['friends'], fallback)).toBe(fallback);
  });
});

describe('withBack', () => {
  it('? があれば & でつなぐ', () => {
    expect(withBack('/settings/group', 'friends')).toBe('/settings/group?back=friends');
    expect(withBack('/record-detail?id=r1', 'notifications')).toBe('/record-detail?id=r1&back=notifications');
  });
});
