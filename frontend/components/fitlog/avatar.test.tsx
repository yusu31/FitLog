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

  it('飾りなので読み上げから外す。知らない色は navy にする', () => {
    render(<Avatar shirtColor="unknown" />);
    const circle = screen.getByTestId('avatar');
    expect(circle).toHaveAttribute('aria-hidden', 'true');
    expect(circle).toHaveStyle({ backgroundColor: AVATAR_BG.navy });
  });
});
