import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { calls, installFakeApi, renderWithQuery } from '@/lib/test/fake-api';
import { BodySettings } from './body-settings';

const BODY = { heightCm: 170, latest: null, bmi: null, avg7: null, deltaFromPrevious: null, weights: [] };
const PROFILE = { userId: 'u1', name: 'たろう', bio: '朝ランしてます', favoriteKind: 'run', activeTime: 'morning' };

afterEach(() => vi.unstubAllGlobals());

// B14b: 設定に身長とプロフィール3欄。血液型・MBTI・基礎代謝は作らない
describe('BodySettings（設定の身長・プロフィール）', () => {
  it('身長の表示と、プロフィール（ひとことだけ）に今の値が入る。よくやる運動・時間帯は無い', async () => {
    installFakeApi({ 'GET /api/body': { status: 200, body: BODY }, 'GET /api/body/profile': { status: 200, body: PROFILE } });
    renderWithQuery(<BodySettings />);
    expect(await screen.findByText('170cm')).toBeInTheDocument();
    expect(screen.getByLabelText('ひとこと')).toHaveValue('朝ランしてます');
    expect(screen.queryByRole('radio', { name: '朝' })).not.toBeInTheDocument();
    expect(screen.queryByText('よくやる運動')).not.toBeInTheDocument();
  });

  it('血液型・MBTI・基礎代謝の欄は無い', async () => {
    installFakeApi({ 'GET /api/body': { status: 200, body: BODY }, 'GET /api/body/profile': { status: 200, body: PROFILE } });
    renderWithQuery(<BodySettings />);
    await screen.findByText('170cm');
    expect(document.body.textContent).not.toMatch(/血液型|MBTI|基礎代謝/);
  });

  it('身長は表示と「からだ」へのリンクだけで、入力欄は無い（入力は /me/body だけ）', async () => {
    installFakeApi({ 'GET /api/body': { status: 200, body: BODY }, 'GET /api/body/profile': { status: 200, body: PROFILE } });
    renderWithQuery(<BodySettings />);
    expect(await screen.findByText('170cm')).toBeInTheDocument();
    expect(screen.queryByLabelText('身長（cm）')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '身長を保存する' })).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: '「からだ」で変える' })).toHaveAttribute('href', '/me/body');
  });

  it('身長が未入力なら「未入力」と出す', async () => {
    installFakeApi({ 'GET /api/body': { status: 200, body: { ...BODY, heightCm: null } }, 'GET /api/body/profile': { status: 200, body: PROFILE } });
    renderWithQuery(<BodySettings />);
    expect(await screen.findByText('未入力')).toBeInTheDocument();
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
