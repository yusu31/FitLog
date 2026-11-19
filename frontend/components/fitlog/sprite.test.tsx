import { act, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { POSES, Sprite } from './sprite';

function mockReducedMotion(reduce: boolean) {
  vi.stubGlobal(
    'matchMedia',
    vi.fn().mockImplementation(() => ({ matches: reduce, addEventListener: vi.fn(), removeEventListener: vi.fn() })),
  );
}

describe('Sprite', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('コマを順番に切り替える（cheer は 0→1→0。320ms ごと）', () => {
    mockReducedMotion(false);
    render(<Sprite pose="cheer" />);
    const frame = () => screen.getByTestId('sprite').getAttribute('data-frame');
    expect(frame()).toBe('0');
    act(() => void vi.advanceTimersByTime(POSES.cheer.ms));
    expect(frame()).toBe('1');
    act(() => void vi.advanceTimersByTime(POSES.cheer.ms));
    expect(frame()).toBe('0');
  });

  it('「動きを減らす」設定のときは1コマ目で止まる', () => {
    mockReducedMotion(true);
    render(<Sprite pose="run" />);
    act(() => void vi.advanceTimersByTime(2000));
    expect(screen.getByTestId('sprite').getAttribute('data-frame')).toBe('0');
  });

  it('飾りなので読み上げからは外れ、ポーズ数ぶんの画像を重ねる', () => {
    mockReducedMotion(false);
    const { container } = render(<Sprite pose="relax" />);
    expect(screen.getByTestId('sprite').getAttribute('aria-hidden')).toBe('true');
    expect(container.querySelectorAll('img')).toHaveLength(POSES.relax.frames);
  });

  it('呼び出し側の className で位置を上書きできる（既定は relative）', () => {
    mockReducedMotion(false);
    render(<Sprite pose="idle" className="absolute top-0" />);
    const el = screen.getByTestId('sprite');
    expect(el).toHaveClass('absolute');
    expect(el).not.toHaveClass('relative');
  });

  it('seq が指すコマは、すべて frames の範囲に収まる（画像が無いコマを指さない）', () => {
    for (const [key, p] of Object.entries(POSES)) {
      expect(Math.max(...p.seq), key).toBeLessThan(p.frames);
    }
  });
});

// A13-4: キャラは決まった位置（右上の角）に固定し、見出し・数字に重ねない
describe('Sprite の位置（placement）', () => {
  beforeEach(() => {
    mockReducedMotion(false);
  });
  afterEach(() => vi.unstubAllGlobals());

  it('corner は右上の角に絶対配置し、タップを邪魔しない', () => {
    render(<Sprite pose="idle" placement="corner" />);
    const el = screen.getByTestId('sprite');
    expect(el).toHaveClass('absolute', 'top-0', 'right-4', 'pointer-events-none');
    expect(el).toHaveStyle({ width: '72px', height: '72px' });
  });

  it('既定（inline）は従来どおり relative', () => {
    render(<Sprite pose="idle" />);
    expect(screen.getByTestId('sprite')).toHaveClass('relative');
  });
});
