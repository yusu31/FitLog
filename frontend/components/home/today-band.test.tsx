import { render, screen } from '@testing-library/react';
import type { GroupDetailResponse } from '@/lib/api/generated';
import { TodayBand } from './today-band';

const AVATAR = { body: 'A', hair: 1, hairColor: 'brown', shirtColor: 'teal', pantsColor: 'navy', accessory: 'none' };
const group = (todays: GroupDetailResponse['members'][number]['today'][]): GroupDetailResponse => ({
  id: 'g1',
  name: '朝トレ部',
  description: null,
  background: 'yard',
  events: [],
  members: todays.map((today, i) => ({ id: `u${i + 1}`, name: `なまえ${i + 1}`, avatar: AVATAR, today })),
});

describe('TodayBand（今日の記録の帯。02-9 PR 7a）', () => {
  it('記録した人の顔だけが並ぶ。分母（何人中何人）は出さない', () => {
    render(<TodayBand group={group(['workout', 'none', 'run'])} meId="u2" />);
    const faces = screen.getAllByTestId('today-band-face');
    // u1・u3 は記録済み、u2（自分）はまだなので点線で入る。全員そろっていないので金色ではない
    expect(faces.map((f) => f.getAttribute('data-today'))).toEqual(['workout', 'none', 'run']);
    expect(screen.getByTestId('today-band')).toHaveAttribute('data-complete', 'false');
    expect(screen.queryByText(/\d+\s*[/／]\s*\d+|人中/)).toBeNull();
  });

  it('仲間のまだの人は出ない。自分のまだは点線のふちで出る', () => {
    render(<TodayBand group={group(['workout', 'none', 'none'])} meId="u3" />);
    const faces = screen.getAllByTestId('today-band-face');
    expect(faces.map((f) => f.getAttribute('data-today'))).toEqual(['workout', 'none']);
    expect(faces[1]).toHaveClass('border-dashed');
    expect(faces[1]).toHaveAccessibleName('なまえ3：まだ');
  });

  it('休みは紫のふち（休みも記録）で、読み上げは「休み」', () => {
    render(<TodayBand group={group(['rest', 'workout'])} meId="u2" />);
    const [rest, workout] = screen.getAllByTestId('today-band-face');
    expect(rest).toHaveClass('border-grape');
    expect(rest).toHaveAccessibleName('なまえ1：休み');
    expect(workout).toHaveClass('border-teal');
  });

  it('全員が記録すると（休みを含めて）金色になる', () => {
    render(<TodayBand group={group(['workout', 'rest', 'run'])} meId="u1" />);
    const band = screen.getByTestId('today-band');
    expect(band).toHaveAttribute('data-complete', 'true');
    expect(band).toHaveClass('bg-gold-light');
    expect(screen.getByText('今日は全員そろった！')).toBeInTheDocument();
  });

  it('自分が記録していなければ、仲間が全員記録しても金色にならない', () => {
    render(<TodayBand group={group(['workout', 'run', 'none'])} meId="u3" />);
    expect(screen.getByTestId('today-band')).toHaveAttribute('data-complete', 'false');
  });

  it('1人だけのグループでは出さない', () => {
    const { container } = render(<TodayBand group={group(['workout'])} meId="u1" />);
    expect(container).toBeEmptyDOMElement();
  });
});
