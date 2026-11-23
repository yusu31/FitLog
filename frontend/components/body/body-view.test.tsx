import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { calls, installFakeApi, renderWithQuery } from '@/lib/test/fake-api';
import { toLocalDate } from '@/lib/shared/local-date';
import { BodyPage } from './body-view';

vi.mock('@/lib/use-require-session', () => ({ useRequireSession: () => ({ signedIn: true }) }));

const today = toLocalDate(new Date());
const daysAgo = (n: number) => toLocalDate(new Date(Date.now() - n * 86_400_000));
const BODY = {
  heightCm: 170,
  latest: { date: daysAgo(1), kg: 70.2 },
  bmi: 24.3,
  avg7: 70.4,
  deltaFromPrevious: -0.5,
  weights: [
    { date: daysAgo(2), kg: 70.7, avg7: 70.7 },
    { date: daysAgo(1), kg: 70.2, avg7: 70.4 },
  ],
};
const EMPTY = { heightCm: null, latest: null, bmi: null, avg7: null, deltaFromPrevious: null, weights: [] };
const PROFILE = { userId: 'u1', name: 'たろう', bio: null, favoriteKind: null, activeTime: null };
const ONE_RM = { items: [{ exerciseId: 'e1', name: 'スクワット', kg: 86, weightKg: 60, reps: 13, approximate: true, date: '2026-11-18' }] };

const routes = (body: unknown = BODY, oneRm: unknown = ONE_RM) => ({
  'GET /api/body': { status: 200, body },
  'GET /api/body/one-rm': { status: 200, body: oneRm },
  'GET /api/body/profile': { status: 200, body: PROFILE },
});

afterEach(() => vi.unstubAllGlobals());

