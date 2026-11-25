'use client';

import { useEffect, useRef, useState } from 'react';
import { ThickButton } from '@/components/fitlog/thick-button';
import { sendErrorText, unwrap } from '@/lib/api/api-error';
import { issueVideoUpload } from '@/lib/api/generated';
import { isNativeApp } from '@/lib/gps/source';
import { recordClip } from '@/lib/video/record-video';
import { baseContentType, pickMimeType, uploadToS3 } from '@/lib/video/video-upload';

type Phase = 'starting' | 'ready' | 'recording' | 'sending' | 'done' | 'error';

const SEND_ERROR = '送れませんでした。電波の良い所でもう一度ためしてください';
const CAMERA_ERROR = 'カメラを使えませんでした';
// 準備のまま止まったとき（許可の画面が出ない・別のアプリがカメラを使っている等）に、直し方へ移るまでの秒数（L4）
export const CAMERA_START_TIMEOUT_S = 8;
// 直し方（A06-3）。許可を出しても直らないときは、記録は残っているので「あとで撮る」で閉じてよい
const RETRY_LABEL = 'もう一度ためす';
const FIX_STEPS_BROWSER = ['アドレス欄の鍵（またはカメラ）のマークをタップ', '「カメラ」を「許可」に変える', `ここで「${RETRY_LABEL}」を押す`] as const;
// アプリ・ホーム画面から開いたときはアドレス欄が無いので、スマホの設定を案内する
const FIX_STEPS_APP = ['スマホの「設定」をひらく', '「アプリ」の FitLog（無ければブラウザ）で「カメラ」を許可する', `ここにもどって「${RETRY_LABEL}」を押す`] as const;

function cameraFixSteps(): readonly string[] {
  const standalone = typeof window.matchMedia === 'function' && window.matchMedia('(display-mode: standalone)').matches;
  return isNativeApp() || standalone ? FIX_STEPS_APP : FIX_STEPS_BROWSER;
}

// この端末で2秒撮影ができるか（入口を出すかの判定）
export function canRecordVideo(): boolean {
  return (
    typeof MediaRecorder !== 'undefined' &&
    typeof navigator !== 'undefined' &&
    !!navigator.mediaDevices?.getUserMedia &&
    pickMimeType((m) => MediaRecorder.isTypeSupported(m)) !== null
  );
}

