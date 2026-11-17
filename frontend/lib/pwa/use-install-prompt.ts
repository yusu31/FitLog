'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

// Chrome（Android など）が「ホーム画面に追加できる状態」になったときに投げる非標準のイベント
type BeforeInstallPromptEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> };

// 設定の「ホーム画面に追加」ボタン用（F7）。イベントを受け取れた端末でだけ canInstall が true になる。
// 受け取れない端末（iPhone の Safari など）は、設定の文章の案内のまま。イベントは1回しか使えないので、使い終えたら捨てる
export function useInstallPrompt() {
  const eventRef = useRef<BeforeInstallPromptEvent | null>(null);
  const [canInstall, setCanInstall] = useState(false);

  useEffect(() => {
    const onPrompt = (e: Event) => {
      e.preventDefault(); // ブラウザ標準の小さな案内は出さず、設定のボタンから出す
      eventRef.current = e as BeforeInstallPromptEvent;
      setCanInstall(true);
    };
    const onInstalled = () => {
      eventRef.current = null;
      setCanInstall(false);
    };
    window.addEventListener('beforeinstallprompt', onPrompt);
    window.addEventListener('appinstalled', onInstalled);
    return () => {
      window.removeEventListener('beforeinstallprompt', onPrompt);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, []);

  const install = useCallback(async () => {
    const event = eventRef.current;
    if (!event) return;
    eventRef.current = null;
    setCanInstall(false);
    await event.prompt();
    await event.userChoice;
  }, []);

  return { canInstall, install };
}
