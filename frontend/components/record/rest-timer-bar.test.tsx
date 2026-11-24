import { act, fireEvent, render, screen } from '@testing-library/react';
import { RestTimerBar } from './rest-timer-bar';

const START = new Date('2026-11-18T10:00:00Z').getTime();

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(START);
  localStorage.clear();
});
afterEach(() => {
  vi.useRealTimers();
  Reflect.deleteProperty(navigator, 'vibrate');
});

const renderBar = (seconds = 90, onClose = vi.fn()) => {
  render(<RestTimerBar startedAt={START} initialSeconds={seconds} onClose={onClose} />);
  return onClose;
};
const expand = () => fireEvent.click(screen.getByRole('button', { name: '大きなタイマーで見る' }));
const advance = (ms: number) => act(() => vi.advanceTimersByTime(ms));

describe('RestTimerBar（F-34 休憩タイマー）', () => {
  // A12-4 / N-06: 195 幅（200% 拡大）で「−」「＋」が枠の外へ欠けない。折り返せて、縮まず、24px 以上
  it('小さい画面でも「−」「＋」が欠けない（折り返せる・縮まない・24px 以上の大きさ）', () => {
    renderBar(90);
    expand();
    const minus = screen.getByRole('button', { name: '休憩を15秒短くする' });
    const plus = screen.getByRole('button', { name: '休憩を15秒長くする' });
    expect(minus.parentElement?.className).toMatch(/flex-wrap/);
    for (const b of [minus, plus]) {
      expect(b.className).toMatch(/shrink-0/);
      expect(b.className).toMatch(/size-11/);
    }
  });

  // T-REST-04: 残りが1秒ずつ減る
  it('はじめは長さどおり、時間がたつと残りが減る', () => {
    renderBar(90);
    expect(screen.getByTestId('rest-remaining')).toHaveTextContent('1:30');
    advance(30_000);
    expect(screen.getByTestId('rest-remaining')).toHaveTextContent('1:00');
  });

  // T-REST-05: ±15 秒で長さが変わり、端末に保存される。端で押せなくなる
  it('＋で15秒長くして保存し、−で15秒短くして保存する', () => {
    renderBar(90);
    expand();
    fireEvent.click(screen.getByRole('button', { name: '休憩を15秒長くする' }));
    expect(screen.getByTestId('rest-remaining')).toHaveTextContent('1:45');
    expect(localStorage.getItem('fitlog:rest-seconds')).toBe('105');
    fireEvent.click(screen.getByRole('button', { name: '休憩を15秒短くする' }));
    fireEvent.click(screen.getByRole('button', { name: '休憩を15秒短くする' }));
    expect(localStorage.getItem('fitlog:rest-seconds')).toBe('75');
  });
  it('15秒では「短くする」、600秒では「長くする」が押せない', () => {
    const { unmount } = render(<RestTimerBar startedAt={START} initialSeconds={15} onClose={vi.fn()} />);
    expand();
    expect(screen.getByRole('button', { name: '休憩を15秒短くする' })).toBeDisabled();
    unmount();
    render(<RestTimerBar startedAt={START} initialSeconds={600} onClose={vi.fn()} />);
    expand();
    expect(screen.getByRole('button', { name: '休憩を15秒長くする' })).toBeDisabled();
  });

  // D3 L8: 帯は1行。＋30秒・スキップだけ。大きい数字・進捗バーは帯を押したときの全画面にある
  it('帯は1行（残り時間・＋30秒・スキップ）で、進捗バーと ±15秒は出さない', () => {
    renderBar(90);
    const band = screen.getByRole('region', { name: '休憩タイマー' });
    expect(band.className).not.toMatch(/inset-0/);
    expect(screen.getByRole('button', { name: '休憩を30秒長くする' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '休憩をスキップ' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '休憩を15秒長くする' })).not.toBeInTheDocument();
    expect(band.querySelector('.h-2')).toBeNull();
  });
  it('＋30秒で30秒長くして保存する', () => {
    renderBar(90);
    fireEvent.click(screen.getByRole('button', { name: '休憩を30秒長くする' }));
    expect(screen.getByTestId('rest-remaining')).toHaveTextContent('2:00');
    expect(localStorage.getItem('fitlog:rest-seconds')).toBe('120');
  });
  it('帯を押すと全画面になり、進捗バーが出る。小さくすると帯にもどる', () => {
    renderBar(90);
    expand();
    const full = screen.getByRole('region', { name: '休憩タイマー' });
    expect(full.className).toMatch(/inset-0/);
    expect(full.querySelector('.h-2')).not.toBeNull();
    fireEvent.click(screen.getByRole('button', { name: '小さくして下の帯にもどす' }));
    expect(screen.getByRole('region', { name: '休憩タイマー' }).className).not.toMatch(/inset-0/);
  });

  // T-REST-06: スキップで閉じる
  it('スキップを押すと閉じる', () => {
    const onClose = renderBar(90);
    fireEvent.click(screen.getByRole('button', { name: '休憩をスキップ' }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  // T-REST-07: 0 秒で「休憩おわり」と振動。振動できない端末でも落ちない
  it('0秒になると「休憩おわり」を出し、振動できる端末では1回震わせる', () => {
    const vibrate = vi.fn();
    Object.defineProperty(navigator, 'vibrate', { value: vibrate, configurable: true });
    renderBar(15);
    expect(screen.queryByText('休憩おわり')).not.toBeInTheDocument();
    advance(15_000);
    expect(screen.getAllByText('休憩おわり').length).toBeGreaterThan(0);
    expect(vibrate).toHaveBeenCalledTimes(1);
    advance(5_000);
    expect(vibrate).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('button', { name: '休憩をとじる' })).toBeInTheDocument();
  });
  it('振動できない端末（navigator.vibrate なし）でも、休憩おわりまで進める', () => {
    renderBar(15);
    expect(() => advance(15_000)).not.toThrow();
    expect(screen.getAllByText('休憩おわり').length).toBeGreaterThan(0);
  });
});
