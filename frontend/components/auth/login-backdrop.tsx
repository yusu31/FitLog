'use client';

import { useEffect, useState } from 'react';
import { LOGIN_BACKGROUNDS, LOGIN_BG_KEY, pickBackground, type LoginBackground } from '@/lib/login-backgrounds';

// ログイン画面の上の背景。静的書き出しなので、絵の選択はブラウザ側（onMount）で行う。
// 選ぶまで・絵が無いとき・読めないときは、ティールの単色（呼ぶ側の縞）のまま。読めたら淡くフェードして出す（動きを減らす設定ではフェードなし）。
// 文字の読みやすさのため、絵の上には必ず暗いグラデーションを重ねる（色のコントラスト）
export function LoginBackdrop({ backgrounds = LOGIN_BACKGROUNDS }: { backgrounds?: readonly LoginBackground[] }) {
  const [shown, setShown] = useState<LoginBackground | null>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    let previous: number | null = null;
    try {
      const saved = localStorage.getItem(LOGIN_BG_KEY);
      if (saved !== null && /^\d+$/.test(saved)) previous = Number(saved);
    } catch {
      // 覚えられない端末では、毎回ランダム
    }
    const index = pickBackground(backgrounds.length, previous, new URLSearchParams(window.location.search).get('bg'));
    if (index === null) return;
    try {
      localStorage.setItem(LOGIN_BG_KEY, String(index));
    } catch {
      // 保存できなくても絵は出す
    }
    const bg = backgrounds[index];
    const img = new Image();
    img.onload = () => {
      setShown(bg);
      // 1コマ置いてから濃くする（フェードが効くように）
      requestAnimationFrame(() => setVisible(true));
    };
    // 読めなかったときは何もしない（単色のまま）
    img.src = bg.src;
    return () => {
      img.onload = null;
    };
  }, [backgrounds]);

  return (
    <>
      <div
        aria-hidden="true"
        data-testid="login-backdrop"
        data-shown={shown ? shown.src : ''}
        className={`pointer-events-none absolute inset-0 bg-cover transition-opacity duration-700 motion-reduce:transition-none ${visible ? 'opacity-80' : 'opacity-0'}`}
        style={shown ? { backgroundImage: `url(${shown.src})`, backgroundPosition: shown.position ?? 'center' } : undefined}
      />
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 bg-gradient-to-b from-black/40 via-black/25 to-black/55" />
    </>
  );
}
