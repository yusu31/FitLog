import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Avatar, AVATAR_BG } from './avatar';

describe('Avatar（顔の丸・D7-1）', () => {
  it('キャラの画像の頭の部分だけを丸に入れ、丸の色は服の色にする', () => {
    render(<Avatar shirtColor="coral" size={48} />);
    const circle = screen.getByTestId('avatar');
    expect(circle).toHaveStyle({ width: '48px', height: '48px', backgroundColor: AVATAR_BG.coral });
    const img = circle.querySelector('img')!;
    expect(img).toHaveAttribute('src', '/characters/idle_0.png');
    // 32px を 48px に拡大（1.5倍）→ 64px の画像は 96px・左上は（-16, -10）の1.5倍
    expect(img).toHaveStyle({ width: '96px', left: '-24px', top: '-15px' });
  });

  it('キャラの設定（avatar）を渡すと、その人の髪・服・小物の部品を重ねて顔にする（1コマ目だけ・影や後光は入れない）', () => {
    render(<Avatar avatar={{ body: 'B', hair: 3, hairColor: 'blonde', shirtColor: 'coral', pantsColor: 'khaki', accessory: 'glasses' }} size={48} />);
    const circle = screen.getByTestId('avatar');
    expect(circle).toHaveStyle({ backgroundColor: AVATAR_BG.coral });
    const layers = [...circle.querySelectorAll('[data-layer]')].map((e) => e.getAttribute('data-layer')!.split('/').pop());
    expect(layers).toEqual(['outline-B-3-glasses.png', 'skin-B.png', 'shoes-B.png', 'pants-B-khaki.png', 'shirt-B-coral.png', 'hair-3-blonde.png', 'acc-glasses-B.png']);
    expect(circle.querySelector('img')).toBeNull();
    // 32px を 48px に拡大（1.5倍）→ 1コマは 96px・シート全体は 28コマぶん
    expect(circle.querySelector('[data-layer]')).toHaveStyle({ width: '96px', height: '96px', left: '-24px', top: '-15px' });
  });

  it('古い行（小物なし）・読めない値のキャラでも、既定の部品で描ける', () => {
    render(<Avatar avatar={{ body: 'A', hair: 1, hairColor: 'brown', shirtColor: 'teal', pantsColor: 'navy' }} />);
    expect([...screen.getByTestId('avatar').querySelectorAll('[data-layer]')].map((e) => e.getAttribute('data-layer')!.split('/').pop())).toContain('outline-A-1-none.png');
  });

  it('飾りなので読み上げから外す。知らない色は navy にする', () => {
    render(<Avatar shirtColor="unknown" />);
    const circle = screen.getByTestId('avatar');
    expect(circle).toHaveAttribute('aria-hidden', 'true');
    expect(circle).toHaveStyle({ backgroundColor: AVATAR_BG.navy });
  });
});
