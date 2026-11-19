import { act, screen, waitFor } from '@testing-library/react';
import { onlineManager } from '@tanstack/react-query';
import userEvent from '@testing-library/user-event';
import { calls, installFakeApi, renderWithQuery } from '@/lib/test/fake-api';
import { SaveRoutine } from './save-routine';

const SAVED = { id: 'rt1', name: '胸の日', createdAt: '2026-11-17T03:00:00.000Z', exercises: [] };

afterEach(() => {
  onlineManager.setOnline(true);
  vi.unstubAllGlobals();
});

const openForm = async () => {
  await userEvent.click(screen.getByRole('button', { name: 'ルーティンに保存' }));
  return screen.getByLabelText('ルーティンの名前');
};

describe('SaveRoutine（記録の詳細の「ルーティンに保存」。F3）', () => {
  it('名前を入れて保存すると、記録の id と前後の空白を除いた名前を送り、保存できたと出す', async () => {
    installFakeApi({ 'POST /api/routines': { status: 201, body: SAVED }, '/api/routines': { status: 200, body: { items: [SAVED], max: 5 } } });
    renderWithQuery(<SaveRoutine recordId="r1" />);
    await userEvent.type(await openForm(), ' 胸の日 ');
    await userEvent.click(screen.getByRole('button', { name: '保存する' }));
    expect(await screen.findByRole('status')).toHaveTextContent('「胸の日」を保存しました');
    const post = (fetch as ReturnType<typeof vi.fn>).mock.calls.find(([, init]) => (init as RequestInit | undefined)?.method === 'POST');
    expect(JSON.parse((post?.[1] as RequestInit).body as string)).toEqual({ name: '胸の日', recordId: 'r1' });
  });

  it('名前が空（空白だけ）のあいだは保存を押せない。21字目は入らない', async () => {
    installFakeApi({});
    renderWithQuery(<SaveRoutine recordId="r1" />);
    const input = await openForm();
    await userEvent.type(input, '   ');
    expect(screen.getByRole('button', { name: '保存する' })).toBeDisabled();
    await userEvent.clear(input);
    await userEvent.type(input, 'あ'.repeat(21));
    expect(input).toHaveValue('あ'.repeat(20));
  });

  it('5つあるとき（409）は、API の文言をそのまま出す', async () => {
    installFakeApi({ 'POST /api/routines': { status: 409, body: { code: 'ROUTINE_LIMIT', message: 'ルーティンは5つまでです。使わないものを消してください', details: null } } });
    renderWithQuery(<SaveRoutine recordId="r1" />);
    await userEvent.type(await openForm(), '6つめ');
    await userEvent.click(screen.getByRole('button', { name: '保存する' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('ルーティンは5つまでです');
    expect(calls).not.toContain('GET /api/routines');
  });

  it('電波が無いときは押せない', async () => {
    installFakeApi({});
    renderWithQuery(<SaveRoutine recordId="r1" />);
    const button = screen.getByRole('button', { name: 'ルーティンに保存' });
    act(() => onlineManager.setOnline(false));
    await waitFor(() => expect(button).toBeDisabled());
    expect(screen.getByText('電波があるときに保存できます')).toBeInTheDocument();
  });

  it('A02-10: 保存ボタンの下に、何が起きるかの説明を1行出す', () => {
    installFakeApi({});
    renderWithQuery(<SaveRoutine recordId="r1" />);
    expect(screen.getByText(/今日の画面から ワンタップで始められます/)).toBeInTheDocument();
  });
});
