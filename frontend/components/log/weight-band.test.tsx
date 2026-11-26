import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { toLocalDate } from '@/lib/shared/local-date';
import { calls, installFakeApi, renderWithQuery } from '@/lib/test/fake-api';
import { WeightBand } from './weight-band';

afterEach(() => vi.unstubAllGlobals());

const today = toLocalDate(new Date());
const EMPTY = { heightCm: null, latest: null, bmi: null, avg7: null, deltaFromPrevious: null, weights: [] };
const WITH_TODAY = { ...EMPTY, latest: { date: today, kg: 70.2 }, weights: [{ date: today, kg: 70.2, avg7: 70.2 }] };

// 記録タブの「今日の体重」の帯（02-9 PR 1）。たたんだ1行・押すと定規と保存。体重は本人だけ
describe('WeightBand（記録タブの体重の帯）', () => {
  it('今日の体重がまだなら「今日の体重を入れる」。たたんだ状態では定規は見えない', async () => {
    installFakeApi({ 'GET /api/body': { status: 200, body: EMPTY } });
    renderWithQuery(<WeightBand />);
    const toggle = await screen.findByRole('button', { name: '今日の体重を入れる' });
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByRole('slider')).not.toBeInTheDocument();
  });

  it('今日の体重が入っていれば、たたんだ1行にその値を出す', async () => {
    installFakeApi({ 'GET /api/body': { status: 200, body: WITH_TODAY } });
    renderWithQuery(<WeightBand />);
    expect(await screen.findByRole('button', { name: /今日の体重 70\.2kg/ })).toBeInTheDocument();
  });

  it('押すと開き、もう一度押すと閉じる。開くと「自分だけに見えます」を添える', async () => {
    installFakeApi({ 'GET /api/body': { status: 200, body: EMPTY } });
    renderWithQuery(<WeightBand />);
    const user = userEvent.setup();
    const toggle = await screen.findByRole('button', { name: '今日の体重を入れる' });
    await user.click(toggle);
    expect(toggle).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByText('自分だけに見えます')).toBeInTheDocument();
    await user.click(toggle);
    expect(screen.queryByText('自分だけに見えます')).not.toBeInTheDocument();
  });

  it('保存すると、今日の日付で PUT する（動かさず前回の値のままでも保存できる）', async () => {
    installFakeApi({
      'GET /api/body': { status: 200, body: { ...EMPTY, latest: { date: '2026-01-01', kg: 65 }, weights: [{ date: '2026-01-01', kg: 65, avg7: 65 }] } },
      [`PUT /api/body/weights/${today}`]: { status: 200 },
    });
    renderWithQuery(<WeightBand />);
    const user = userEvent.setup();
    await user.click(await screen.findByRole('button', { name: '今日の体重を入れる' }));
    await user.click(screen.getByRole('button', { name: '保存する' }));
    await waitFor(() => expect(calls).toContain(`PUT /api/body/weights/${today}`));
    expect(await screen.findByText('保存しました')).toBeInTheDocument();
  });

  it('保存に失敗したら、責めずにもう一度を案内する', async () => {
    installFakeApi({
      'GET /api/body': { status: 200, body: EMPTY },
      [`PUT /api/body/weights/${today}`]: { status: 500, body: { code: 'X', message: 'x', details: null } },
    });
    renderWithQuery(<WeightBand />);
    const user = userEvent.setup();
    await user.click(await screen.findByRole('button', { name: '今日の体重を入れる' }));
    await user.click(screen.getByRole('button', { name: '保存する' }));
    expect(await screen.findByRole('alert')).toBeInTheDocument();
  });

  it('読み込めない間は、帯ごと出さない', async () => {
    installFakeApi({ 'GET /api/body': { status: 500, body: { code: 'X', message: 'x', details: null } } });
    renderWithQuery(<WeightBand />);
    await new Promise((r) => setTimeout(r, 50));
    expect(screen.queryByRole('button', { name: /体重/ })).not.toBeInTheDocument();
  });
});
