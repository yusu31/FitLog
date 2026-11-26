import { onlineManager } from '@tanstack/react-query';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { FORBIDDEN_WORDS } from '@/lib/forbidden-words';
import { GPX_MESSAGES, LATE_MESSAGES, RUN_MESSAGES, runSavedMessage } from '@/lib/messages';
import { calls, installFakeApi, renderWithQuery } from '@/lib/test/fake-api';
import { RunView } from './run-view';

// 地図（MapLibre）は WebGL が要るので、この画面のテストでは見せかけの部品に差し替える
vi.mock('@/components/record-detail/route-map', () => ({
  RouteMap: ({ route }: { route: { coordinates: unknown[] } }) => <div data-testid="route-preview">{route.coordinates.length}点</div>,
}));

// GPS の記録（GpsTracker）はここでは見せかけの部品。「終了」を押したときに、GPS が渡す形の結果を onFinish へ渡す
vi.mock('@/components/run/gps-tracker', () => ({
  GpsTracker: ({ onFinish }: { onFinish: (run: unknown) => void }) => (
    <button
      type="button"
      onClick={() =>
        onFinish({
          distanceM: 5000,
          durationS: 1800,
          startedAt: '2026-11-04T02:30:00.000Z',
          route: { type: 'LineString', coordinates: [[0, 0], [0, 0.044966]] },
        })
      }
    >
      GPS を終える（テスト用）
    </button>
  ),
}));

const replace = vi.fn();
const push = vi.fn();
let search = '';
vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace, push }),
  usePathname: () => '/run/',
  useSearchParams: () => new URLSearchParams(search),
}));
let session: { data: unknown; isPending: boolean } = { data: { user: { id: 'u1' } }, isPending: false };
vi.mock('@/lib/auth-client', () => ({ authClient: { useSession: () => session } }));

const NOW = '2026-11-04T03:00:00.000Z';
const POST = 'POST /api/records';
const STATS_URL = 'GET /api/me/stats?date=2026-11-04';

