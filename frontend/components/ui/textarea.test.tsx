import { render, screen } from '@testing-library/react';
import { Input, fieldClass } from './input';
import { Textarea } from './textarea';

describe('入力欄の見た目をそろえる', () => {
  it('Textarea は Input と同じ共通のクラス（枠・角・フォーカス）を使う', () => {
    render(
      <>
        <Input aria-label="1行" />
        <Textarea aria-label="複数行" />
      </>,
    );
    const common = ['rounded-lg', 'border', 'border-input', 'focus-visible:ring-3'];
    for (const name of ['1行', '複数行']) {
      expect(screen.getByRole('textbox', { name })).toHaveClass(...common);
    }
    expect(fieldClass).toContain('border-input');
  });

  it('Textarea は文字を入れられ、rows などの属性を渡せる', () => {
    render(<Textarea aria-label="メモ" rows={3} defaultValue="きょうは脚の日" />);
    expect(screen.getByRole('textbox', { name: 'メモ' })).toHaveValue('きょうは脚の日');
    expect(screen.getByRole('textbox', { name: 'メモ' })).toHaveAttribute('rows', '3');
  });
});