// 「2秒ラストレップを撮る」（features.md F-13・screen-design.md 4章）。
// 全画面でカメラを見せ、「撮る」で2秒だけ撮影 → API で署名付き POST をもらい → S3 へ直接送る。
// 失敗しても記録（セット）は消えない。やり直しはもう一度「撮る」（同じ記録への再 POST は動画が差し替わる）
export function VideoRecorder({ recordId, onClose }: { recordId: string; onClose: () => void }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [phase, setPhase] = useState<Phase>('starting');
  const [error, setError] = useState<string | null>(null);
  const [waitedS, setWaitedS] = useState(0);
  // 「もう一度ためす」を押した回数。変わるとカメラを取り直す
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    let settled = false; // カメラが来た・失敗した・待ちきれた、のどれかで決着済み
    const tick = setInterval(() => setWaitedS((n) => n + 1), 1000);
    const giveUp = setTimeout(() => {
      if (settled) return;
      settled = true;
      setError(CAMERA_ERROR);
      setPhase('error');
    }, CAMERA_START_TIMEOUT_S * 1000);
    navigator.mediaDevices
      .getUserMedia({ video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } }, audio: false })
      .then((stream) => {
        // 待ちきれて直し方を出したあとにカメラが来たときは、使わずに止める
        if (cancelled || settled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        settled = true;
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          void videoRef.current.play?.()?.catch(() => {});
        }
        setPhase('ready');
      })
      .catch(() => {
        if (cancelled || settled) return;
        settled = true;
        setError(CAMERA_ERROR);
        setPhase('error');
      });
    return () => {
      cancelled = true;
      clearInterval(tick);
      clearTimeout(giveUp);
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    };
  }, [attempt]);

  function retry() {
    setError(null);
    setWaitedS(0);
    setPhase('starting');
    setAttempt((n) => n + 1);
  }

  async function onShoot() {
    const stream = streamRef.current;
    const mime = pickMimeType((m) => MediaRecorder.isTypeSupported(m));
    if (!stream || !mime) return;
    setError(null);
    setPhase('recording');
    try {
      const clip = await recordClip(stream, mime);
      const contentType = baseContentType(clip.type || mime);
      if (!contentType) throw new Error('この形式の動画は送れません');
      setPhase('sending');
      const res = unwrap(await issueVideoUpload(recordId, { contentType, sizeBytes: clip.size }));
      await uploadToS3(res.data.upload, clip);
      setPhase('done');
    } catch (e) {
      setError(sendErrorText(e, SEND_ERROR));
      setPhase('ready');
    }
  }

  const busy = phase === 'recording' || phase === 'sending';
  // 休憩の帯（rest-timer-bar の z-40）より前に出す。後ろだと「撮る」「あとで撮る」が隠れる
  return (
    <div role="dialog" aria-modal="true" aria-label="2秒ラストレップを撮る" className="fixed inset-0 z-50 flex flex-col bg-night text-white">
      <video ref={videoRef} playsInline muted className={`min-h-0 w-full flex-1 bg-black object-cover ${phase === 'error' ? 'hidden' : ''}`} />
      {phase === 'error' && (
        <div className="flex min-h-0 flex-1 flex-col justify-center gap-3 overflow-y-auto px-6 py-4">
          <p role="alert" className="text-lg font-extrabold">
            {error}
          </p>
          <p className="text-sm font-bold">カメラの許可を直すと撮れます。記録はもう残っています。</p>
          <ol className="list-decimal space-y-1 pl-5 text-sm font-bold">
            {cameraFixSteps().map((t) => (
              <li key={t}>{t}</li>
            ))}
          </ol>
        </div>
      )}
      <div className="space-y-3 px-4 pt-4 pb-[max(20px,env(safe-area-inset-bottom))]">
        {phase === 'starting' && (
          <div
            role="progressbar"
            aria-label="カメラの準備"
            aria-valuemin={0}
            aria-valuemax={CAMERA_START_TIMEOUT_S}
            aria-valuenow={Math.min(waitedS, CAMERA_START_TIMEOUT_S)}
            className="h-2 overflow-hidden rounded-full bg-white/25"
          >
            <div className="h-full rounded-full bg-gold transition-[width] duration-1000 ease-linear" style={{ width: `${(Math.min(waitedS + 1, CAMERA_START_TIMEOUT_S) / CAMERA_START_TIMEOUT_S) * 100}%` }} />
          </div>
        )}
        <p role="status" aria-live="polite" className="text-center text-sm font-bold">
          {phase === 'starting' && `カメラを準備しています（${waitedS}秒）`}
          {phase === 'ready' && !error && '「撮る」を押すと2秒だけ撮ります'}
          {phase === 'recording' && '撮影中…（2秒）'}
          {phase === 'sending' && '送っています…'}
          {phase === 'done' && '保存しました。仲間にはその週の終わりまで見えます'}
        </p>
        {error && phase !== 'error' && (
          <p role="alert" className="rounded-fl bg-coral-light px-4 py-3 text-sm font-bold text-fg">
            {error}
          </p>
        )}
        {phase !== 'done' && phase !== 'error' && (
          <ThickButton tone="gold" disabled={phase !== 'ready'} onClick={onShoot}>
            {busy ? '…' : error ? 'もう一度撮る' : '撮る'}
          </ThickButton>
        )}
        {phase === 'error' && (
          <ThickButton tone="gold" onClick={retry}>
            {RETRY_LABEL}
          </ThickButton>
        )}
        <ThickButton tone="white" size="sm" className="w-full" onClick={onClose} disabled={busy}>
          {phase === 'done' ? 'とじる' : phase === 'error' ? 'あとで撮る' : 'やめる'}
        </ThickButton>
      </div>
    </div>
  );
}