beforeEach(() => {
  search = '';
  replace.mockClear();
  push.mockClear();
  session = { data: { user: { id: 'u1' } }, isPending: false };
  vi.useFakeTimers({ toFake: ['Date'], now: new Date(NOW) });
});
afterEach(() => {
  onlineManager.setOnline(true);
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

const km = () => screen.getByRole('textbox', { name: '距離（km）' });
const min = () => screen.getByRole('textbox', { name: '時間（分）' });
const sec = () => screen.getByRole('textbox', { name: '時間（秒）' });
const save = () => screen.getByRole('button', { name: '保存する' });

// 開始前の画面では入力欄は隠れている。「手入力で記録」を押して出す（もう出ているときは何もしない）
async function openManual(user: ReturnType<typeof userEvent.setup>) {
  const open = screen.queryByRole('button', { name: '手入力で記録' });
  if (open) await user.click(open);
}

async function fill(user: ReturnType<typeof userEvent.setup>, k: string, m: string, s = '') {
  await openManual(user);
  await user.clear(km());
  if (k) await user.type(km(), k);
  await user.clear(min());
  if (m) await user.type(min(), m);
  await user.clear(sec());
  if (s) await user.type(sec(), s);
}

const postBody = () => {
  const call = vi.mocked(globalThis.fetch).mock.calls.find(([, init]) => init?.method === 'POST');
  return JSON.parse(String(call?.[1]?.body));
};

describe('RunView（S-13 記録（ラン））', () => {
  describe('きのうの分（?day=yesterday。F-21）', () => {
    it('手入力で保存すると、きのうの12:00（日本時間）の日時と late:true を送る。帯を出す', async () => {
      search = 'day=yesterday';
      installFakeApi({ [POST]: { status: 201, body: { id: 'x' } } });
      const user = userEvent.setup();
      renderWithQuery(<RunView />);
      expect(screen.getByText(LATE_MESSAGES.banner)).toBeInTheDocument();
      await fill(user, '5', '30');
      await user.click(save());
      await screen.findByText(RUN_MESSAGES.saved);
      expect(postBody()).toMatchObject({ kind: 'run', recordedAt: '2026-11-03T03:00:00.000Z', late: true });
    });

    it('今日のとき（day なし）は late を付けず、帯も出さない', async () => {
      installFakeApi({ [POST]: { status: 201, body: { id: 'x' } } });
      const user = userEvent.setup();
      renderWithQuery(<RunView />);
      expect(screen.queryByText(LATE_MESSAGES.banner)).not.toBeInTheDocument();
      await fill(user, '5', '30');
      await user.click(save());
      await screen.findByText(RUN_MESSAGES.saved);
      expect(postBody()).not.toHaveProperty('late');
      expect(postBody().recordedAt).toBe(NOW);
    });
  });

  describe('入力', () => {
    // D4: 開始前の画面は START が主役。手入力の欄と保存ボタンは「手入力で記録」を押すまで出さない
    it('はじめは入力欄も保存ボタンも出さず、「手入力で記録」を押すと出る', async () => {
      installFakeApi({});
      const user = userEvent.setup();
      renderWithQuery(<RunView />);
      expect(screen.getByRole('heading', { level: 1, name: 'ラン' })).toBeInTheDocument();
      expect(screen.queryByRole('textbox', { name: '距離（km）' })).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: '保存する' })).not.toBeInTheDocument();
      await user.click(screen.getByRole('button', { name: '手入力で記録' }));
      expect(screen.queryByRole('button', { name: '手入力で記録' })).not.toBeInTheDocument();
      expect(km()).toHaveValue('');
      expect(min()).toHaveValue('');
      expect(sec()).toHaveValue('');
      expect(save()).toBeDisabled();
    });

    it('GPX の手に入れ方を一言で案内する（F6）', () => {
      installFakeApi({});
      renderWithQuery(<RunView />);
      expect(screen.getByText(/ラン用のアプリ.*書き出し/)).toBeInTheDocument();
    });

    it('ルートの地図は、取り込む前には出さない（GPX を選ぶ入口と、日本縦断の帯だけある）', () => {
      installFakeApi({});
      renderWithQuery(<RunView />);
      expect(screen.queryByTestId('route-preview')).not.toBeInTheDocument();
      expect(screen.getByTestId('trek-strip')).toBeInTheDocument();
    });

    it('日本縦断の帯に、いまの場所と次の地点までを出す（累計 160km → 鹿児島のあたり・次の熊本まで 10.0km）', async () => {
      installFakeApi({ [STATS_URL]: { status: 200, body: { totalRunDistanceM: 160_000 } } });
      renderWithQuery(<RunView />);
      expect(await screen.findByText('次の熊本まで 10.0km')).toBeInTheDocument();
      expect(screen.getByTestId('trek-strip')).toHaveTextContent('鹿児島のあたり');
    });

    // T-RUNP-04（U18）: 保存後の表示も 0.01km の桁まで（取り込み直後の 5.04 とそろう）
    it('5.04km で保存すると、結果の画面にも 5.04km と出す', async () => {
      installFakeApi({ [POST]: { status: 201, body: { id: 'x' } } });
      const user = userEvent.setup();
      renderWithQuery(<RunView />);
      await fill(user, '5.04', '30');
      await user.click(save());
      expect(await screen.findByText(/5\.04km/)).toBeInTheDocument();
    });

    // T-RUNP-05（U6）: 保存前の累計と保存後の累計を比べて、日本縦断の前進を出す。累計が分からないとき（電波なしなど）は出さない
    describe('日本縦断の前進（U6）', () => {
      it('地点をまたいだら「◯◯に着きました」と次の地点までを出す', async () => {
        installFakeApi({ [POST]: { status: 201, body: { id: 'x' } }, [STATS_URL]: { status: 200, body: { totalRunDistanceM: 160_000 } } });
        const user = userEvent.setup();
        renderWithQuery(<RunView />);
        await waitFor(() => expect(calls).toContain(STATS_URL));
        await fill(user, '20', '120');
        await user.click(save());
        expect(await screen.findByText('熊本に着きました！')).toBeInTheDocument();
        expect(screen.getByText('次の福岡まで 90.0km')).toBeInTheDocument();
      });
      it('地点の手前なら、着いたとは言わず次の地点までだけ出す', async () => {
        installFakeApi({ [POST]: { status: 201, body: { id: 'x' } }, [STATS_URL]: { status: 200, body: { totalRunDistanceM: 160_000 } } });
        const user = userEvent.setup();
        renderWithQuery(<RunView />);
        await waitFor(() => expect(calls).toContain(STATS_URL));
        await fill(user, '5', '30');
        await user.click(save());
        expect(await screen.findByText('次の熊本まで 5.0km')).toBeInTheDocument();
        expect(screen.queryByText(/に着きました/)).not.toBeInTheDocument();
      });
      it('入力の画面と保存後の欄の両方から、日本縦断（/me）へ行ける', async () => {
        installFakeApi({ [POST]: { status: 201, body: { id: 'x' } }, [STATS_URL]: { status: 200, body: { totalRunDistanceM: 160_000 } } });
        const user = userEvent.setup();
        renderWithQuery(<RunView />);
        expect(screen.getByRole('link', { name: /日本縦断/ })).toHaveAttribute('href', '/me?metric=m#japan-trek');
        await waitFor(() => expect(calls).toContain(STATS_URL));
        await fill(user, '5', '30');
        await user.click(save());
        await screen.findByTestId('trek-progress');
        expect(screen.getByRole('link', { name: '日本地図で見る' })).toHaveAttribute('href', '/me?metric=m#japan-trek');
      });
      it('累計が読めていないときは、日本縦断の欄を出さない', async () => {
        installFakeApi({ [POST]: { status: 201, body: { id: 'x' } } });
        const user = userEvent.setup();
        renderWithQuery(<RunView />);
        await fill(user, '5', '30');
        await user.click(save());
        await screen.findByText(RUN_MESSAGES.saved);
        expect(screen.queryByTestId('trek-progress')).not.toBeInTheDocument();
      });
    });

    it('ペース（分/km）を、入力に合わせて画面が計算して見せる', async () => {
      installFakeApi({});
      const user = userEvent.setup();
      renderWithQuery(<RunView />);
      await openManual(user);
      expect(screen.getByTestId('pace')).toHaveTextContent('--');
      await fill(user, '5.2', '32', '10');
      expect(screen.getByTestId('pace')).toHaveTextContent(`6'11"/km`);
      await fill(user, '5', '25');
      expect(screen.getByTestId('pace')).toHaveTextContent(`5'00"/km`);
    });

    it('「閉じる」は今日へのリンク', () => {
      installFakeApi({});
      renderWithQuery(<RunView />);
      expect(screen.getByRole('link', { name: 'とじる' })).toHaveAttribute('href', '/log');
    });
  });

  // T-RUN-01〜08 の境界値を、画面の入力から確かめる（km → m・分秒 → 秒の変換を通して）
  describe('範囲（境界値）', () => {
    it.each([
      ['0.099', false], // 99m
      ['0.1', true], // 100m
      ['200', true], // 200000m
      ['200.001', false], // 200001m
    ])('距離 %s km（時間は 30分）→ 保存できる=%s', async (k, ok) => {
      installFakeApi({});
      const user = userEvent.setup();
      renderWithQuery(<RunView />);
      await fill(user, k, '30');
      if (ok) expect(save()).toBeEnabled();
      else expect(save()).toBeDisabled();
    });

    it.each([
      ['5', '0', '59', false],
      ['5', '1', '0', true],
      ['5', '1440', '0', true],
      ['5', '1440', '1', false],
      ['5', '0', '60', false], // 秒は 0〜59
    ])('距離 %s km・時間 %s 分 %s 秒 → 保存できる=%s', async (k, m, s, ok) => {
      installFakeApi({});
      const user = userEvent.setup();
      renderWithQuery(<RunView />);
      await fill(user, k, m, s);
      if (ok) expect(save()).toBeEnabled();
      else expect(save()).toBeDisabled();
    });

    it('範囲の外のときは、どこが違うかを日本語で言う', async () => {
      installFakeApi({});
      const user = userEvent.setup();
      renderWithQuery(<RunView />);
      await fill(user, '201', '30');
      expect(screen.getByText(RUN_MESSAGES.distanceRange)).toBeInTheDocument();
      await fill(user, '5', '1441');
      expect(screen.getByText(RUN_MESSAGES.durationRange)).toBeInTheDocument();
      expect(screen.queryByText(RUN_MESSAGES.distanceRange)).not.toBeInTheDocument();
    });

    it('読めない入力（文字）は保存できない', async () => {
      installFakeApi({});
      const user = userEvent.setup();
      renderWithQuery(<RunView />);
      await fill(user, 'abc', '30');
      expect(save()).toBeDisabled();
    });
  });

  // A07-5: GPS の「終了」のあとは入力画面に戻さず、そのまま保存して完了画面へ進む
  describe('GPS の終了（A07-5）', () => {
    it('終了すると、入力画面に戻らず保存して完了画面を出す（距離・時間・ルート・開始時刻を送る）', async () => {
      installFakeApi({ [POST]: { status: 201, body: { id: 'x' } } });
      const user = userEvent.setup();
      renderWithQuery(<RunView />);
      await user.click(screen.getByRole('button', { name: 'GPS を終える（テスト用）' }));
      expect(await screen.findByText(RUN_MESSAGES.saved)).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: '保存する' })).not.toBeInTheDocument();
      const body = postBody();
      expect(body.run).toEqual({ distanceM: 5000, durationS: 1800, route: { type: 'LineString', coordinates: [[0, 0], [0, 0.044966]] } });
      expect(body.recordedAt).toBe('2026-11-04T02:30:00.000Z');
    });
    it('保存できなかったときは、入力欄に結果を入れた状態で入力画面に残る（もう一度保存できる）', async () => {
      installFakeApi({ [POST]: { status: 400, body: { code: 'VALIDATION', message: 'x' } } });
      const user = userEvent.setup();
      renderWithQuery(<RunView />);
      await user.click(screen.getByRole('button', { name: 'GPS を終える（テスト用）' }));
      expect(await screen.findByRole('alert')).toBeInTheDocument();
      expect(km()).toHaveValue('5');
      expect(save()).toBeEnabled();
    });
  });

  // GPX の取り込み（F-14）。parseGpx の結果を入力欄に入れ、ルートと開始時刻を保存に使う
  describe('GPX の取り込み', () => {
    const gpxText = (t0?: string, t1?: string) =>
      `<?xml version="1.0"?><gpx version="1.1" creator="t" xmlns="http://www.topografix.com/GPX/1/1"><trk><trkseg>` +
      `<trkpt lat="0" lon="0">${t0 ? `<time>${t0}</time>` : ''}</trkpt><trkpt lat="0.044966" lon="0">${t1 ? `<time>${t1}</time>` : ''}</trkpt>` +
      `</trkseg></trk></gpx>`;
    const fileOf = (text: string, name = 'run.gpx') => new File([text], name, { type: 'application/gpx+xml' });
    const picker = () => document.querySelector('input[type="file"]') as HTMLInputElement;
    const pick = (user: ReturnType<typeof userEvent.setup>, f: File) => user.upload(picker(), f);
    const ROUTE = { type: 'LineString', coordinates: [[0, 0], [0, 0.044966]] };

    it('「ほかのアプリの記録を取り込む」の入口がある（.gpx だけ選べる）', () => {
      installFakeApi({});
      renderWithQuery(<RunView />);
      expect(screen.getByText('ほかのアプリの記録を取り込む')).toBeInTheDocument();
      expect(picker()).toHaveAttribute('accept', expect.stringContaining('.gpx'));
      expect(picker()).toBeEnabled();
    });

    it('読み取れたら距離・時間を入力欄に入れ、保存すると route と開始時刻（recordedAt）を送る', async () => {
      installFakeApi({ [POST]: { status: 201, body: { id: 'x' } } });
      const user = userEvent.setup();
      renderWithQuery(<RunView />);
      await pick(user, fileOf(gpxText('2026-11-03T06:00:00Z', '2026-11-03T06:30:00Z')));

      await waitFor(() => expect(km()).toHaveValue('5'));
      expect(min()).toHaveValue('30');
      expect(sec()).toHaveValue('0');
      expect(screen.getByText('run.gpx を読み取りました')).toBeInTheDocument();
      expect(save()).toBeEnabled();

      await user.click(save());
      await screen.findByText(RUN_MESSAGES.saved);
      const body = postBody();
      expect(body.run).toEqual({ distanceM: 5000, durationS: 1800, route: ROUTE });
      expect(body.recordedAt).toBe('2026-11-03T06:00:00.000Z');
    });

    // T-RUNP-06（U19）: 読み取れたら、保存する前にルートの形を地図で確かめられる。はずすと消える
    it('読み取れたらルートの地図を出し、「取り込みをはずす」で消す', async () => {
      installFakeApi({});
      const user = userEvent.setup();
      renderWithQuery(<RunView />);
      expect(screen.queryByTestId('route-preview')).not.toBeInTheDocument();
      await pick(user, fileOf(gpxText('2026-11-03T06:00:00Z', '2026-11-03T06:30:00Z')));
      expect(await screen.findByTestId('route-preview')).toBeInTheDocument();
      await user.click(screen.getByRole('button', { name: '取り込みをはずす' }));
      expect(screen.queryByTestId('route-preview')).not.toBeInTheDocument();
    });

    it('時刻が無い GPX は、距離だけ入れて時間は空のまま（手で入れてもらう）。記録の日時は今', async () => {
      installFakeApi({ [POST]: { status: 201, body: { id: 'x' } } });
      const user = userEvent.setup();
      renderWithQuery(<RunView />);
      await pick(user, fileOf(gpxText()));

      await waitFor(() => expect(km()).toHaveValue('5'));
      expect(min()).toHaveValue('');
      expect(screen.getByText(GPX_MESSAGES.noTime)).toBeInTheDocument();
      expect(save()).toBeDisabled();

      await user.type(min(), '30');
      await user.click(save());
      await screen.findByText(RUN_MESSAGES.saved);
      expect(postBody().run).toEqual({ distanceM: 5000, durationS: 1800, route: ROUTE });
      expect(postBody().recordedAt).toBe(NOW);
    });

    it('GPX の開始が今日より前（日本時間）なら late:true を付ける。今日の GPX には付けない（F-21）', async () => {
      installFakeApi({ [POST]: { status: 201, body: { id: 'x' } } });
      const user = userEvent.setup();
      renderWithQuery(<RunView />);
      await pick(user, fileOf(gpxText('2026-11-03T06:00:00Z', '2026-11-03T06:30:00Z')));
      await waitFor(() => expect(km()).toHaveValue('5'));
      await user.click(save());
      await screen.findByText(RUN_MESSAGES.saved);
      expect(postBody()).toMatchObject({ recordedAt: '2026-11-03T06:00:00.000Z', late: true });
    });

    it('今日の GPX（日本時間の今日）には late を付けない', async () => {
      installFakeApi({ [POST]: { status: 201, body: { id: 'x' } } });
      const user = userEvent.setup();
      renderWithQuery(<RunView />);
      await pick(user, fileOf(gpxText('2026-11-04T00:00:00Z', '2026-11-04T00:30:00Z'))); // 日本時間 11/04 09:00
      await waitFor(() => expect(km()).toHaveValue('5'));
      await user.click(save());
      await screen.findByText(RUN_MESSAGES.saved);
      expect(postBody()).not.toHaveProperty('late');
    });

    it('開始時刻が未来（5分より先）のときは、記録の日時を今にする', async () => {
      installFakeApi({ [POST]: { status: 201, body: { id: 'x' } } });
      const user = userEvent.setup();
      renderWithQuery(<RunView />);
      await pick(user, fileOf(gpxText('2026-11-05T06:00:00Z', '2026-11-05T06:30:00Z')));
      await waitFor(() => expect(km()).toHaveValue('5'));
      await user.click(save());
      await screen.findByText(RUN_MESSAGES.saved);
      expect(postBody().recordedAt).toBe(NOW);
    });

    it.each<[string, string, keyof typeof GPX_MESSAGES]>([
      ['壊れた XML', '<gpx><trk>', 'INVALID_XML'],
      ['線が0本', `<?xml version="1.0"?><gpx version="1.1" xmlns="http://www.topografix.com/GPX/1/1"></gpx>`, 'NO_TRACK'],
      ['距離が範囲外（3m）', `<?xml version="1.0"?><gpx version="1.1" xmlns="http://www.topografix.com/GPX/1/1"><trk><trkseg><trkpt lat="0" lon="0"/><trkpt lat="0.00003" lon="0"/></trkseg></trk></gpx>`, 'OUT_OF_RANGE'],
    ])('読めないファイル（%s）は理由を出し、入力欄は変えず、記録は作らない', async (_name, text, code) => {
      installFakeApi({ [POST]: { status: 201, body: { id: 'x' } } });
      const user = userEvent.setup();
      renderWithQuery(<RunView />);
      await openManual(user);
      await user.type(km(), '3');
      await pick(user, fileOf(text));

      expect(await screen.findByRole('alert')).toHaveTextContent(GPX_MESSAGES[code]);
      expect(km()).toHaveValue('3');
      expect(calls.filter((c) => c === POST)).toHaveLength(0);
    });

    it('大きすぎるファイル（5MB 超）は TOO_LARGE の理由を出す', async () => {
      installFakeApi({});
      const user = userEvent.setup();
      renderWithQuery(<RunView />);
      await pick(user, fileOf('x'.repeat(5 * 1024 * 1024 + 1)));
      expect(await screen.findByRole('alert')).toHaveTextContent(GPX_MESSAGES.TOO_LARGE);
    });

    it('取り込んだあとで距離を手で直したら、ルートは付けない（距離とルートがずれるため）', async () => {
      installFakeApi({ [POST]: { status: 201, body: { id: 'x' } } });
      const user = userEvent.setup();
      renderWithQuery(<RunView />);
      await pick(user, fileOf(gpxText('2026-11-03T06:00:00Z', '2026-11-03T06:30:00Z')));
      await waitFor(() => expect(km()).toHaveValue('5'));

      await user.clear(km());
      await user.type(km(), '4.9');
      expect(screen.queryByText('run.gpx を読み取りました')).not.toBeInTheDocument();
      await user.click(save());
      await screen.findByText(RUN_MESSAGES.saved);
      expect(postBody().run).toEqual({ distanceM: 4900, durationS: 1800 });
      expect(postBody().recordedAt).toBe(NOW);
    });

    it('「はずす」でルートを外せる（入力欄はそのまま）', async () => {
      installFakeApi({ [POST]: { status: 201, body: { id: 'x' } } });
      const user = userEvent.setup();
      renderWithQuery(<RunView />);
      await pick(user, fileOf(gpxText('2026-11-03T06:00:00Z', '2026-11-03T06:30:00Z')));
      await waitFor(() => expect(km()).toHaveValue('5'));
      await user.click(screen.getByRole('button', { name: '取り込みをはずす' }));
      expect(km()).toHaveValue('5');
      await user.click(save());
      await screen.findByText(RUN_MESSAGES.saved);
      expect(postBody().run).toEqual({ distanceM: 5000, durationS: 1800 });
    });

    it('電波が無いときは選べない（GPX は電波があるときだけ。F-30）。理由を出す', async () => {
      installFakeApi({});
      onlineManager.setOnline(false);
      renderWithQuery(<RunView />);
      await waitFor(() => expect(picker()).toBeDisabled());
      expect(screen.getByText(GPX_MESSAGES.offline)).toBeInTheDocument();
    });
  });

  describe('保存', () => {
    it('POST /records に kind=run と run（m と秒の整数）を送り、結果の一言を出す', async () => {
      installFakeApi({ [POST]: { status: 201, body: { id: 'x', kind: 'run' } } });
      const user = userEvent.setup();
      renderWithQuery(<RunView />);
      await fill(user, '5.2', '32', '10');
      await user.click(save());

      await screen.findByText(RUN_MESSAGES.saved);
      expect(calls.filter((c) => c === POST)).toHaveLength(1);
      const body = postBody();
      expect(body.kind).toBe('run');
      expect(body.run).toEqual({ distanceM: 5200, durationS: 1930 });
      expect(body.recordedAt).toBe(NOW);
      expect(body.id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
      expect(screen.getByText(runSavedMessage(5200, 1930))).toBeInTheDocument();
      expect(screen.getByTestId('pace')).toHaveTextContent(`6'11"/km`);
    });

    it('分だけ・秒だけの入力も読む（空欄は 0）。0.1km を 1分 → 100m・60秒', async () => {
      installFakeApi({ [POST]: { status: 201, body: { id: 'x' } } });
      const user = userEvent.setup();
      renderWithQuery(<RunView />);
      await fill(user, '0.1', '', '60');
      // 秒が 60 は範囲外なので、分に直して入れ直す
      expect(save()).toBeDisabled();
      await fill(user, '0.1', '1', '');
      await user.click(save());
      await screen.findByText(RUN_MESSAGES.saved);
      expect(postBody().run).toEqual({ distanceM: 100, durationS: 60 });
    });

    it('保存後の「今日へ」で今日（/log）へ戻る', async () => {
      installFakeApi({ [POST]: { status: 201, body: { id: 'x' } } });
      const user = userEvent.setup();
      renderWithQuery(<RunView />);
      await fill(user, '5', '25');
      await user.click(save());
      await user.click(await screen.findByRole('button', { name: '今日へ' }));
      expect(push).toHaveBeenCalledWith('/log');
    });

    it('サーバーの不具合（5xx）では、送信待ちに残して結果を出す。内部の事情は出さず、入力画面には戻らない（F-30）', async () => {
      installFakeApi({ [POST]: { status: 500, body: { code: 'INTERNAL', message: 'stack trace' } } });
      const user = userEvent.setup();
      renderWithQuery(<RunView />);
      await fill(user, '5', '25');
      await user.click(save());
      expect(await screen.findByText(RUN_MESSAGES.saved)).toBeInTheDocument();
      expect(document.body.textContent).not.toContain('stack trace');
      expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    });

    it('API が 400 で返した文言は、そのまま出す', async () => {
      installFakeApi({ [POST]: { status: 400, body: { code: 'VALIDATION', message: '距離が 範囲の外です' } } });
      const user = userEvent.setup();
      renderWithQuery(<RunView />);
      await fill(user, '5', '25');
      await user.click(save());
      expect(await screen.findByRole('alert')).toHaveTextContent('距離が 範囲の外です');
    });

    it('送っている間は押せない（二度押しで2件送らない）', async () => {
      let release: () => void = () => {};
      const gate = new Promise<void>((resolve) => (release = resolve));
      installFakeApi({ [POST]: { status: 201, body: { id: 'x' } } });
      const inner = vi.mocked(globalThis.fetch).getMockImplementation()!;
      vi.stubGlobal(
        'fetch',
        vi.fn(async (url: string, init?: RequestInit) => {
          if (init?.method === 'POST') await gate;
          return inner(url, init);
        }),
      );
      const user = userEvent.setup();
      renderWithQuery(<RunView />);
      await fill(user, '5', '25');
      await user.click(save());
      await waitFor(() => expect(save()).toBeDisabled());
      await user.click(save());
      release();
      await screen.findByText(RUN_MESSAGES.saved);
      expect(calls.filter((c) => c === POST)).toHaveLength(1);
    });

    it('電波が無いときも保存できる。待たずに結果を出し、送信は電波が戻るまで待つ（F-30）', async () => {
      installFakeApi({ [POST]: { status: 201, body: { id: 'x' } } });
      const user = userEvent.setup();
      renderWithQuery(<RunView />);
      await fill(user, '5', '25');
      onlineManager.setOnline(false);
      await user.click(save());
      await screen.findByText(RUN_MESSAGES.saved);
      expect(calls.filter((c) => c === POST)).toHaveLength(0);
      onlineManager.setOnline(true);
      await waitFor(() => expect(calls.filter((c) => c === POST)).toHaveLength(1));
    });
  });

  it('ログインしていなければ、戻り先つきでログイン画面へ移す', () => {
    session = { data: null, isPending: false };
    installFakeApi({});
    renderWithQuery(<RunView />);
    expect(replace).toHaveBeenCalledWith(`/login?next=${encodeURIComponent('/run/')}`);
  });

  it('画面の文言に、責めない言葉の禁止語が出ない（入力前・範囲外・保存後）', async () => {
    installFakeApi({ [POST]: { status: 201, body: { id: 'x' } } });
    const user = userEvent.setup();
    renderWithQuery(<RunView />);
    const check = () => {
      for (const word of FORBIDDEN_WORDS) expect(document.body.textContent).not.toContain(word);
    };
    check();
    await fill(user, '201', '0');
    check();
    await fill(user, '5', '25');
    await user.click(save());
    await screen.findByText(RUN_MESSAGES.saved);
    check();
  });
});
