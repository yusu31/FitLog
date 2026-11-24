'use client';

import { SquarePlus, X } from 'lucide-react';
import { useSyncExternalStore } from 'react';
import { ThickButton } from '@/components/fitlog/thick-button';
import { useInstallPrompt } from '@/lib/pwa/use-install-prompt';

export const DISMISSED_KEY = 'fitlog:add-to-home-dismissed';
export const DISMISS_EVENT = 'fitlog:add-to-home-changed';

// 追加済み（ホーム画面から開いている）か、自分で閉じたなら出さない（A10-5）。
// 端末の状態を読むので useSyncExternalStore を使う（最初の描画はサーバーと同じ「出さない」で、そのあと切り替わる）
function readVisible(): 'show' | 'hide' {
  try {
    const standalone =
      (typeof window.matchMedia === 'function' && window.matchMedia('(display-mode: standalone)').matches) ||
      (navigator as Navigator & { standalone?: boolean }).standalone === true;
    if (standalone) return 'hide';
    return localStorage.getItem(DISMISSED_KEY) === '1' ? 'hide' : 'show';
  } catch {
    return 'show';
  }
}

function subscribe(notify: () => void) {
  window.addEventListener(DISMISS_EVENT, notify);
  window.addEventListener('storage', notify);
  return () => {
    window.removeEventListener(DISMISS_EVENT, notify);
    window.removeEventListener('storage', notify);
  };
}

function RowIcon() {
  return (
    <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-teal-light text-brand">
      <SquarePlus aria-hidden className="size-5" />
    </span>
  );
}

export function AddToHome() {
  const visible = useSyncExternalStore(subscribe, readVisible, () => 'hide');
  const { canInstall, install } = useInstallPrompt();
  if (visible === 'hide') return null;

  function onDismiss() {
    try {
      localStorage.setItem(DISMISSED_KEY, '1');
    } catch {
      // 保存できない端末では、この画面を開いている間だけ隠れない（次に開くとまた出る）
    }
    window.dispatchEvent(new Event(DISMISS_EVENT));
  }

  return (
    <section aria-labelledby="add-to-home-heading" className="fl-slab space-y-2 px-4 py-3">
      <div className="flex items-center justify-between gap-2">
        <h2 id="add-to-home-heading" className="flex items-center gap-2 font-extrabold">
          <RowIcon />
          ホーム画面に追加
        </h2>
        <button
          type="button"
          aria-label="ホーム画面に追加の説明を閉じる"
          onClick={onDismiss}
          className="flex size-11 shrink-0 items-center justify-center rounded-fl text-fg-muted outline-none focus-visible:ring-4 focus-visible:ring-teal/40"
        >
          <X aria-hidden className="size-5" />
        </button>
      </div>
      <p className="text-sm text-fg-muted">アプリのように、ホーム画面のアイコンからすぐ開けます。仲間の反応の通知を受け取るにも、この追加が前提です。</p>
      {/* 追加の案内を受け取れた端末（Android の Chrome など）だけ。受け取れない端末は下の文章の案内のまま */}
      {canInstall && (
        <ThickButton tone="white" onClick={() => void install()}>
          <SquarePlus aria-hidden />
          ホーム画面に追加する
        </ThickButton>
      )}
      <dl className="space-y-1 text-sm">
        <div>
          <dt className="font-bold">Android（Chrome）</dt>
          <dd className="text-fg-muted">右上のメニュー（︙）から「ホーム画面に追加」または「アプリをインストール」を選びます。</dd>
        </div>
        <div>
          <dt className="font-bold">iPhone（Safari）</dt>
          <dd className="text-fg-muted">画面下の共有ボタン（□に↑）を押し、「ホーム画面に追加」を選びます。</dd>
        </div>
      </dl>
    </section>
  );
}
