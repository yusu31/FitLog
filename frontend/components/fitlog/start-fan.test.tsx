import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { StartFan } from './start-fan';

let videoCapable = true;
vi.mock('@/components/record/video-recorder', () => ({ canRecordVideo: () => videoCapable }));
// 撮影の画面そのものは video-recorder・auto-video-recorder のテストで見る。ここでは「開く」ことだけ
vi.mock('@/components/record/auto-video-recorder', () => ({
  AutoVideoRecorder: ({ onClose }: { onClose: () => void }) => <button type="button" onClick={onClose}>撮影の画面</button>,
}));

// 中央ボタンの扇（02-9 PR 3）。スマホ＝押している間に出て、なぞって離したところを選ぶ／PC＝重ねると出る／キーボード＝Enter で開き Tab で届く。
// 丸の動きと見た目（位置・はみ出し）は jsdom では測れないので、ここでは「何が出る・選べる・閉じる」を見る
beforeEach(() => {
  videoCapable = true;
});
afterEach(() => {
  vi.restoreAllMocks();
});

const renderFan = () => render(<ul><StartFan /></ul>);
const plus = () => screen.getByRole('button', { name: 'START 記録を始める' });
// 丸は、行き先のあるものはリンク・撮影はボタン（その場で撮影を開く）。どちらも data-fan-item を持つ
const item = (name: string) => screen.getByText(name).closest('[data-fan-item]') as HTMLElement;
const touch = (type: 'pointerDown' | 'pointerMove' | 'pointerUp', x = 0, y = 0) =>
  fireEvent[type](plus(), { pointerType: 'touch', pointerId: 1, clientX: x, clientY: y });
// 指の下にある要素（jsdom は座標から要素を引けないので差し替える）
const fingerOn = (el: Element | null) => {
  document.elementFromPoint = vi.fn(() => el) as typeof document.elementFromPoint;
};

