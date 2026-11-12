import { render, screen } from '@testing-library/react';
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
