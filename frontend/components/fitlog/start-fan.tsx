'use client';

import Link from 'next/link';
import { useCallback, useEffect, useId, useRef, useState, useSyncExternalStore, type PointerEvent as ReactPointerEvent } from 'react';
import { Plus } from 'lucide-react';
import { canRecordVideo } from '@/components/record/video-recorder';
import { setFilmFirst } from '@/lib/film-first';
import { PixelIcon, type PixelAccent } from './pixel-icon';
import type { PixelIconName } from '@/lib/pixel-icons';

const noSubscribe = () => () => {};

// 扇の4つ（左から）。角度は 155°・115°・65°・25°（cx＝cos・cy＝sin）。撮影は「最初の1セットのあとに撮る」の予約つきで筋トレへ（カメラの専用画面は PR 4）
const ITEMS: ReadonlyArray<{ id: string; label: string; href: string; icon: PixelIconName; accent: PixelAccent; film: boolean; needsVideo: boolean; cx: number; cy: number }> = [
  { id: 'strength', label: '筋トレ', href: '/exercises', icon: 'dumbbell', accent: 'teal', film: false, needsVideo: false, cx: -0.906, cy: 0.423 },
  { id: 'run', label: 'ラン', href: '/run', icon: 'shoe', accent: 'coral', film: false, needsVideo: false, cx: -0.423, cy: 0.906 },
  { id: 'camera', label: '撮影', href: '/exercises', icon: 'camera', accent: 'gold', film: true, needsVideo: true, cx: 0.423, cy: 0.906 },
  { id: 'rest', label: 'おやすみ', href: '/rest', icon: 'pillow', accent: 'grape', film: false, needsVideo: false, cx: 0.906, cy: 0.423 },
];

const MOVE_PX = 12; // これ以上動いたら「タップ」でなく「なぞり」

