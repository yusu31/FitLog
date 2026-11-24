import { onlineManager, QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { resetRejectedSends } from '@/lib/offline/rejected';
import { advanceSent, resetSentNotice, SENT_VISIBLE_MS } from '@/lib/offline/sent-notice';
import { QueueOwner } from './queue-owner';
import { SyncBanner } from './sync-banner';

let session: { data: unknown; isPending: boolean } = { data: { user: { id: 'u1' } }, isPending: false };
let path = '/record';
vi.mock('@/lib/use-app-session', () => ({ useAppSession: () => session }));
vi.mock('@/lib/offline/resume', () => ({ setQueueOwner: vi.fn() }));
vi.mock('next/navigation', () => ({ usePathname: () => path }));

const wrap = (ui: React.ReactNode) => <QueryClientProvider client={new QueryClient()}>{ui}</QueryClientProvider>;

beforeEach(() => {
  vi.useFakeTimers();
  session = { data: { user: { id: 'u1' } }, isPending: false };
  path = '/record';
  onlineManager.setOnline(true);
  resetRejectedSends();
  resetSentNotice();
});
afterEach(() => {
  cleanup();
  onlineManager.setOnline(true);
  vi.useRealTimers();
});

describe('A11-2: 電波なしの帯', () => {
  it('電波が無いとき、送信待ちが0件でも「電波なし」を出す', () => {
    onlineManager.setOnline(false);
    render(wrap(<SyncBanner />));
    expect(screen.getByTestId('sync-banner')).toHaveTextContent('電波なし');
  });

  it('電波があるときは出さない', () => {
    render(wrap(<SyncBanner />));
    expect(screen.getByTestId('sync-banner')).toBeEmptyDOMElement();
  });

  it('電波が戻ったら消える', () => {
    onlineManager.setOnline(false);
    render(wrap(<SyncBanner />));
    act(() => onlineManager.setOnline(true));
    expect(screen.getByTestId('sync-banner')).toBeEmptyDOMElement();
  });

  it('帯を持たない画面（種目を選ぶ）でも、QueueOwner が「電波なし」を重ねる。帯を持つ画面（今日・記録）では二重に出さない', () => {
    onlineManager.setOnline(false);
    path = '/exercises';
    const { unmount } = render(wrap(<QueueOwner />));
    expect(screen.getByTestId('sync-banner')).toHaveTextContent('電波なし');
    unmount();
    for (const own of ['/today', '/record']) {
      path = own;
      const r = render(wrap(<QueueOwner />));
      expect(screen.queryByTestId('sync-banner')).not.toBeInTheDocument();
      r.unmount();
    }
  });
});

describe('A11-1: 「送ったよ」', () => {
  it('帯を出している間に全部送れたら、画面を移っても「N件 送ったよ」が残り、6秒後に消える', () => {
    // 電波なしで 2件たまった → 送れた、を、画面の部品の外の控えに流す
    advanceSent(2, true, 0);
    advanceSent(0, false, 0);
    render(wrap(<SyncBanner />)); // 送れたあとに開いた画面
    expect(screen.getByTestId('sync-banner')).toHaveTextContent('2件 送ったよ');
    act(() => void vi.advanceTimersByTime(SENT_VISIBLE_MS));
    expect(screen.getByTestId('sync-banner')).toBeEmptyDOMElement();
  });

  it('外された分は「送ったよ」に数えない', () => {
    advanceSent(2, true, 0);
    advanceSent(0, false, 1);
    render(wrap(<SyncBanner />));
    expect(screen.getByTestId('sync-banner')).toHaveTextContent('1件 送ったよ');
  });
});
