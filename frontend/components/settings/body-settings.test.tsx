import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { calls, installFakeApi, renderWithQuery } from '@/lib/test/fake-api';
import { BodySettings } from './body-settings';

const BODY = { heightCm: 170, latest: null, bmi: null, avg7: null, deltaFromPrevious: null, weights: [] };
const PROFILE = { userId: 'u1', name: 'たろう', bio: '朝ランしてます', favoriteKind: 'run', activeTime: 'morning' };

afterEach(() => vi.unstubAllGlobals());

// B14b: 設定に身長とプロフィール3欄。血液型・MBTI・基礎代謝は作らない
describe('BodySettings（設定の身長・プロフィール）', () => {
  it('身長と、プロフィール3欄（ひとこと・よくやる運動・動きやすい時間帯）に今の値が入る', async () => {
    installFakeApi({ 'GET /api/body': { status: 200, body: BODY }, 'GET /api/body/profile': { status: 200, body: PROFILE } });
    renderWithQuery(<BodySettings />);
    expect(await screen.findByLabelText('身長（cm）')).toHaveValue('170');
    expect(screen.getByLabelText('ひとこと')).toHaveValue('朝ランしてます');
    expect(screen.getByRole('radio', { name: 'ラン' })).toBeChecked();
    expect(screen.getByRole('radio', { name: '朝' })).toBeChecked();
  });

  it('血液型・MBTI・基礎代謝の欄は無い', async () => {
    installFakeApi({ 'GET /api/body': { status: 200, body: BODY }, 'GET /api/body/profile': { status: 200, body: PROFILE } });
    renderWithQuery(<BodySettings />);
    await screen.findByLabelText('身長（cm）');
    expect(document.body.textContent).not.toMatch(/血液型|MBTI|基礎代謝/);
  });

  it('身長を保存すると PUT /api/body/height に送る', async () => {
    installFakeApi({
      'GET /api/body': { status: 200, body: BODY },
      'GET /api/body/profile': { status: 200, body: PROFILE },
      'PUT /api/body/height': { status: 200 },
    });
    renderWithQuery(<BodySettings />);
    const input = await screen.findByLabelText('身長（cm）');
    await userEvent.clear(input);
    await userEvent.type(input, '172.5');
    await userEvent.click(screen.getByRole('button', { name: '身長を保存する' }));
    expect(await screen.findByText('保存しました')).toBeInTheDocument();
    expect(calls).toContain('PUT /api/body/height');
  });

  it('範囲外の身長は送らず、理由を出す', async () => {
    installFakeApi({ 'GET /api/body': { status: 200, body: BODY }, 'GET /api/body/profile': { status: 200, body: PROFILE } });
    renderWithQuery(<BodySettings />);
    const input = await screen.findByLabelText('身長（cm）');
    await userEvent.clear(input);
    await userEvent.type(input, '50');
    await userEvent.click(screen.getByRole('button', { name: '身長を保存する' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('100〜250');
    expect(calls.some((c) => c.startsWith('PUT'))).toBe(false);
  });

  it('プロフィールを保存すると PUT /api/body/profile に送る', async () => {
    installFakeApi({
      'GET /api/body': { status: 200, body: BODY },
      'GET /api/body/profile': { status: 200, body: PROFILE },
      'PUT /api/body/profile': { status: 200, body: PROFILE },
    });
    renderWithQuery(<BodySettings />);
    await screen.findByLabelText('ひとこと');
    await userEvent.click(screen.getByRole('button', { name: '保存する' }));
    await waitFor(() => expect(calls).toContain('PUT /api/body/profile'));
  });
});
