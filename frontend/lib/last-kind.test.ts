import { LAST_KIND_KEY, parseLastKind, readLastKind, rememberLastKind } from './last-kind';

afterEach(() => localStorage.clear());

describe('最後に保存した運動の種類（D1）', () => {
  it('覚えていない・知らない値は筋トレ版', () => {
    expect(parseLastKind(null)).toBe('lift');
    expect(parseLastKind(undefined)).toBe('lift');
    expect(parseLastKind('xxx')).toBe('lift');
    expect(readLastKind()).toBe('lift');
  });

  it('ランを保存したらラン版、筋トレを保存したら筋トレ版に戻る', () => {
    rememberLastKind('run');
    expect(localStorage.getItem(LAST_KIND_KEY)).toBe('run');
    expect(readLastKind()).toBe('run');
    rememberLastKind('workout');
    expect(readLastKind()).toBe('lift');
  });

  it('休みは種類として覚えない（直前の種類のまま）', () => {
    rememberLastKind('run');
    rememberLastKind('rest');
    expect(readLastKind()).toBe('run');
  });

  it('保存できない環境でも例外にしない', () => {
    const spy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('denied');
    });
    expect(() => rememberLastKind('run')).not.toThrow();
    spy.mockRestore();
  });
});
