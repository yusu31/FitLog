import { screen } from '@testing-library/react';
import { onlineManager } from '@tanstack/react-query';
import userEvent from '@testing-library/user-event';
import { installFakeApi, renderWithQuery } from '@/lib/test/fake-api';
import { RecordCaption } from './record-caption';

afterEach(() => {
  onlineManager.setOnline(true);
  vi.unstubAllGlobals();
});

const lastPatchBody = () => {
  const call = (fetch as ReturnType<typeof vi.fn>).mock.calls.find(([, init]) => (init as RequestInit | undefined)?.method === 'PATCH');
  return call ? (JSON.parse((call[1] as RequestInit).body as string) as unknown) : undefined;
};

// ひとこと（PR 4）。仲間にも見える。自分の記録では書き直せ、仲間の記録では読むだけ
describe('RecordCaption（ひとこと）', () => {
  it('仲間の記録: ひとことがあれば文だけ出し、入力欄は出さない。無ければ何も出さない', () => {
    installFakeApi({});
    const { container, rerender } = renderWithQuery(<RecordCaption recordId="r1" caption="ジム前" mine={false} />);
    expect(screen.getByText('ジム前')).toBeInTheDocument();
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
    rerender(<RecordCaption recordId="r1" mine={false} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('自分の記録: 今のひとことが入っていて、「仲間にも見えます」と書いてある', () => {
    installFakeApi({});
    renderWithQuery(<RecordCaption recordId="r1" caption="いい汗" mine />);
    expect(screen.getByRole('textbox')).toHaveValue('いい汗');
    expect(screen.getByText('仲間にも見えます')).toBeInTheDocument();
  });

  it('保存すると、PATCH で caption だけを送る（前後の空白は除く）', async () => {
    installFakeApi({ 'PATCH /api/records/r1/memo': { status: 200, body: { note: null, rpe: null, caption: 'ナイス' } } });
    renderWithQuery(<RecordCaption recordId="r1" mine />);
    await userEvent.type(screen.getByRole('textbox'), ' ナイス ');
    await userEvent.click(screen.getByRole('button', { name: '保存する' }));
    expect(await screen.findByRole('status')).toHaveTextContent('保存しました');
    expect(lastPatchBody()).toEqual({ caption: 'ナイス' });
  });

  it('空にして保存すると null（消す）を送る', async () => {
    installFakeApi({ 'PATCH /api/records/r1/memo': { status: 200, body: { note: null, rpe: null, caption: null } } });
    renderWithQuery(<RecordCaption recordId="r1" caption="消す" mine />);
    await userEvent.clear(screen.getByRole('textbox'));
    await userEvent.click(screen.getByRole('button', { name: '保存する' }));
    await screen.findByRole('status');
    expect(lastPatchBody()).toEqual({ caption: null });
  });

  it('50字で止まる（絵文字も1字）。数が見える', async () => {
    installFakeApi({});
    renderWithQuery(<RecordCaption recordId="r1" mine />);
    const input = screen.getByRole('textbox') as HTMLInputElement;
    await userEvent.click(input);
    await userEvent.paste('😀'.repeat(60));
    expect(Array.from(input.value)).toHaveLength(50);
    expect(screen.getByText('50/50')).toBeInTheDocument();
  });

  it('保存に失敗したら責めない文言を出す。電波が無いときは保存できない', async () => {
    installFakeApi({ 'PATCH /api/records/r1/memo': { status: 503, body: {} } });
    renderWithQuery(<RecordCaption recordId="r1" caption="a" mine />);
    await userEvent.click(screen.getByRole('button', { name: '保存する' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('保存できませんでした');
    onlineManager.setOnline(false);
    expect(await screen.findByRole('button', { name: '保存する' })).toBeDisabled();
  });
});
