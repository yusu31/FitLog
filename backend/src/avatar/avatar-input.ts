import { BadRequestException } from '@nestjs/common';

// キャラ（F-32）で選べる値。画面（frontend/lib/chara.ts）と、書き出した絵（prototype/v8/tools/build_parts.py）の名前に合わせる
export const AVATAR_BODIES = ['A', 'B'] as const;
export const AVATAR_HAIRS = [1, 2, 3, 4, 5] as const;
export const AVATAR_HAIR_COLORS = ['brown', 'black', 'blonde', 'red', 'gray', 'blue'] as const;
export const AVATAR_SHIRT_COLORS = ['teal', 'navy', 'coral', 'purple', 'gold', 'green'] as const;
export const AVATAR_PANTS_COLORS = ['navy', 'black', 'gray', 'khaki', 'teal', 'maroon'] as const;
export const AVATAR_ACCESSORIES = ['none', 'band1', 'band2', 'bandana', 'bandana2', 'glasses', 'wrist'] as const;

export type AvatarValue = {
  body: (typeof AVATAR_BODIES)[number];
  hair: (typeof AVATAR_HAIRS)[number];
  hairColor: (typeof AVATAR_HAIR_COLORS)[number];
  shirtColor: (typeof AVATAR_SHIRT_COLORS)[number];
  pantsColor: (typeof AVATAR_PANTS_COLORS)[number];
  accessory: (typeof AVATAR_ACCESSORIES)[number];
};

const asObject = (raw: unknown): Record<string, unknown> => (typeof raw === 'object' && raw !== null ? (raw as Record<string, unknown>) : {});

// PUT /avatar の本文。5項目は必須で、決まった値のどれか。accessory だけ省略でき、省略は none。
// 画面を通さず API を直接呼んでも、絵の無い値（存在しない画像の名前）が保存されないようにする
export function parseAvatarInput(raw: unknown): AvatarValue {
  const body = asObject(raw);
  const details: string[] = [];
  const pick = <T extends string | number>(key: string, allowed: readonly T[], fallback?: T): T => {
    const v = body[key];
    if (v === undefined && fallback !== undefined) return fallback;
    if ((allowed as readonly unknown[]).includes(v)) return v as T;
    details.push(`${key}: ${allowed.join('・')} のどれかにしてください`);
    return allowed[0];
  };
  const value: AvatarValue = {
    body: pick('body', AVATAR_BODIES),
    hair: pick('hair', AVATAR_HAIRS),
    hairColor: pick('hairColor', AVATAR_HAIR_COLORS),
    shirtColor: pick('shirtColor', AVATAR_SHIRT_COLORS),
    pantsColor: pick('pantsColor', AVATAR_PANTS_COLORS),
    accessory: pick('accessory', AVATAR_ACCESSORIES, 'none'),
  };
  if (details.length > 0) throw new BadRequestException({ code: 'VALIDATION_ERROR', message: '入力が正しくありません', details });
  return value;
}

// 保存済みの値（古い行は accessory が無い）を、いまの形にそろえる。読めない値は既定に戻す
export function normalizeAvatar(stored: unknown): AvatarValue {
  const s = asObject(stored);
  const ok = <T extends string | number>(allowed: readonly T[], v: unknown, fallback: T): T => ((allowed as readonly unknown[]).includes(v) ? (v as T) : fallback);
  return {
    body: ok(AVATAR_BODIES, s.body, 'A'),
    hair: ok(AVATAR_HAIRS, s.hair, 1),
    hairColor: ok(AVATAR_HAIR_COLORS, s.hairColor, 'brown'),
    shirtColor: ok(AVATAR_SHIRT_COLORS, s.shirtColor, 'teal'),
    pantsColor: ok(AVATAR_PANTS_COLORS, s.pantsColor, 'navy'),
    accessory: ok(AVATAR_ACCESSORIES, s.accessory, 'none'),
  };
}
