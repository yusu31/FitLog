import { render, screen } from '@testing-library/react';
import { GhostBar } from './ghost-bar';

const bar = () => screen.getByRole('group', { name: '前回との くらべ' });

describe('GhostBar（D3-6 前回と今回を1行で）', () => {
  it('「前回 60kg × 8回 → 今回 60kg × 8回」の1行', () => {
    render(<GhostBar ghost={{ weightKg: 60, reps: 8 }} current={{ weightKg: 60, reps: 8 }} isTrial={false} />);
    expect(bar()).toHaveTextContent('前回 60kg × 8回 今回 60kg × 8回');
    expect(bar().querySelectorAll('p')).toHaveLength(1);
  });

  it('お試し値のときは「前回」でなく「目安」と書く', () => {
    render(<GhostBar ghost={{ weightKg: 20, reps: 10 }} current={{ weightKg: 20, reps: 10 }} isTrial />);
    expect(bar()).toHaveTextContent('目安 20kg × 10回');
    expect(bar()).not.toHaveTextContent('前回');
  });

  it('前回が無ければ、無いと伝える', () => {
    render(<GhostBar ghost={null} current={{ weightKg: 0, reps: 10 }} isTrial={false} />);
    expect(bar()).toHaveTextContent('前回の記録は まだないよ');
  });

  // L5: 0kg は「0kg」と出さず「自重」
  it('0kg は「自重 × 10回」と出す。仲間の数字も同じ', () => {
    render(
      <GhostBar
        ghost={{ weightKg: 0, reps: 10 }}
        current={{ weightKg: 0, reps: 12 }}
        isTrial={false}
        friends={[{ id: 'u2', name: 'はなこ', shirtColor: 'teal', value: { weightKg: 0, reps: 15 } }]}
      />,
    );
    expect(bar()).toHaveTextContent('前回 自重 × 10回 今回 自重 × 12回');
    expect(screen.getByTestId('friend-marker-u2')).toHaveTextContent('自重×15');
    expect(bar()).not.toHaveTextContent('0kg');
  });
});
