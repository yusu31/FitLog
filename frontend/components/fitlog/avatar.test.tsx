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
    // 24px を 48px に拡大（2倍）→ 64px の画像は 128px・左上は（-20, -13）の2倍
    expect(img).toHaveStyle({ width: '128px', left: '-40px', top: '-26px' });
  });

  it('飾りなので読み上げから外す。知らない色は navy にする', () => {
    render(<Avatar shirtColor="unknown" />);
    const circle = screen.getByTestId('avatar');
    expect(circle).toHaveAttribute('aria-hidden', 'true');
    expect(circle).toHaveStyle({ backgroundColor: AVATAR_BG.navy });
  });
});