// 中央の ● で開く扇（02-9 PR 3）。
// ・スマホ: ● を押している間だけ4つが出て、指をすべらせて選びたいところで離すと選べる。動かさずに離す（タップ）と開いたままになり、あとで押して選べる
// ・PC: カーソルを重ねると出る（クリックで開いたままにもできる）
// ・キーボード・読み上げ: ● を Enter/Space で開閉。4つは Tab で届く（リンク）。Esc で閉じて ● にもどる
export function StartFan() {
  const [open, setOpen] = useState(false);
  const [sticky, setSticky] = useState(false);
  const [hot, setHot] = useState<string | null>(null);
  const button = useRef<HTMLButtonElement>(null);
  const press = useRef<{ x: number; y: number; moved: boolean; wasSticky: boolean } | null>(null);
  const leaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const groupId = useId();
  const videoCapable = useSyncExternalStore(noSubscribe, canRecordVideo, () => false);
  const items = ITEMS.filter((i) => !i.needsVideo || videoCapable);

  const close = useCallback((refocus = false) => {
    setOpen(false);
    setSticky(false);
    setHot(null);
    if (refocus) button.current?.focus();
  }, []);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && close(true);
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, close]);

  const itemAt = (x: number, y: number): HTMLAnchorElement | null => {
    const el = typeof document.elementFromPoint === 'function' ? document.elementFromPoint(x, y) : null;
    return (el?.closest('[data-fan-item]') as HTMLAnchorElement | null) ?? null;
  };

  function onPointerDown(e: ReactPointerEvent<HTMLButtonElement>) {
    if (e.pointerType === 'mouse') return; // PC は重ねる・クリックで動く
    press.current = { x: e.clientX, y: e.clientY, moved: false, wasSticky: open && sticky };
    e.currentTarget.setPointerCapture?.(e.pointerId);
    setOpen(true);
  }
  function onPointerMove(e: ReactPointerEvent<HTMLButtonElement>) {
    const p = press.current;
    if (!p) return;
    if (!p.moved && Math.hypot(e.clientX - p.x, e.clientY - p.y) > MOVE_PX) p.moved = true;
    setHot(itemAt(e.clientX, e.clientY)?.dataset.fanItem ?? null);
  }
  function onPointerUp(e: ReactPointerEvent<HTMLButtonElement>) {
    const p = press.current;
    if (!p) return;
    press.current = null;
    const target = itemAt(e.clientX, e.clientY);
    if (target) {
      target.click(); // 離したところの丸を選ぶ（リンクの移動と、撮影の予約は丸の onClick が行う）
      close();
    } else if (!p.moved && !p.wasSticky) {
      setSticky(true); // タップ: 開いたままにする
    } else {
      close();
    }
  }
  function onPointerCancel() {
    press.current = null;
    close();
  }

  const cancelLeave = () => {
    if (leaveTimer.current) clearTimeout(leaveTimer.current);
    leaveTimer.current = null;
  };

  return (
    <li
      className="fan relative flex min-w-0 max-w-14 flex-1 items-center lg:order-first lg:mb-2 lg:block lg:max-w-none lg:flex-none"
      data-open={open}
      onPointerEnter={(e) => {
        if (e.pointerType !== 'mouse') return;
        cancelLeave();
        setOpen(true);
      }}
      onPointerLeave={(e) => {
        if (e.pointerType !== 'mouse' || sticky) return;
        cancelLeave();
        leaveTimer.current = setTimeout(() => close(), 250);
      }}
    >
      {open && sticky && <div aria-hidden data-testid="fan-backdrop" className="fixed inset-0 z-[-1]" onPointerDown={() => close()} />}
      <button
        ref={button}
        type="button"
        aria-label="記録を始める"
        aria-haspopup="true"
        aria-expanded={open}
        aria-controls={groupId}
        onClick={(e) => {
          // マウス・キーボードのクリック。スマホのなぞり／タップは pointer の側で扱う（二重に動かさない）
          const type = (e.nativeEvent as PointerEvent).pointerType;
          if (type === 'touch' || type === 'pen') return;
          if (open && sticky) close();
          else {
            setOpen(true);
            setSticky(true);
          }
        }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerCancel}
        onContextMenu={(e) => e.preventDefault()}
        style={{ touchAction: 'none', WebkitTouchCallout: 'none', userSelect: 'none' }}
        className="fl-thick flex aspect-square w-full max-w-14 short:max-w-11 short:lg:max-w-none items-center justify-center gap-2 rounded-full bg-teal-dark text-white outline-none [--thick:var(--color-teal-deep)] focus-visible:ring-4 focus-visible:ring-teal/40 lg:aspect-auto lg:h-12 lg:max-w-none lg:w-full lg:rounded-fl lg:text-lg lg:font-extrabold lg:tracking-wider"
      >
        <Plus aria-hidden className={`size-7 transition-transform lg:size-5 ${open ? 'rotate-45' : ''} motion-reduce:transition-none`} strokeWidth={3} />
        <span aria-hidden className="hidden lg:inline">
          START
        </span>
      </button>
      <div id={groupId} role="group" aria-label="記録のメニュー" onPointerEnter={cancelLeave}>
        {items.map((it, i) => (
          <Link
            key={it.id}
            href={it.href}
            data-fan-item={it.id}
            data-hot={hot === it.id}
            tabIndex={open ? 0 : -1}
            onClick={() => {
              setFilmFirst(it.film && videoCapable);
              close();
            }}
            className="fan-item rounded-fl text-center outline-none focus-visible:ring-4 focus-visible:ring-teal/40"
            style={{ ['--cx' as string]: it.cx, ['--cy' as string]: it.cy, ['--i' as string]: i }}
          >
            <span className="fan-tile flex size-13 items-center justify-center rounded-2xl border-2 border-line-dark bg-surface shadow-md max-[239px]:size-10">
              <PixelIcon name={it.icon} accent={it.accent} size={34} className="max-[239px]:size-6" />
            </span>
            <span className="rounded-full bg-surface px-2 text-note font-extrabold text-fg shadow-sm max-[239px]:px-1 lg:rounded-none lg:bg-transparent lg:text-sm lg:shadow-none">{it.label}</span>
          </Link>
        ))}
      </div>
    </li>
  );
}
