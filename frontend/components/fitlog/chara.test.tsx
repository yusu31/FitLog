import { act, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_CHARA, SHEET_FRAMES } from '@/lib/chara';
import { Chara } from './chara';
import { POSES } from './sprite';

const mockReducedMotion = (reduce: boolean) =>
  vi.stubGlobal('matchMedia', vi.fn().mockImplementation(() => ({ matches: reduce, addEventListener: vi.fn(), removeEventListener: vi.fn() })));

describe('Chara（組み立てたキャラ・F-32）', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('部品のシートを重ね、いまのコマだけを見せる（コマ幅 = 大きさ・位置は 0 から左へずらす）', () => {
    mockReducedMotion(true);
    render(<Chara settings={DEFAULT_CHARA} pose="run" size={96} />);
    const chara = screen.getByTestId('chara');
    // run はシートの 18 コマ目から
    expect(chara).toHaveAttribute('data-frame', '18');
    const layer = chara.querySelector('[data-layer]') as HTMLElement;
    expect(layer.style.backgroundSize).toBe(`${SHEET_FRAMES * 96}px 96px`);
    expect(layer.style.backgroundPosition).toBe(`${-18 * 96}px 0px`);
  });

  it('コマを順番に切り替える（cheer は 6→7→6。320ms ごと）', () => {
    mockReducedMotion(false);
    render(<Chara settings={DEFAULT_CHARA} pose="cheer" />);
    const frame = () => screen.getByTestId('chara').getAttribute('data-frame');
    expect(frame()).toBe('6');
    act(() => void vi.advanceTimersByTime(POSES.cheer.ms));
    expect(frame()).toBe('7');
    act(() => void vi.advanceTimersByTime(POSES.cheer.ms));
    expect(frame()).toBe('6');
  });

  it('「動きを減らす」設定のときは、ポーズの1コマ目で止まる。飾りなので読み上げからは外れる', () => {
    mockReducedMotion(true);
    render(<Chara settings={DEFAULT_CHARA} pose="stretch" />);
    act(() => void vi.advanceTimersByTime(3000));
    expect(screen.getByTestId('chara')).toHaveAttribute('data-frame', '8');
    expect(screen.getByTestId('chara')).toHaveAttribute('aria-hidden', 'true');
  });
});
