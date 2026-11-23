// キャラ（F-32）の部品の名前・並び・組み合わせ。絵は prototype/v8/tools/build_parts.py が public/characters/parts/ に書き出す。
// バックエンドの選べる値（backend/src/avatar/avatar-input.ts）と同じ名前にそろえる（テストが絵のファイルの有無まで見張る）。

export type CharaBody = 'A' | 'B';
export type CharaHair = 1 | 2 | 3 | 4 | 5;
export type CharaAccessory = 'none' | 'band1' | 'band2' | 'bandana' | 'bandana2' | 'glasses' | 'wrist';

export type HairColor = 'brown' | 'black' | 'blonde' | 'red' | 'gray' | 'blue';
export type ShirtColor = 'teal' | 'navy' | 'coral' | 'purple' | 'gold' | 'green';
export type PantsColor = 'navy' | 'black' | 'gray' | 'khaki' | 'teal' | 'maroon';

export type CharaSettings = {
  body: CharaBody;
  hair: CharaHair;
  hairColor: HairColor;
  shirtColor: ShirtColor;
  pantsColor: PantsColor;
  accessory: CharaAccessory;
};

type Option<T extends string | number> = { value: T; label: string };
type ColorOption<T extends string> = Option<T> & { rgb: string };

export const BODY_OPTIONS: readonly Option<CharaBody>[] = [
  { value: 'A', label: 'タイプA' },
  { value: 'B', label: 'タイプB' },
];
export const HAIR_OPTIONS: readonly Option<CharaHair>[] = [
  { value: 1, label: '短髪' },
  { value: 2, label: 'ナチュラル' },
  { value: 3, label: '流し前髪' },
  { value: 4, label: 'ストレート' },
  { value: 5, label: 'ツンツン' },
];
// 色の丸の見た目（rgb）は、絵を染めた色（build_parts.py）に合わせる
export const HAIR_COLORS: readonly ColorOption<HairColor>[] = [
  { value: 'brown', label: 'ブラウン', rgb: '#3c2a20' },
  { value: 'black', label: 'ブラック', rgb: '#222028' },
  { value: 'blonde', label: 'ブロンド', rgb: '#d6aa48' },
  { value: 'red', label: 'レッド', rgb: '#a84028' },
  { value: 'gray', label: 'グレー', rgb: '#96989f' },
  { value: 'blue', label: 'ブルー', rgb: '#345696' },
];
export const SHIRT_COLORS: readonly ColorOption<ShirtColor>[] = [
  { value: 'teal', label: 'ティール', rgb: '#17a2a6' },
  { value: 'navy', label: 'ネイビー', rgb: '#283c5c' },
  { value: 'coral', label: 'コーラル', rgb: '#e05646' },
  { value: 'purple', label: 'パープル', rgb: '#7864dc' },
  { value: 'gold', label: 'ゴールド', rgb: '#eeb21e' },
  { value: 'green', label: 'グリーン', rgb: '#3ca05a' },
];
export const PANTS_COLORS: readonly ColorOption<PantsColor>[] = [
  { value: 'navy', label: 'ネイビー', rgb: '#1e2a3a' },
  { value: 'black', label: 'ブラック', rgb: '#24242a' },
  { value: 'gray', label: 'グレー', rgb: '#787e88' },
  { value: 'khaki', label: 'カーキ', rgb: '#b09664' },
  { value: 'teal', label: 'ティール', rgb: '#178286' },
  { value: 'maroon', label: 'マルーン', rgb: '#782832' },
];
export const ACCESSORY_OPTIONS: readonly Option<CharaAccessory>[] = [
  { value: 'none', label: 'なし' },
  { value: 'band1', label: 'ヘッドバンド（赤）' },
  { value: 'band2', label: 'ヘッドバンド（白）' },
  { value: 'bandana', label: 'バンダナ（青）' },
  { value: 'bandana2', label: 'バンダナ（赤）' },
  { value: 'glasses', label: 'メガネ' },
  { value: 'wrist', label: 'リストバンド' },
];

export const DEFAULT_CHARA: CharaSettings = { body: 'A', hair: 1, hairColor: 'brown', shirtColor: 'teal', pantsColor: 'navy', accessory: 'none' };

const has = (list: readonly { value: string | number }[], v: unknown) => list.some((o) => o.value === v);

// サーバーから来た値（古い行は小物が無い・仲間の値）を、描ける形にそろえる。読めない値は既定に戻す（絵の無い名前で画像を探さない）
export function normalizeChara(raw: Partial<Record<keyof CharaSettings, unknown>> | null | undefined): CharaSettings {
  const r = raw ?? {};
  const d = DEFAULT_CHARA;
  return {
    body: has(BODY_OPTIONS, r.body) ? (r.body as CharaBody) : d.body,
    hair: has(HAIR_OPTIONS, r.hair) ? (r.hair as CharaHair) : d.hair,
    hairColor: has(HAIR_COLORS, r.hairColor) ? (r.hairColor as HairColor) : d.hairColor,
    shirtColor: has(SHIRT_COLORS, r.shirtColor) ? (r.shirtColor as ShirtColor) : d.shirtColor,
    pantsColor: has(PANTS_COLORS, r.pantsColor) ? (r.pantsColor as PantsColor) : d.pantsColor,
    accessory: has(ACCESSORY_OPTIONS, r.accessory) ? (r.accessory as CharaAccessory) : d.accessory,
  };
}

// 部品のシート（64px のコマを横に28枚並べた PNG）。コマの並びは POSE_ORDER の順
export const SHEET_FRAMES = 28;
const BASE = '/characters/parts';
const sheet = (name: string) => `${BASE}/${name}.png`;

// 重ねる順（下から）: 後光・影 → 輪郭 → 肌 → 靴 → ズボン → 服 →（リストバンド）→ 髪 →（メガネ・帽子類）→ 小物の描き足し
export function charaLayers(c: CharaSettings): string[] {
  const acc = c.accessory;
  const layers = [sheet('extras-back'), sheet(`outline-${c.body}-${c.hair}-${acc}`), sheet(`skin-${c.body}`), sheet(`shoes-${c.body}`), sheet(`pants-${c.body}-${c.pantsColor}`), sheet(`shirt-${c.body}-${c.shirtColor}`)];
  if (acc === 'wrist') layers.push(sheet(`acc-wrist-${c.body}`));
  layers.push(sheet(`hair-${c.hair}-${c.hairColor}`));
  if (acc !== 'none' && acc !== 'wrist') layers.push(sheet(`acc-${acc}-${c.body}`));
  layers.push(sheet('extras-front'));
  return layers;
}

// 顔の丸には、影・後光・描き足しを入れない（頭まわりの部品だけ）
export function faceLayers(c: CharaSettings): string[] {
  return charaLayers(c).filter((u) => !u.includes('extras-'));
}

// ポーズごとの、シートの中の最初のコマの位置と枚数（build_parts.py の POSE_ORDER と同じ。テストが画像の幅と突き合わせる）
export const POSE_FRAMES = {
  idle: { start: 0, count: 2 },
  ready: { start: 2, count: 2 },
  train: { start: 4, count: 2 },
  cheer: { start: 6, count: 2 },
  stretch: { start: 8, count: 3 },
  relax: { start: 11, count: 3 },
  welcome: { start: 14, count: 2 },
  react: { start: 16, count: 2 },
  run: { start: 18, count: 8 },
  pb: { start: 26, count: 2 },
} as const;
