import { startLocationWatch } from './source';

// アプリ（Capacitor）側の取得元。プラグインは偽物に差し替え、「通知つきで登録する」「止めると外す」「登録前に止めても外す」を確かめる
const addWatcher = vi.fn();
const removeWatcher = vi.fn(() => Promise.resolve());
let native = true;
vi.mock('@capacitor/core', () => ({
  Capacitor: { isNativePlatform: () => native },
  registerPlugin: () => ({ addWatcher, removeWatcher }),
}));

type Callback = (location?: { latitude: number; longitude: number; accuracy: number; time: number | null }, error?: { code?: string }) => void;
let callback: Callback | null;

beforeEach(() => {
  native = true;
  callback = null;
  addWatcher.mockReset().mockImplementation((_opts: unknown, cb: Callback) => {
    callback = cb;
    return Promise.resolve('w1');
  });
  removeWatcher.mockClear();
});

describe('startLocationWatch（アプリ: バックグラウンド位置情報）', () => {
  it('通知の文言つきで登録する（画面を消しても記録を続けるため）。位置は GpsFix の形で渡す', async () => {
    const onFix = vi.fn();
    startLocationWatch(onFix, vi.fn());
    await Promise.resolve();
    expect(addWatcher.mock.calls[0][0]).toMatchObject({ backgroundTitle: expect.any(String), backgroundMessage: expect.any(String), requestPermissions: true });
    callback?.({ latitude: 35.1, longitude: 139.2, accuracy: 6, time: 1_000 });
    expect(onFix).toHaveBeenCalledWith({ lon: 139.2, lat: 35.1, accuracyM: 6, t: 1_000 });
  });

  it('許可が無い（NOT_AUTHORIZED）は denied、それ以外の失敗は unavailable', async () => {
    const onProblem = vi.fn();
    startLocationWatch(vi.fn(), onProblem);
    await Promise.resolve();
    callback?.(undefined, { code: 'NOT_AUTHORIZED' });
    callback?.(undefined, { code: 'OTHER' });
    expect(onProblem.mock.calls).toEqual([['denied'], ['unavailable']]);
  });

  it('止めると登録を外す。止めたあとに届いた位置は使わない', async () => {
    const onFix = vi.fn();
    const stop = startLocationWatch(onFix, vi.fn());
    await Promise.resolve();
    await Promise.resolve();
    stop();
    expect(removeWatcher).toHaveBeenCalledWith({ id: 'w1' });
    callback?.({ latitude: 35, longitude: 139, accuracy: 5, time: 1 });
    expect(onFix).not.toHaveBeenCalled();
  });

  it('登録が終わる前に止められても、終わりしだい外す（取り残しを作らない）', async () => {
    const stop = startLocationWatch(vi.fn(), vi.fn());
    stop();
    await Promise.resolve();
    await Promise.resolve();
    expect(removeWatcher).toHaveBeenCalledWith({ id: 'w1' });
  });

  it('登録そのものが失敗したら unavailable', async () => {
    addWatcher.mockReset().mockRejectedValue(new Error('x'));
    const onProblem = vi.fn();
    startLocationWatch(vi.fn(), onProblem);
    await Promise.resolve();
    await Promise.resolve();
    expect(onProblem).toHaveBeenCalledWith('unavailable');
  });
});
