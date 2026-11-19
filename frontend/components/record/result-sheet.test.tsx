import { fireEvent, render, screen } from '@testing-library/react';
import { BodyPart } from '@/lib/api/generated';
import { HEAT_COLORS } from '@/lib/heatmap';
import { ResultSheet, type SheetData } from './result-sheet';

const base: SheetData = { setId: 's1', result: 'up', diff: 100, isPersonalBest: false, summary: 'ベンチプレス 40kg × 10回' };

// F-19: 祝福の中で、今日使った部位を光らせる（ヒートマップ F-12 と同じ体の図）
describe('ResultSheet（今日きたえたところ F-19）', () => {
  it('使った部位だけを一番濃い色にし、部位名も文字で出す', () => {
    render(<ResultSheet sheet={{ ...base, parts: [BodyPart.chest, BodyPart.legs] }} onDismiss={() => {}} />);
    const box = screen.getByTestId('today-parts');
    expect(box).toHaveTextContent('今日きたえたところ: 胸・脚');
    const front = screen.getByTestId('body-front');
    expect(front.querySelector('[data-part="chest"]')).toHaveAttribute('fill', HEAT_COLORS[3]);
    expect(front.querySelector('[data-part="legs"]')).toHaveAttribute('fill', HEAT_COLORS[3]);
    expect(front.querySelector('[data-part="arms"]')).toHaveAttribute('fill', HEAT_COLORS[0]);
  });

  it('部位が無い（または空の）ときは、体の図を出さない', () => {
    const { rerender } = render(<ResultSheet sheet={base} onDismiss={() => {}} />);
    expect(screen.queryByTestId('today-parts')).not.toBeInTheDocument();
    rerender(<ResultSheet sheet={{ ...base, parts: [] }} onDismiss={() => {}} />);
    expect(screen.queryByTestId('today-parts')).not.toBeInTheDocument();
  });
});

// F-20: 祝福に「今月◯日目」を重ねる。分からないとき（まだ読み込めていない・電波なし）は出さない
describe('ResultSheet（今月◯日目 F-20）', () => {
  it('monthDay があれば「今月 N 日目」を出す', () => {
    render(<ResultSheet sheet={{ ...base, monthDay: 4 }} onDismiss={() => {}} />);
    expect(screen.getByTestId('month-day')).toHaveTextContent('今月 4 日目');
  });

  it('monthDay が無ければ出さない（0 日目と間違えない）', () => {
    render(<ResultSheet sheet={base} onDismiss={() => {}} />);
    expect(screen.queryByTestId('month-day')).not.toBeInTheDocument();
  });
});

// A02-8: きのうの記録なのに「今日きたえたところ」「今月◯日目」と出ていた。選んだ日に合わせて見出しを替え、日数には「今月の合計」を添える
describe('ResultSheet（選んだ日に合わせた文言 A02-8）', () => {
  it('今日の記録: 「今日きたえたところ」', () => {
    render(<ResultSheet sheet={{ ...base, parts: [BodyPart.chest] }} onDismiss={() => {}} />);
    expect(screen.getByTestId('today-parts')).toHaveTextContent('今日きたえたところ: 胸');
  });
  it('きのうの記録: 「きのうきたえたところ」', () => {
    render(<ResultSheet sheet={{ ...base, day: 'yesterday', parts: [BodyPart.chest] }} onDismiss={() => {}} />);
    expect(screen.getByTestId('today-parts')).toHaveTextContent('きのうきたえたところ: 胸');
    expect(screen.getByTestId('today-parts')).not.toHaveTextContent('今日');
  });
  it('「今月 N 日目」には「（今月の合計）」を添える', () => {
    render(<ResultSheet sheet={{ ...base, monthDay: 4 }} onDismiss={() => {}} />);
    expect(screen.getByTestId('month-day')).toHaveTextContent('今月 4 日目（今月の合計）');
  });
});

// A11-4: 電波が無く、応援キャラの画像が読み込めなかったとき、壊れた画像アイコンを出さない
describe('ResultSheet（画像の読み込み失敗 A11-4）', () => {
  it('キャラの画像は最初は出ていて、読み込みに失敗したら何も出さない', () => {
    render(<ResultSheet sheet={base} onDismiss={() => {}} />);
    const sprite = screen.getByTestId('sprite');
    expect(sprite).toBeInTheDocument();
    fireEvent.error(sprite.querySelector('img')!);
    expect(screen.queryByTestId('sprite')).not.toBeInTheDocument();
    // 文字の結果は残る
    expect(screen.getByTestId('result-sheet')).toHaveTextContent('前回超え');
  });
});

// B14b: 記録直後に「約○kcal」。体重が無い・時間が測れないとき（kcal が無い・null）は出さない
describe('ResultSheet（約○kcal B14b）', () => {
  it('kcal があれば「約 586 kcal」を出す', () => {
    render(<ResultSheet sheet={{ ...base, kcal: 586 }} onDismiss={() => {}} />);
    expect(screen.getByTestId('sheet-kcal')).toHaveTextContent('約 586 kcal');
  });

  it('kcal が無い・null・0 のときは出さない', () => {
    const { rerender } = render(<ResultSheet sheet={base} onDismiss={() => {}} />);
    expect(screen.queryByTestId('sheet-kcal')).not.toBeInTheDocument();
    rerender(<ResultSheet sheet={{ ...base, kcal: null }} onDismiss={() => {}} />);
    expect(screen.queryByTestId('sheet-kcal')).not.toBeInTheDocument();
    rerender(<ResultSheet sheet={{ ...base, kcal: 0 }} onDismiss={() => {}} />);
    expect(screen.queryByTestId('sheet-kcal')).not.toBeInTheDocument();
  });
});
