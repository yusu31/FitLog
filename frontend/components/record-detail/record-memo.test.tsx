import { screen, within } from '@testing-library/react';
import { onlineManager } from '@tanstack/react-query';
import userEvent from '@testing-library/user-event';
import { FORBIDDEN_WORDS } from '@/lib/forbidden-words';
import { installFakeApi, renderWithQuery } from '@/lib/test/fake-api';
import { RecordMemo } from './record-memo';

afterEach(() => {
  onlineManager.setOnline(true);
  vi.unstubAllGlobals();
});

const lastPatchBody = () => {
  const call = (fetch as ReturnType<typeof vi.fn>).mock.calls.find(([, init]) => (init as RequestInit | undefined)?.method === 'PATCH');
  return call ? (JSON.parse((call[1] as RequestInit).body as string) as unknown) : undefined;
};

// 記録のメモ・きつさ（F5）。自分の記録の詳細だけに出す。きつさ（RPE）は 1〜10 のボタン
describe('RecordMemo（メモ・きつさ。F5）', () => {
  it('今のメモときつさが入っている（きつさは押された状態で読み上げられる）', () => {
    installFakeApi({});
    renderWithQuery(<RecordMemo recordId="r1" note="肩が重かった" rpe={7} />);
    expect(screen.getByLabelText('メモ')).toHaveValue('肩が重かった');
    expect(screen.getByRole('button', { name: '7' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: '8' })).toHaveAttribute('aria-pressed', 'false');
  });

  it('きつさは 1〜10 の 10 個のボタン', () => {
    installFakeApi({});
    renderWithQuery(<RecordMemo recordId="r1" />);
    expect(screen.getAllByRole('button', { name: /^(10|[1-9])$/ })).toHaveLength(10);
  });

  it('メモときつさを入れて保存すると、PATCH で送り、保存できたと出す', async () => {
    installFakeApi({ 'PATCH /api/records/r1/memo': { status: 200, body: { note: 'いい感じ', rpe: 6 } } });
    renderWithQuery(<RecordMemo recordId="r1" />);
    await userEvent.type(screen.getByLabelText('メモ'), ' いい感じ ');
    await userEvent.click(screen.getByRole('button', { name: '6' }));
    await userEvent.click(screen.getByRole('button', { name: '保存する' }));
    expect(await screen.findByRole('status')).toHaveTextContent('保存しました');
    expect(lastPatchBody()).toEqual({ note: 'いい感じ', rpe: 6 });
  });

  it('同じきつさをもう一度押すと選びを外し、保存では null（消す）を送る。メモが空なら null', async () => {
    installFakeApi({ 'PATCH /api/records/r1/memo': { status: 200, body: { note: null, rpe: null } } });
    renderWithQuery(<RecordMemo recordId="r1" note="" rpe={5} />);
    await userEvent.click(screen.getByRole('button', { name: '5' }));
    expect(screen.getByRole('button', { name: '5' })).toHaveAttribute('aria-pressed', 'false');
    await userEvent.click(screen.getByRole('button', { name: '保存する' }));
    await screen.findByRole('status');
    expect(lastPatchBody()).toEqual({ note: null, rpe: null });
  });

  it('メモは 200 字まで（201 字目は入らない）', async () => {
    installFakeApi({});
    renderWithQuery(<RecordMemo recordId="r1" />);
    const box = screen.getByLabelText('メモ');
    await userEvent.type(box, 'あ'.repeat(201));
    expect(box).toHaveValue('あ'.repeat(200));
  });

  it('保存できなかったとき（サーバーの 5xx）は、責めない文言で出す', async () => {
    installFakeApi({ 'PATCH /api/records/r1/memo': { status: 500, body: { code: 'INTERNAL', message: 'x', details: null } } });
    renderWithQuery(<RecordMemo recordId="r1" />);
    await userEvent.click(screen.getByRole('button', { name: '保存する' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('保存できませんでした');
  });

  it('電波が無いときは保存を押せず、理由を出す（サーバーに置くため）', () => {
    onlineManager.setOnline(false);
    installFakeApi({});
    renderWithQuery(<RecordMemo recordId="r1" />);
    expect(screen.getByRole('button', { name: '保存する' })).toBeDisabled();
    expect(screen.getByText('電波があるときに保存できます')).toBeInTheDocument();
  });

  it('画面の文言に、使ってはいけない語を含まない', () => {
    installFakeApi({});
    renderWithQuery(<RecordMemo recordId="r1" />);
    const text = document.body.textContent ?? '';
    for (const word of FORBIDDEN_WORDS) expect(text).not.toContain(word);
  });

  it('A03-7: きつさの 1・5・10 の目安を添える', () => {
    installFakeApi({});
    renderWithQuery(<RecordMemo recordId="r1" />);
    const guide = screen.getByRole('list', { name: 'きつさの目安' });
    const items = within(guide).getAllByRole('listitem');
    expect(items).toHaveLength(3);
    expect(items[0]).toHaveTextContent('1');
    expect(items[0]).toHaveTextContent('らく');
    expect(items[1]).toHaveTextContent('5');
    expect(items[2]).toHaveTextContent('10');
    expect(items[2]).toHaveTextContent('限界');
    for (const word of FORBIDDEN_WORDS) expect(guide.textContent).not.toContain(word);
  });
});
