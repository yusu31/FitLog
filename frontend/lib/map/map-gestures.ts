// 地図の指の操作（L7）。縦に長いページの中の地図が、指のスクロールを奪わないようにする。
// - PC（マウス）: 今のまま。Ctrl（または二本指）を押しながらでないと動かない（cooperativeGestures）
// - 触る端末（pointer: coarse）: 1本指はページのスクロールに任せる（dragPan を切る）。二本指の拡大・縮小は残す。
//   cooperativeGestures は使わない（「Ctrl を押しながら」の案内が、触る端末に出てしまうため）
export type GestureOptions = { cooperativeGestures: boolean; dragPan?: false };

export function isTouchDevice(): boolean {
  return typeof window !== 'undefined' && typeof window.matchMedia === 'function' && window.matchMedia('(pointer: coarse)').matches;
}

export function mapGestureOptions(): GestureOptions {
  return isTouchDevice() ? { cooperativeGestures: false, dragPan: false } : { cooperativeGestures: true };
}
