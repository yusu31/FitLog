import { onlineManager } from '@tanstack/react-query';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { FORBIDDEN_WORDS } from '@/lib/forbidden-words';
import { RUN_MESSAGES, runSavedMessage } from '@/lib/messages';
import { calls, installFakeApi, renderWithQuery } from '@/lib/test/fake-api';
import { RunView } from './run-view';

const replace = vi.fn();
const push = vi.fn();
vi.mock('next/navigation', () => ({ useRouter: () => ({ replace, push }), usePathname: () => '/run/' }));
let session: { data: unknown; isPending: boolean } = { data: { user: { id: 'u1' } }, isPending: false };
vi.mock('@/lib/auth-client', () => ({ authClient: { useSession: () => session } }));

const NOW = '2026-11-04T03:00:00.000Z';
const POST = 'POST /api/records';

beforeEach(() => {
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

async function fill(user: ReturnType<typeof userEvent.setup>, k: string, m: string, s = '') {
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
  describe('入力', () => {
    it('距離（km）と時間（分・秒）の欄がある。何も入れていないうちは保存できない', () => {
      installFakeApi({});
      renderWithQuery(<RunView />);
      expect(screen.getByRole('heading', { level: 1, name: 'ラン' })).toBeInTheDocument();
      expect(km()).toHaveValue('');
      expect(min()).toHaveValue('');
      expect(sec()).toHaveValue('');
      expect(save()).toBeDisabled();
    });

    it('GPX の取り込みと地図は、この画面に置かない（範囲外）', () => {
      installFakeApi({});
      renderWithQuery(<RunView />);
      expect(screen.queryByText(/GPX|地図|ファイル/)).not.toBeInTheDocument();
      expect(document.querySelector('input[type="file"]')).toBeNull();
    });

    it('ペース（分/km）を、入力に合わせて画面が計算して見せる', async () => {
      installFakeApi({});
      const user = userEvent.setup();
      renderWithQuery(<RunView />);
      expect(screen.getByTestId('pace')).toHaveTextContent('--');
      await fill(user, '5.2', '32', '10');
      expect(screen.getByTestId('pace')).toHaveTextContent(`6'11"/km`);
      await fill(user, '5', '25');
      expect(screen.getByTestId('pace')).toHaveTextContent(`5'00"/km`);
    });

    it('「閉じる」は今日へのリンク', () => {
      installFakeApi({});
      renderWithQuery(<RunView />);
      expect(screen.getByRole('link', { name: 'とじる' })).toHaveAttribute('href', '/today');
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

    it('保存後の「今日へ」で今日（/today）へ戻る', async () => {
      installFakeApi({ [POST]: { status: 201, body: { id: 'x' } } });
      const user = userEvent.setup();
      renderWithQuery(<RunView />);
      await fill(user, '5', '25');
      await user.click(save());
      await user.click(await screen.findByRole('button', { name: '今日へ' }));
      expect(push).toHaveBeenCalledWith('/today');
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
