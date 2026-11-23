import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { POSES } from '@/components/fitlog/sprite';
import {
  ACCESSORY_OPTIONS,
  BODY_OPTIONS,
  charaLayers,
  DEFAULT_CHARA,
  faceLayers,
  HAIR_COLORS,
  HAIR_OPTIONS,
  normalizeChara,
  PANTS_COLORS,
  POSE_FRAMES,
  SHEET_FRAMES,
  SHIRT_COLORS,
} from './chara';

const PUBLIC = join(__dirname, '..', 'public');
const fileOf = (url: string) => join(PUBLIC, url);
// PNG の幅と高さ（先頭の IHDR）
const sizeOf = (url: string) => {
  const b = readFileSync(fileOf(url));
  return { w: b.readUInt32BE(16), h: b.readUInt32BE(20) };
};

describe('normalizeChara', () => {
  it('古い行（小物なし）は none を足す', () => {
    expect(normalizeChara({ body: 'A', hair: 1, hairColor: 'brown', shirtColor: 'teal', pantsColor: 'navy' })).toEqual(DEFAULT_CHARA);
  });

  it('絵の無い値・欠けた値は既定に戻す（存在しない画像の名前で探さない）', () => {
    expect(normalizeChara({ body: 'Z', hair: 99, hairColor: 'pink', shirtColor: '../x', accessory: 'cap' })).toEqual(DEFAULT_CHARA);
    expect(normalizeChara(null)).toEqual(DEFAULT_CHARA);
    expect(normalizeChara(undefined)).toEqual(DEFAULT_CHARA);
  });

  it('選べる値はそのまま通す', () => {
    const c = { body: 'B', hair: 5, hairColor: 'blue', shirtColor: 'green', pantsColor: 'maroon', accessory: 'wrist' } as const;
    expect(normalizeChara(c)).toEqual(c);
  });
});

describe('部品の重ね順', () => {
  it('小物なし: 後光・影 → 輪郭 → 肌 → 靴 → ズボン → 服 → 髪 → 描き足し', () => {
    expect(charaLayers(DEFAULT_CHARA).map((u) => u.replace('/characters/parts/', '').replace('.png', ''))).toEqual([
      'extras-back',
      'outline-A-1-none',
      'skin-A',
      'shoes-A',
      'pants-A-navy',
      'shirt-A-teal',
      'hair-1-brown',
      'extras-front',
    ]);
  });

  it('リストバンドは髪の前（服のあと）・メガネや帽子は髪のあと', () => {
    const names = (accessory: 'wrist' | 'glasses') => charaLayers({ ...DEFAULT_CHARA, accessory }).map((u) => u.split('/').pop());
    expect(names('wrist').indexOf('acc-wrist-A.png')).toBeLessThan(names('wrist').indexOf('hair-1-brown.png'));
    expect(names('glasses').indexOf('acc-glasses-A.png')).toBeGreaterThan(names('glasses').indexOf('hair-1-brown.png'));
  });

  it('顔の丸には影・後光・描き足しを入れない', () => {
    expect(faceLayers(DEFAULT_CHARA).some((u) => u.includes('extras-'))).toBe(false);
  });
});

describe('書き出した絵（build_parts.py）との突き合わせ', () => {
  it('ポーズのコマ数は Sprite と同じで、合計はシートの枚数（28）', () => {
    let next = 0;
    for (const [pose, { start, count }] of Object.entries(POSE_FRAMES)) {
      expect(start, pose).toBe(next);
      expect(count, pose).toBe(POSES[pose as keyof typeof POSES].frames);
      next += count;
    }
    expect(next).toBe(SHEET_FRAMES);
  });

  it('選べる全部の組み合わせの部品が、ファイルとして在る（幅=コマ×64・高さ=64）', () => {
    const urls = new Set<string>();
    for (const body of BODY_OPTIONS.map((o) => o.value)) {
      for (const hair of HAIR_OPTIONS.map((o) => o.value)) {
        for (const accessory of ACCESSORY_OPTIONS.map((o) => o.value)) {
          for (const u of charaLayers({ ...DEFAULT_CHARA, body, hair, accessory })) urls.add(u);
        }
      }
      for (const c of HAIR_COLORS) for (const hair of HAIR_OPTIONS) urls.add(`/characters/parts/hair-${hair.value}-${c.value}.png`);
      for (const c of SHIRT_COLORS) urls.add(`/characters/parts/shirt-${body}-${c.value}.png`);
      for (const c of PANTS_COLORS) urls.add(`/characters/parts/pants-${body}-${c.value}.png`);
    }
    expect(urls.size).toBeGreaterThan(100);
    const missing = [...urls].filter((u) => !existsSync(fileOf(u)));
    expect(missing).toEqual([]);
    for (const u of urls) expect(sizeOf(u), u).toEqual({ w: SHEET_FRAMES * 64, h: 64 });
  });
});