// からだ（B14a）。判定の言葉は出さず、数字だけを出す
describe('BodyPage（からだ）', () => {
  it('BMI・7日の平均・前回からの増減を数字だけで出す。判定の言葉は出さない', async () => {
    installFakeApi(routes());
    renderWithQuery(<BodyPage />);
    const section = (await screen.findByRole('heading', { name: '数字' })).closest('section')!;
    expect(section).toHaveTextContent('24.3');
    expect(section).toHaveTextContent('70.4kg');
    expect(section).toHaveTextContent('-0.5kg');
    expect(document.body.textContent).not.toMatch(/肥満|標準|やせ|普通体重/);
  });

  it('何も入れていないときは「—」と、身長と体重を入れると出ますの案内・グラフは空の案内', async () => {
    installFakeApi(routes(EMPTY, { items: [] }));
    renderWithQuery(<BodyPage />);
    const section = (await screen.findByRole('heading', { name: '数字' })).closest('section')!;
    expect(within(section).getAllByText('—')).toHaveLength(3);
    expect(section).toHaveTextContent('身長と体重を入れると出ます');
    expect(screen.getByText('体重を入れると、ここにグラフが出ます')).toBeInTheDocument();
    expect(screen.getByText('筋トレを記録すると、種目ごとに出ます')).toBeInTheDocument();
  });

  it('グラフは7日平均の線が主役（太い線1本）で、日々の体重は点で出る', async () => {
    installFakeApi(routes());
    renderWithQuery(<BodyPage />);
    await screen.findByRole('heading', { name: '体重のうつりかわり' });
    expect(screen.getAllByTestId('weight-dot')).toHaveLength(2);
    expect(screen.getByTestId('weight-avg-line')).toHaveAttribute('stroke-width', '4');
  });

  it('13回以上のセットが元の推定1RMには「目安」が付く', async () => {
    installFakeApi(routes());
    renderWithQuery(<BodyPage />);
    const row = (await screen.findByText('スクワット')).closest('li')!;
    expect(row).toHaveTextContent('86kg');
    expect(row).toHaveTextContent('目安');
    expect(row).toHaveTextContent('60kg × 13回');
  });

  it('ルーラーは前回の値から始まり、矢印キーで 0.1kg ずつ動く', async () => {
    installFakeApi(routes());
    const user = userEvent.setup();
    renderWithQuery(<BodyPage />);
    const ruler = await screen.findByRole('slider', { name: '体重（kg）' });
    expect(ruler).toHaveAttribute('aria-valuenow', '70.2');
    ruler.focus();
    await user.keyboard('{ArrowRight}{ArrowRight}');
    expect(ruler).toHaveAttribute('aria-valuenow', '70.4');
    await user.keyboard('{PageDown}');
    expect(ruler).toHaveAttribute('aria-valuenow', '69.4');
  });

  it('ルーラーを動かして保存すると、今日の日付でその値を PUT する', async () => {
    installFakeApi({ ...routes(EMPTY, { items: [] }), [`PUT /api/body/weights/${today}`]: { status: 200 } });
    const user = userEvent.setup();
    renderWithQuery(<BodyPage />);
    const ruler = await screen.findByRole('slider', { name: '体重（kg）' });
    expect(ruler).toHaveAttribute('aria-valuenow', '60');
    ruler.focus();
    await user.keyboard('{ArrowRight}');
    await user.click(screen.getAllByRole('button', { name: '保存する' })[0]);
    await waitFor(() => expect(calls).toContain(`PUT /api/body/weights/${today}`));
    expect(await screen.findByText('保存しました')).toBeInTheDocument();
  });

  it('何も入れていない人が動かさずに保存しても、体重は送らない', async () => {
    installFakeApi(routes(EMPTY, { items: [] }));
    const user = userEvent.setup();
    renderWithQuery(<BodyPage />);
    await screen.findByRole('slider', { name: '体重（kg）' });
    await user.click(screen.getAllByRole('button', { name: '保存する' })[0]);
    expect(await screen.findByText('保存しました')).toBeInTheDocument();
    expect(calls.some((c) => c.startsWith('PUT'))).toBe(false);
  });

  it('ルーラーは範囲（20〜300）の外へは動かない', async () => {
    installFakeApi({ ...routes(EMPTY, { items: [] }) });
    const user = userEvent.setup();
    renderWithQuery(<BodyPage />);
    const ruler = await screen.findByRole('slider', { name: '体重（kg）' });
    ruler.focus();
    for (let i = 0; i < 25; i += 1) await user.keyboard('{PageDown}{PageDown}');
    expect(ruler).toHaveAttribute('aria-valuenow', '20');
  });

  it('グラフは週・月・年で切り替わり、期間の外の点は出ない', async () => {
    installFakeApi({
      ...routes({ ...BODY, weights: [{ date: daysAgo(100), kg: 72, avg7: 72 }, ...BODY.weights] }),
    });
    const user = userEvent.setup();
    renderWithQuery(<BodyPage />);
    await screen.findByRole('heading', { name: '体重のうつりかわり' });
    expect(screen.getByRole('button', { name: '月' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getAllByTestId('weight-dot')).toHaveLength(2);
    await user.click(screen.getByRole('button', { name: '年' }));
    expect(screen.getAllByTestId('weight-dot')).toHaveLength(3);
    await user.click(screen.getByRole('button', { name: '週' }));
    expect(screen.getAllByTestId('weight-dot')).toHaveLength(2);
  });

  it('BMI は色の帯と目盛りで見せ、判定の言葉は出さない', async () => {
    installFakeApi(routes());
    renderWithQuery(<BodyPage />);
    const band = (await screen.findByRole('img', { name: 'BMI 24.3 の位置' })).parentElement!;
    for (const mark of ['18.5', '25', '30']) expect(within(band).getByText(mark)).toBeInTheDocument();
  });

  it('推定1RM の式（重量×…）は出さない', async () => {
    installFakeApi(routes());
    renderWithQuery(<BodyPage />);
    await screen.findByText('スクワット');
    expect(document.body.textContent).not.toMatch(/÷30|1[+＋]回数/);
  });

  it('プロフィールを保存すると PUT /api/body/profile を呼ぶ', async () => {
    installFakeApi({ ...routes(), 'PUT /api/body/profile': { status: 200, body: PROFILE } });
    const user = userEvent.setup();
    renderWithQuery(<BodyPage />);
    await user.type(await screen.findByLabelText('ひとこと'), '朝ランしてます');
    // よくやる運動・動きやすい時間帯は画面から外した（2026-11-23）
    expect(screen.queryByRole('radio', { name: '朝' })).not.toBeInTheDocument();
    await user.click(screen.getAllByRole('button', { name: '保存する' })[1]);
    await waitFor(() => expect(calls).toContain('PUT /api/body/profile'));
  });

  it('読み込めなかったときは案内を出す', async () => {
    installFakeApi({ 'GET /api/body': { status: 500, body: {} }, 'GET /api/body/one-rm': { status: 200, body: { items: [] } }, 'GET /api/body/profile': { status: 200, body: PROFILE } });
    renderWithQuery(<BodyPage />);
    expect(await screen.findByText(/読み込めませんでした/)).toBeInTheDocument();
  });
});
