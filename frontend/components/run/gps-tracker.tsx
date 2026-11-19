'use client';

import { Navigation, Pause, Play, Square } from 'lucide-react';
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import type { GpxRun } from '@/lib/gpx/parse-gpx';
import { canWatchLocation, isNativeApp, startLocationWatch, type StopWatch } from '@/lib/gps/source';
import { addFix, breakSegment, emptyTrack, finishTrack, movingMs, type FinishError, type TrackState } from '@/lib/gps/track';
import { GPS_MESSAGES } from '@/lib/messages';
import { formatPace, paceSecPerKm } from '@/lib/run';

type Phase = 'idle' | 'running' | 'paused';
type Problem = 'unsupported' | 'denied' | 'unavailable' | FinishError;

// 1:05 / 1:02:09
function clock(totalSec: number): string {
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  return h > 0 ? `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}` : `${m}:${String(s).padStart(2, '0')}`;
}

// ラン画面の「GPS で記録する」。位置を取り、距離・時間・ペースをその場に出す。終了で GpxRun（GPX 取り込みと同じ形）を渡す。
// 計算は lib/gps/track.ts。ここは、ブラウザの位置情報（watchPosition）と画面を点けたままにする仕組み（Wake Lock）の取り回し。
export function GpsTracker({ onFinish, onActiveChange }: { onFinish: (run: GpxRun) => void; onActiveChange: (active: boolean) => void }) {
  const [phase, setPhase] = useState<Phase>('idle');
  const [track, setTrack] = useState<TrackState>(emptyTrack);
  const [problem, setProblem] = useState<Problem | null>(null);
  const [wakeLockMissing, setWakeLockMissing] = useState(false);
  const [now, setNow] = useState(() => Date.now());

  // 開始時刻・一時停止の合計・今の一時停止の始まり（ms）。画面に出す時間の計算に使うので state で持つ
  const [timing, setTiming] = useState<{ startedAt: number; pausedMs: number; pausedAt: number | null }>({ startedAt: 0, pausedMs: 0, pausedAt: null });
  const stopWatchRef = useRef<StopWatch | null>(null);
  const wakeLock = useRef<WakeLockSentinel | null>(null);
  const onActiveChangeRef = useRef(onActiveChange);
  useEffect(() => {
    onActiveChangeRef.current = onActiveChange;
  }, [onActiveChange]);

  const releaseWakeLock = useCallback(() => {
    wakeLock.current?.release().catch(() => {});
    wakeLock.current = null;
  }, []);

  const requestWakeLock = useCallback(async () => {
    if (isNativeApp()) return; // アプリは画面を消しても記録が続く（通知が出る）
    if (!('wakeLock' in navigator)) {
      setWakeLockMissing(true);
      return;
    }
    try {
      wakeLock.current = await navigator.wakeLock.request('screen');
    } catch {
      setWakeLockMissing(true); // 省電力モードなどで断られた。記録は続けて、画面を消さないよう伝える
    }
  }, []);

  const stopWatch = useCallback(() => {
    stopWatchRef.current?.();
    stopWatchRef.current = null;
  }, []);

  const startWatch = useCallback(() => {
    stopWatchRef.current = startLocationWatch(
      (fix) => {
        setProblem(null);
        setTrack((t) => addFix(t, fix));
      },
      (kind) => {
        // 一時的な取れなさは次の位置を待つ。許可が無いときだけ止める
        if (kind === 'denied') {
          stopWatch();
          releaseWakeLock();
          setPhase('idle');
          onActiveChangeRef.current(false);
          setProblem('denied');
        } else {
          setProblem('unavailable');
        }
      },
    );
  }, [releaseWakeLock, stopWatch]);

  // 動いている間、1秒ごとに時計を進める
  useEffect(() => {
    if (phase !== 'running') return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [phase]);

  // 画面が消えると Wake Lock は外れる。戻ってきたら取り直す
  useEffect(() => {
    if (phase !== 'running') return;
    const onVisible = () => {
      if (document.visibilityState === 'visible' && wakeLock.current === null) void requestWakeLock();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, [phase, requestWakeLock]);

  // 画面を離れるときは、位置の取得も画面の点けっぱなしも止める
  useEffect(
    () => () => {
      stopWatchRef.current?.();
      wakeLock.current?.release().catch(() => {});
    },
    [],
  );

  function changePhase(next: Phase) {
    setPhase(next);
    onActiveChange(next !== 'idle');
  }

  function onStart() {
    if (!canWatchLocation()) {
      setProblem('unsupported');
      return;
    }
    setProblem(null);
    setWakeLockMissing(false);
    setTrack(emptyTrack());
    const t = Date.now();
    setTiming({ startedAt: t, pausedMs: 0, pausedAt: null });
    setNow(t);
    changePhase('running');
    startWatch();
    void requestWakeLock();
  }

  function onPause() {
    setTiming((t) => ({ ...t, pausedAt: Date.now() }));
    stopWatch();
    releaseWakeLock();
    setTrack((t) => breakSegment(t));
    changePhase('paused');
  }

  function onResume() {
    const t = Date.now();
    setTiming((cur) => ({ ...cur, pausedMs: cur.pausedMs + (cur.pausedAt !== null ? t - cur.pausedAt : 0), pausedAt: null }));
    setNow(t);
    setProblem(null);
    changePhase('running');
    startWatch();
    void requestWakeLock();
  }

  function onDiscard() {
    stopWatch();
    releaseWakeLock();
    setProblem(null);
    changePhase('idle');
  }

  function onStop() {
    const end = Date.now();
    const paused = timing.pausedMs + (timing.pausedAt !== null ? end - timing.pausedAt : 0);
    const result = finishTrack(track, timing.startedAt, movingMs(timing.startedAt, end, paused));
    if (!result.ok) {
      // 短すぎるときは、止めて（一時停止にして）続けるか破棄を選べるようにする
      if (phase === 'running') onPause();
      setProblem(result.error);
      return;
    }
    stopWatch();
    releaseWakeLock();
    setProblem(null);
    changePhase('idle');
    onFinish(result.value);
  }

  if (phase === 'idle') {
    return (
      <div className="flex flex-col gap-2">
        <button
          type="button"
          onClick={onStart}
          className="fl-slab flex min-h-12 items-center gap-2 px-4 py-3 text-base font-extrabold text-teal-dark outline-none focus-visible:border-teal"
        >
          <Navigation aria-hidden className="size-5 shrink-0" />
          <span>{GPS_MESSAGES.start}</span>
        </button>
        {!isNativeApp() && (
          <p role="note" aria-label="走る前に" className="rounded-fl bg-gold-light px-4 py-3 text-sm font-extrabold text-ink">
            {GPS_MESSAGES.webNotice}
          </p>
        )}
        <p className="text-note text-sub-strong">{GPS_MESSAGES.hint}</p>
        {problem && <ProblemNote problem={problem} />}
      </div>
    );
  }

  const elapsedS = Math.floor(movingMs(timing.startedAt, phase === 'paused' ? (timing.pausedAt ?? now) : now, timing.pausedMs) / 1000);
  const distanceM = Math.round(track.distanceM);
  const pace = elapsedS > 0 ? paceSecPerKm(distanceM, elapsedS) : null;

  return (
    <section aria-label="GPS で記録中" className="flex flex-1 flex-col gap-4">
      <p className="text-sm font-extrabold text-sub-strong">{phase === 'paused' ? GPS_MESSAGES.paused : 'GPS で記録中'}</p>
      <dl className="fl-slab grid gap-3 px-4 py-4">
        <Stat label="距離" unit="km" testId="gps-distance" value={(distanceM / 1000).toFixed(2)} big />
        <div className="grid grid-cols-2 gap-3">
          <Stat label="時間" testId="gps-time" value={clock(elapsedS)} />
          <Stat label="ペース" testId="gps-pace" value={pace === null ? '--' : formatPace(pace)} />
        </div>
      </dl>

      {phase === 'running' && track.points.length === 0 && !problem && (
        <p role="status" className="rounded-fl bg-face px-4 py-3 text-sm font-bold text-ink">
          {GPS_MESSAGES.searching}
        </p>
      )}
      {phase === 'running' && (
        <p role="note" aria-label="画面について" className="rounded-fl bg-gold-light px-4 py-3 text-sm font-extrabold text-ink">
          {isNativeApp() ? GPS_MESSAGES.appBackground : wakeLockMissing ? GPS_MESSAGES.noWakeLock : GPS_MESSAGES.keepScreenOn}
        </p>
      )}
      {problem && <ProblemNote problem={problem} />}

      <div className="mt-auto flex gap-3">
        {phase === 'running' ? (
          <ActionButton onClick={onPause} icon={<Pause aria-hidden className="size-5" />} label="一時停止" />
        ) : (
          <ActionButton onClick={onResume} icon={<Play aria-hidden className="size-5" />} label="再開" />
        )}
        <ActionButton onClick={onStop} icon={<Square aria-hidden className="size-5" />} label="終了" primary />
      </div>
      {phase === 'paused' && (
        <button type="button" onClick={onDiscard} className="min-h-11 self-center rounded-fl px-3 text-sm font-extrabold text-sub-strong underline outline-none focus-visible:ring-4 focus-visible:ring-teal/40">
          記録をやめる
        </button>
      )}
    </section>
  );
}

function ProblemNote({ problem }: { problem: Problem }) {
  return (
    <p role="alert" className="rounded-fl bg-coral-light px-4 py-3 text-sm font-bold text-ink">
      {GPS_MESSAGES[problem]}
    </p>
  );
}

function Stat({ label, value, unit, big = false, testId }: { label: string; value: string; unit?: string; big?: boolean; testId: string }) {
  return (
    <div>
      <dt className="text-note font-extrabold text-sub-strong">{label}</dt>
      <dd className="flex items-baseline gap-1">
        <span data-testid={testId} className={big ? 'fl-num text-[56px] leading-none text-ink' : 'fl-num text-3xl text-ink'}>
          {value}
        </span>
        {unit && <span className="text-xl font-extrabold text-sub-strong">{unit}</span>}
      </dd>
    </div>
  );
}

function ActionButton({ onClick, icon, label, primary = false }: { onClick: () => void; icon: ReactNode; label: string; primary?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={
        primary
          ? 'flex min-h-14 flex-1 items-center justify-center gap-2 rounded-fl bg-teal-dark text-lg font-extrabold text-white shadow-[0_4px_0_var(--color-teal-deep)] outline-none focus-visible:ring-4 focus-visible:ring-teal/40'
          : 'fl-slab flex min-h-14 flex-1 items-center justify-center gap-2 text-lg font-extrabold text-ink outline-none focus-visible:border-teal'
      }
    >
      {icon}
      {label}
    </button>
  );
}
