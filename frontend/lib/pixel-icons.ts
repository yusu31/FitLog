// ドット絵のアイコン（中央ボタンの扇の4つ。02-9 PR 3）。16×16 のマスを文字で描く。
// 文字: . 透明／k 輪郭（濃い色）／a 主役の色（アイコンごとに変わる）／h ハイライト／w 白／b 影（主役の色を暗く）
// 形の検査（16行・各16文字）は lib/pixel-icons.test.ts。見た目は実機で確かめる（jsdom では描画を測れない）。

export const PIXEL_SIZE = 16;

export const PIXEL_ICONS = {
  // 筋トレ: ダンベル
  dumbbell: [
    '................',
    '................',
    '................',
    '................',
    '..kk........kk..',
    '.kaak.kkkk.kaak.',
    '.kahakkkkkkkahak',
    'kkaabkkkkkkkbaak',
    'kkaabkkkkkkkbaak',
    '.kahakkkkkkkahak',
    '.kaak.kkkk.kaak.',
    '..kk........kk..',
    '................',
    '................',
    '................',
    '................',
  ],
  // ラン: ランニングシューズ（つま先を持ち上げた斜め向き）
  shoe: [
    '................',
    '................',
    '................',
    '................',
    '.kkk............',
    '.kaa.kkkkk.kk.k.',
    '.kaakaaaaakaakak',
    '.kahaaaaaaaaaabk',
    '.kaaawawaaabbbkk',
    '.kaaaaaaawbkkkww',
    'kkaaaaaakkkwwwkk',
    '.kaaakkkwwwkkk..',
    '.kkkkwwwkkk.....',
    'kwwwwkkk........',
    '.kkkk...........',
    '................',
  ],
  // 撮影: カメラ
  camera: [
    '................',
    '................',
    '................',
    '....kkkkkk......',
    '...kaaaaaak.....',
    '.kkkkkkkkkkkkkk.',
    '.kaaaaaaaaaahak.',
    '.kaaaakkkkaaaak.',
    '.kaaakwwwwkaaak.',
    '.kaaakwhwwkaaak.',
    '.kaaakwwwwkaaak.',
    '.kaaaakkkkaaaak.',
    '.kbbbbbbbbbbbbk.',
    '.kkkkkkkkkkkkkk.',
    '................',
    '................',
  ],
  // おやすみ: ベッド（本人が選んだ・11/27）
  bed: [
    '................',
    '................',
    '................',
    'kk..............',
    'kak.............',
    'kak.....kkkkkkk.',
    'kak.kkkkkwwwwwk.',
    'kakkaaaaakkkkkk.',
    'kaaaaaaaaaaaaak.',
    'kaaaaaaaaaaaaak.',
    'kkkkkkkkkkkkkkk.',
    'kk...........kk.',
    '................',
    '................',
    '................',
    '................',
  ],
} as const;

// おやすみの別案（比較ページで見比べた残り。アプリには使っていない。本人が選んだのはベッド）
export const REST_ALTERNATIVES = {
  // 枕
  pillow: [
    '................',
    '................',
    '................',
    '................',
    '.kkkkkkkkkkkkkk.',
    'kaaaaaaaaaaaaaak',
    'kahaaaaaaaaaaaak',
    'kaaaaaaaaaaaaaak',
    'kaaaaaaaaaaaaaak',
    'kaaaaaaaaaaaabak',
    'kaaaaaaaaaaabbak',
    '.kkkkkkkkkkkkkk.',
    '................',
    '................',
    '................',
    '................',
  ],
  // 月と星
  moon: [
    '................',
    '....kkkkk.......',
    '..kkaaaak.......',
    '.kaaaakk........',
    '.kaaak..........',
    'kaaak...........',
    'kaaak.......k...',
    'kaaak......kwk..',
    'kaaak.......k...',
    '.kaaakk.........',
    '.kaaaaakkkkk....',
    '..kkaaaaaaak....',
    '....kkkkkkk.....',
    '................',
    '................',
    '................',
  ],
  // Zzz
  zzz: [
    '................',
    '.kkkkkkk........',
    '.kaaaaak........',
    '.kkkkaak........',
    '....kak.........',
    '...kak..........',
    '..kaakkkk.......',
    '..kaaaaak..kkkkk',
    '..kkkkkkk..kaaak',
    '..........kkkaak',
    '............kak.',
    '...........kaakk',
    '...........kaaak',
    '...........kkkkk',
    '................',
    '................',
  ],
} as const;

export type PixelIconName = keyof typeof PIXEL_ICONS;
export type PixelRows = readonly string[];

// 同じ色が横に続く部分を1つの四角にまとめる（描く四角の数を減らす）
export type PixelRun = { x: number; y: number; w: number; ch: string };
export function pixelRuns(rows: PixelRows): PixelRun[] {
  const out: PixelRun[] = [];
  rows.forEach((row, y) => {
    let x = 0;
    while (x < row.length) {
      const ch = row[x];
      let w = 1;
      while (x + w < row.length && row[x + w] === ch) w += 1;
      if (ch !== '.') out.push({ x, y, w, ch });
      x += w;
    }
  });
  return out;
}
