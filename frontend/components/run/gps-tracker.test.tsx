import { act, cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { FORBIDDEN_WORDS } from '@/lib/forbidden-words';
import { GPS_MESSAGES } from '@/lib/messages';
import { GpsTracker } from './gps-tracker';

// 経線（経度0）に沿って北へ進むと、距離は R × 緯度差(rad)。期待値を手で決められる
const M_PER_DEG = (Math.PI / 180) * 6_371_008.8;
const START = Date.parse('2026-11-19T06:00:00Z');

type Success = (p: GeolocationPosition) => void;
type Failure = (e: GeolocationPositionError) => void;

let success: Success | null;
let failure: Failure | null;
const watchPosition = vi.fn();
const clearWatch = vi.fn();
const release = vi.fn(() => Promise.resolve());
const wakeRequest = vi.fn(() => Promise.resolve({ release }));

function stubBrowser(opts: { geolocation?: boolean; wakeLock?: boolean } = {}) {
  const { geolocation = true, wakeLock = true } = opts;
  success = null;
  failure = null;
  watchPosition.mockReset().mockImplementation((s: Success, f: Failure) => {
    success = s;
    failure = f;
    return 7;
  });
  clearWatch.mockReset();
  release.mockClear();
  wakeRequest.mockClear();
  vi.stubGlobal('navigator', {
    ...(geolocation ? { geolocation: { watchPosition, clearWatch } } : {}),
    ...(wakeLock ? { wakeLock: { request: wakeRequest } } : {}),
  });
}

// 北へ northM の位置が、今の時刻に届いたことにする
function deliver(northM: number, accuracy = 5) {
  act(() => {
    success?.({
      coords: { latitude: northM / M_PER_DEG, longitude: 0, accuracy },
      timestamp: Date.now(),
    } as GeolocationPosition);
  });
}

function tick(ms: number) {
  act(() => {
    vi.advanceTimersByTime(ms);
  });
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date', 'setInterval', 'clearInterval'], now: new Date(START) });
  stubBrowser();
});
afterEach(() => {
  cleanup(); // 偽の navigator を外す前に画面を片づける（アンマウントで clearWatch が呼ばれるため）
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

function setup(onFinish = vi.fn(), onActiveChange = vi.fn()) {
  const user = userEvent.setup({ advanceTimers: (ms) => vi.advanceTimersByTime(ms) });
  render(<GpsTracker onFinish={onFinish} onActiveChange={onActiveChange} />);
  return { user, onFinish, onActiveChange };
}

describe('GpsTracker（GPS で記録する・Web 版）', () => {
  it('開始すると位置の取得と画面の点けっぱなしを始め、位置が届くまで「さがしています」を出す', async () => {
    const { user, onActiveChange } = setup();
    await user.click(screen.getByRole('button', { name: /GPS で記録する/ }));
    expect(watchPosition).toHaveBeenCalledOnce();
    expect(watchPosition.mock.calls[0][2]).toMatchObject({ enableHighAccuracy: true });
    expect(wakeRequest).toHaveBeenCalledWith('screen');
    expect(onActiveChange).toHaveBeenLastCalledWith(true);
    expect(screen.getByText(GPS_MESSAGES.searching)).toBeInTheDocument();
    expect(screen.getByText(GPS_MESSAGES.keepScreenOn)).toBeInTheDocument();
  });

  // D4: 走る前の画面に、常時の黄色の注意は出さない（START 直後に1回だけのシートで伝える。PR-2）
  it('始める前の画面に、「画面を消さないでね」の常時の注意は出さない', () => {
    setup();
    expect(screen.queryByRole('note', { name: '走る前に' })).not.toBeInTheDocument();
    expect(screen.queryByText(GPS_MESSAGES.webNotice)).not.toBeInTheDocument();
  });

  it('動いている間も、画面を消さない案内を目立つ枠で出し続ける', async () => {
    const { user } = setup();
    await user.click(screen.getByRole('button', { name: /GPS で記録する/ }));
    expect(screen.getByRole('note', { name: '画面について' })).toHaveTextContent(GPS_MESSAGES.keepScreenOn);
  });

  it('位置が届くたびに距離・時間・ペースがその場で変わる（精度の悪い点は距離に足さない）', async () => {
    const { user } = setup();
    await user.click(screen.getByRole('button', { name: /GPS で記録する/ }));
    deliver(0);
    tick(10_000);
    deliver(30);
    expect(screen.getByTestId('gps-distance')).toHaveTextContent('0.03');
    expect(screen.getByTestId('gps-time')).toHaveTextContent('0:10');
    expect(screen.getByTestId('gps-pace')).toHaveTextContent('5\'33"/km');
    tick(5_000);
    deliver(500, 80); // 精度 80m の点は捨てる
    expect(screen.getByTestId('gps-distance')).toHaveTextContent('0.03');
  });

  it('終了すると、距離・時間・開始時刻・ルートを GPX 取り込みと同じ形で渡す', async () => {
    const { user, onFinish, onActiveChange } = setup();
    await user.click(screen.getByRole('button', { name: /GPS で記録する/ }));
    for (let i = 0; i <= 6; i++) {
      deliver(i * 30);
      tick(10_000);
    }
    await user.click(screen.getByRole('button', { name: '終了' }));
    expect(onFinish).toHaveBeenCalledOnce();
    const run = onFinish.mock.calls[0][0];
    expect(run.distanceM).toBe(180);
    expect(run.durationS).toBe(70);
    expect(run.startedAt).toBe('2026-11-19T06:00:00.000Z');
    expect(run.route.coordinates).toHaveLength(7);
    expect(onActiveChange).toHaveBeenLastCalledWith(false);
    expect(clearWatch).toHaveBeenCalledWith(7);
    expect(release).toHaveBeenCalled();
    expect(screen.getByRole('button', { name: /GPS で記録する/ })).toBeInTheDocument();
  });

  it('一時停止で取得を止め、止めていた間は時間に数えない。再開でまた取り始める', async () => {
    const { user, onFinish } = setup();
    await user.click(screen.getByRole('button', { name: /GPS で記録する/ }));
    deliver(0);
    tick(60_000);
    deliver(150);
    await user.click(screen.getByRole('button', { name: '一時停止' }));
    expect(clearWatch).toHaveBeenCalledWith(7);
    expect(screen.getByText(GPS_MESSAGES.paused)).toBeInTheDocument();
    tick(600_000); // 10分止まる
    expect(screen.getByTestId('gps-time')).toHaveTextContent('1:00');
    await user.click(screen.getByRole('button', { name: '再開' }));
    expect(watchPosition).toHaveBeenCalledTimes(2);
    deliver(300);
    tick(30_000);
    deliver(330);
    await user.click(screen.getByRole('button', { name: '終了' }));
    expect(onFinish.mock.calls[0][0].durationS).toBe(90); // 60秒＋30秒
  });

  it('短すぎる（0.1km・1分未満）と終了しても渡さず、一時停止にして文言を出す。「記録をやめる」で戻れる', async () => {
    const { user, onFinish, onActiveChange } = setup();
    await user.click(screen.getByRole('button', { name: /GPS で記録する/ }));
    deliver(0);
    tick(5_000);
    deliver(20);
    await user.click(screen.getByRole('button', { name: '終了' }));
    expect(onFinish).not.toHaveBeenCalled();
    expect(screen.getByRole('alert')).toHaveTextContent(GPS_MESSAGES.TOO_SHORT);
    expect(screen.getByText(GPS_MESSAGES.paused)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: '記録をやめる' }));
    expect(onActiveChange).toHaveBeenLastCalledWith(false);
    expect(screen.getByRole('button', { name: /GPS で記録する/ })).toBeInTheDocument();
  });

  it('位置情報の許可が無いときは記録を止めて、手で入れられることを伝える', async () => {
    const { user, onActiveChange } = setup();
    await user.click(screen.getByRole('button', { name: /GPS で記録する/ }));
    act(() => {
      failure?.({ code: 1, PERMISSION_DENIED: 1, POSITION_UNAVAILABLE: 2, TIMEOUT: 3, message: '' } as GeolocationPositionError);
    });
    expect(screen.getByRole('alert')).toHaveTextContent(GPS_MESSAGES.denied);
    expect(onActiveChange).toHaveBeenLastCalledWith(false);
    expect(release).toHaveBeenCalled();
  });

  it('一時的に位置が取れないとき（TIMEOUT）は、記録を続けて次の位置を待つ', async () => {
    const { user } = setup();
    await user.click(screen.getByRole('button', { name: /GPS で記録する/ }));
    act(() => {
      failure?.({ code: 3, PERMISSION_DENIED: 1, POSITION_UNAVAILABLE: 2, TIMEOUT: 3, message: '' } as GeolocationPositionError);
    });
    expect(screen.getByRole('alert')).toHaveTextContent(GPS_MESSAGES.unavailable);
    expect(screen.getByRole('button', { name: '一時停止' })).toBeInTheDocument();
    deliver(0);
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('位置情報が使えない端末では、開始せず文言を出す', async () => {
    stubBrowser({ geolocation: false });
    const { user, onActiveChange } = setup();
    await user.click(screen.getByRole('button', { name: /GPS で記録する/ }));
    expect(screen.getByRole('alert')).toHaveTextContent(GPS_MESSAGES.unsupported);
    expect(onActiveChange).not.toHaveBeenCalledWith(true);
  });

  it('Wake Lock が使えない端末では、記録は続けて「画面を消さずに」と伝える', async () => {
    stubBrowser({ wakeLock: false });
    const { user } = setup();
    await user.click(screen.getByRole('button', { name: /GPS で記録する/ }));
    expect(watchPosition).toHaveBeenCalledOnce();
    expect(screen.getByText(GPS_MESSAGES.noWakeLock)).toBeInTheDocument();
  });

  it('画面を離れる（アンマウント）と、位置の取得も画面の点けっぱなしも止める', async () => {
    const user = userEvent.setup({ advanceTimers: (ms) => vi.advanceTimersByTime(ms) });
    const { unmount } = render(<GpsTracker onFinish={vi.fn()} onActiveChange={vi.fn()} />);
    await user.click(screen.getByRole('button', { name: /GPS で記録する/ }));
    unmount();
    expect(clearWatch).toHaveBeenCalledWith(7);
    expect(release).toHaveBeenCalled();
  });

  it('文言に責める言葉を使わない', () => {
    const all = Object.values(GPS_MESSAGES).join('\n');
    for (const w of FORBIDDEN_WORDS) expect(all).not.toContain(w);
  });
});
