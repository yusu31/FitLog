import { DEFAULT_PREFS, PREFS_KEY, parsePrefs, readPrefs, savePrefs } from './preferences';

afterEach(() => localStorage.removeItem(PREFS_KEY));

describe('端末の設定', () => {
  it('何も保存されていなければ既定値（自動再生オフ・通知全部オン・19時）', () => {
    expect(parsePrefs(null)).toEqual(DEFAULT_PREFS);
    expect(DEFAULT_PREFS.autoplayVideo).toBe(false);
    expect(DEFAULT_PREFS.reminderHour).toBe(19);
    expect(Object.values(DEFAULT_PREFS.notify).every(Boolean)).toBe(true);
  });

  it('壊れた文字・型の違う項目・範囲外の時刻は、その項目だけ既定値に戻す', () => {
    expect(parsePrefs('{壊れた')).toEqual(DEFAULT_PREFS);
    const p = parsePrefs(JSON.stringify({ autoplayVideo: 'yes', notify: { stamp: false, comment: 1 }, reminderHour: 3, reminderOn: false }));
    expect(p.autoplayVideo).toBe(false);
    expect(p.notify.stamp).toBe(false);
    expect(p.notify.comment).toBe(true);
    expect(p.reminderHour).toBe(19);
    expect(p.reminderOn).toBe(false);
  });

  it('保存すると読み直せ、同じ内容の間は同じオブジェクトを返す', () => {
    savePrefs({ ...DEFAULT_PREFS, autoplayVideo: true });
    expect(readPrefs().autoplayVideo).toBe(true);
    expect(readPrefs()).toBe(readPrefs());
  });
});