describe('StartFan（中央の ● の扇）', () => {
  it('はじめは閉じている。4つ（筋トレ・ラン・撮影・おやすみ）には文字のラベルが付き、Tab では届かない', () => {
    renderFan();
    expect(plus()).toHaveAttribute('aria-expanded', 'false');
    for (const label of ['筋トレ', 'ラン', '撮影', 'おやすみ']) {
      expect(screen.getByText(label)).toBeInTheDocument();
      expect(item(label)).toHaveAttribute('tabindex', '-1');
    }
    expect(item('筋トレ')).toHaveAttribute('href', '/exercises');
    expect(item('ラン')).toHaveAttribute('href', '/run');
    expect(item('おやすみ')).toHaveAttribute('href', '/rest');
  });

  it('キーボード: Enter で開き、4つは Tab で届く。Esc で閉じて ● にフォーカスがもどる', async () => {
    const user = userEvent.setup();
    renderFan();
    plus().focus();
    await user.keyboard('{Enter}');
    expect(plus()).toHaveAttribute('aria-expanded', 'true');
    expect(item('筋トレ')).toHaveAttribute('tabindex', '0');
    await user.tab();
    expect(item('筋トレ')).toHaveFocus();
    await user.keyboard('{Escape}');
    expect(plus()).toHaveAttribute('aria-expanded', 'false');
    expect(plus()).toHaveFocus();
  });

  it('PC: カーソルを重ねると開き、外すと少しして閉じる（クリックで開いたままにもできる）', async () => {
    const user = userEvent.setup();
    renderFan();
    await user.hover(plus());
    expect(plus()).toHaveAttribute('aria-expanded', 'true');
    await user.unhover(plus());
    await waitFor(() => expect(plus()).toHaveAttribute('aria-expanded', 'false'));
    await user.click(plus());
    await user.unhover(plus());
    await new Promise((r) => setTimeout(r, 350));
    expect(plus()).toHaveAttribute('aria-expanded', 'true'); // クリックで固定したので、外しても閉じない
    await user.click(plus());
    expect(plus()).toHaveAttribute('aria-expanded', 'false');
  });

  it('スマホ: 押している間だけ開き、指をすべらせた先の丸が強調され、離すとその丸を選べる（筋トレ）', () => {
    renderFan();
    const strength = item('筋トレ');
    const click = vi.fn((e: Event) => e.preventDefault());
    strength.addEventListener('click', click);
    touch('pointerDown', 100, 700);
    expect(plus()).toHaveAttribute('aria-expanded', 'true');
    fingerOn(strength);
    touch('pointerMove', 20, 640);
    expect(strength).toHaveAttribute('data-hot', 'true');
    expect(item('ラン')).toHaveAttribute('data-hot', 'false');
    touch('pointerUp', 20, 640);
    expect(click).toHaveBeenCalledTimes(1); // 離したところの丸が押された
    expect(plus()).toHaveAttribute('aria-expanded', 'false');
  });

  it('スマホ: 撮影を選ぶと、画面を移らずその場で撮影の画面が開く（付け先は自動）。筋トレを選んでも開かない', () => {
    renderFan();
    const strength = item('筋トレ');
    strength.addEventListener('click', (e) => e.preventDefault());
    touch('pointerDown');
    fingerOn(strength);
    touch('pointerMove', 50, 50);
    touch('pointerUp', 50, 50);
    expect(screen.queryByRole('button', { name: '撮影の画面' })).not.toBeInTheDocument();

    touch('pointerDown');
    fingerOn(item('撮影'));
    touch('pointerMove', 50, 50);
    touch('pointerUp', 50, 50);
    expect(screen.getByRole('button', { name: '撮影の画面' })).toBeInTheDocument();
    expect(plus()).toHaveAttribute('aria-expanded', 'false'); // 扇は閉じる
  });

  it('PC・キーボード: 撮影の丸を押すと撮影の画面が開き、閉じると消える', async () => {
    renderFan();
    await userEvent.click(plus());
    await userEvent.click(screen.getByRole('button', { name: '撮影' }));
    await userEvent.click(screen.getByRole('button', { name: '撮影の画面' }));
    expect(screen.queryByRole('button', { name: '撮影の画面' })).not.toBeInTheDocument();
  });

  it('スマホ: 何も無いところで離すと、選ばずに閉じる', () => {
    renderFan();
    touch('pointerDown', 100, 700);
    fingerOn(null);
    touch('pointerMove', 300, 300);
    touch('pointerUp', 300, 300);
    expect(plus()).toHaveAttribute('aria-expanded', 'false');
  });

  it('スマホ: 動かさずに離す（タップ）と開いたままになり、あとで丸を押して選べる。もう一度 ● を押すと閉じる', async () => {
    renderFan();
    fingerOn(plus());
    touch('pointerDown', 100, 700);
    touch('pointerUp', 100, 700);
    expect(plus()).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByTestId('fan-backdrop')).toBeInTheDocument();
    // 開いたままの丸を普通に押せる
    const run = item('ラン');
    const click = vi.fn((e: Event) => e.preventDefault());
    run.addEventListener('click', click);
    await userEvent.setup().click(run);
    expect(click).toHaveBeenCalled();
    expect(plus()).toHaveAttribute('aria-expanded', 'false');
    // もう一度タップで開き、さらにタップで閉じる
    touch('pointerDown', 100, 700);
    touch('pointerUp', 100, 700);
    expect(plus()).toHaveAttribute('aria-expanded', 'true');
    touch('pointerDown', 100, 700);
    touch('pointerUp', 100, 700);
    expect(plus()).toHaveAttribute('aria-expanded', 'false');
  });

  it('スマホ: 指が途中で止められた（cancel）ら閉じる', () => {
    renderFan();
    touch('pointerDown');
    fireEvent.pointerCancel(plus(), { pointerType: 'touch', pointerId: 1 });
    expect(plus()).toHaveAttribute('aria-expanded', 'false');
  });

  it('動画を撮れない端末では「撮影」を出さない（3つ）', () => {
    videoCapable = false;
    renderFan();
    expect(screen.queryByText('撮影')).not.toBeInTheDocument();
    expect(screen.getAllByRole('link', { hidden: true })).toHaveLength(3); // 筋トレ・ラン・おやすみ
  });

  it('長押しの右クリックメニュー（contextmenu）は出さない', () => {
    renderFan();
    expect(fireEvent.contextMenu(plus())).toBe(false);
  });
});
