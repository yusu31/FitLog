import { act, renderHook } from '@testing-library/react';
import { useInstallPrompt } from './use-install-prompt';

// Chrome が投げる beforeinstallprompt の偽物（prompt() で案内を出し、userChoice で結果が返る）
function fakeInstallEvent(outcome: 'accepted' | 'dismissed' = 'accepted') {
  const event = new Event('beforeinstallprompt', { cancelable: true }) as Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> };
  event.prompt = vi.fn(async () => {});
  event.userChoice = Promise.resolve({ outcome });
  return event;
}

describe('useInstallPrompt（ホーム画面に追加ボタン。F7）', () => {
  it('イベントを受け取るまでは canInstall が false（iPhone など受け取れない端末は文章の案内のまま）', () => {
    const { result } = renderHook(() => useInstallPrompt());
    expect(result.current.canInstall).toBe(false);
  });

  it('beforeinstallprompt を受け取ると canInstall が true になり、ブラウザ標準の案内は止める', () => {
    const { result } = renderHook(() => useInstallPrompt());
    const event = fakeInstallEvent();
    act(() => {
      window.dispatchEvent(event);
    });
    expect(result.current.canInstall).toBe(true);
    expect(event.defaultPrevented).toBe(true);
  });

  it('install() で prompt() を呼び、選び終えたらボタンは引っ込める（イベントは1回しか使えない）', async () => {
    const { result } = renderHook(() => useInstallPrompt());
    const event = fakeInstallEvent();
    act(() => {
      window.dispatchEvent(event);
    });
    await act(async () => {
      await result.current.install();
    });
    expect(event.prompt).toHaveBeenCalledTimes(1);
    expect(result.current.canInstall).toBe(false);
  });

  it('インストールされたら（appinstalled）ボタンを引っ込める', () => {
    const { result } = renderHook(() => useInstallPrompt());
    act(() => {
      window.dispatchEvent(fakeInstallEvent());
    });
    act(() => {
      window.dispatchEvent(new Event('appinstalled'));
    });
    expect(result.current.canInstall).toBe(false);
  });
});
