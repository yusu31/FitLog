import { isTouchDevice, mapGestureOptions } from './map-gestures';

afterEach(() => vi.unstubAllGlobals());

describe('mapGestureOptions（地図の指の操作。L7）', () => {
  it('matchMedia が無い環境は PC 扱い（cooperativeGestures・dragPan は切らない）', () => {
    vi.stubGlobal('matchMedia', undefined);
    expect(isTouchDevice()).toBe(false);
    expect(mapGestureOptions()).toEqual({ cooperativeGestures: true });
  });

  it('マウスの端末は cooperativeGestures（Ctrl+ホイール）のまま', () => {
    vi.stubGlobal('matchMedia', () => ({ matches: false }));
    expect(mapGestureOptions()).toEqual({ cooperativeGestures: true });
  });

  it('触る端末（pointer: coarse）は cooperativeGestures を使わず、dragPan を切る（二本指の拡大は残る）', () => {
    const mm = vi.fn(() => ({ matches: true }));
    vi.stubGlobal('matchMedia', mm);
    expect(mapGestureOptions()).toEqual({ cooperativeGestures: false, dragPan: false });
    expect(mm).toHaveBeenCalledWith('(pointer: coarse)');
  });
});
