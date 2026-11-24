import { TILE_ERROR_LIMIT, isTileError, watchMapFailure } from './map-failure';

function fakeMap() {
  const handlers: Record<string, (e?: unknown) => void> = {};
  return { handlers, on: (ev: string, cb: (e?: unknown) => void) => void (handlers[ev] = cb) };
}

describe('watchMapFailure（地図の失敗を見張る。L13）', () => {
  it('タイル・出典のエラーかどうかを見分ける', () => {
    expect(isTileError({ tile: {} })).toBe(true);
    expect(isTileError({ sourceId: 's' })).toBe(true);
    expect(isTileError({ error: new Error('style') })).toBe(false);
    expect(isTileError(undefined)).toBe(false);
  });

  it('スタイルのエラーは1回で失敗。2回目以降は知らせ直さない', () => {
    const m = fakeMap();
    const onFail = vi.fn();
    watchMapFailure(m, onFail);
    m.handlers.error({ error: new Error('style') });
    m.handlers.error({ error: new Error('style') });
    expect(onFail).toHaveBeenCalledTimes(1);
  });

  it('タイルのエラーは上限（続けて）で失敗。idle で数え直す', () => {
    const m = fakeMap();
    const onFail = vi.fn();
    watchMapFailure(m, onFail);
    for (let i = 0; i < TILE_ERROR_LIMIT - 1; i++) m.handlers.error({ tile: {} });
    m.handlers.idle();
    for (let i = 0; i < TILE_ERROR_LIMIT - 1; i++) m.handlers.error({ tile: {} });
    expect(onFail).not.toHaveBeenCalled();
    m.handlers.error({ tile: {} });
    expect(onFail).toHaveBeenCalledTimes(1);
  });
});
