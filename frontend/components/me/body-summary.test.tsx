import { screen } from '@testing-library/react';
import { installFakeApi, renderWithQuery } from '@/lib/test/fake-api';
import { BodySummary } from './body-summary';

const BODY = {
  heightCm: 170,
  latest: { date: '2026-11-18', kg: 70.2 },
  bmi: 24.3,
  avg7: 70.4,
  deltaFromPrevious: -0.5,
  weights: [{ date: '2026-11-18', kg: 70.2, avg7: 70.4 }],
};
const EMPTY = { heightCm: null, latest: null, bmi: null, avg7: null, deltaFromPrevious: null, weights: [] };

afterEach(() => vi.unstubAllGlobals());

// B14b: 自分タブに体重の7日平均・BMI・からだ画面への入口。判定の言葉は出さない
describe('BodySummary（自分タブのからだ）', () => {
  it('体重があれば、7日の平均と BMI を数字だけで出し、からだ画面へのリンクを出す', async () => {
    installFakeApi({ 'GET /api/body': { status: 200, body: BODY } });
    renderWithQuery(<BodySummary />);
    const section = (await screen.findByRole('heading', { name: 'からだ' })).closest('section')!;
    expect(section).toHaveTextContent('70.4kg');
    expect(section).toHaveTextContent('24.3');
    expect(screen.getByRole('link', { name: /からだを見る/ })).toHaveAttribute('href', '/me/body');
    expect(document.body.textContent).not.toMatch(/肥満|標準|やせ|普通体重/);
  });

  it('身長が無く BMI が出ないときは「—」にする', async () => {
    installFakeApi({ 'GET /api/body': { status: 200, body: { ...BODY, heightCm: null, bmi: null } } });
    renderWithQuery(<BodySummary />);
    await screen.findByText('70.4kg');
    expect(screen.getByText('—')).toBeInTheDocument();
  });

  it('体重が未入力なら、数字は出さず、やさしい誘いとからだ画面へのリンクを出す', async () => {
    installFakeApi({ 'GET /api/body': { status: 200, body: EMPTY } });
    renderWithQuery(<BodySummary />);
    const link = await screen.findByRole('link', { name: /体重を入れてみる/ });
    expect(link).toHaveAttribute('href', '/me/body');
    expect(screen.getByText(/自分だけに見えます/)).toBeInTheDocument();
    expect(screen.queryByText('BMI')).not.toBeInTheDocument();
  });

  it('読み込めなかったときは何も出さない（自分タブの他の部分を邪魔しない）', async () => {
    installFakeApi({});
    const { container } = renderWithQuery(<BodySummary />);
    await new Promise((r) => setTimeout(r, 30));
    expect(container).toBeEmptyDOMElement();
  });
});
