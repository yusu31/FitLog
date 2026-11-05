'use client';

import { useEffect, useRef, useState } from 'react';
import { ThickButton } from '@/components/fitlog/thick-button';
import { sendErrorText, unwrap } from '@/lib/api/api-error';
import { issueVideoUpload } from '@/lib/api/generated';
import { recordClip } from '@/lib/video/record-video';
import { baseContentType, pickMimeType, uploadToS3 } from '@/lib/video/video-upload';

type Phase = 'starting' | 'ready' | 'recording' | 'sending' | 'done' | 'error';

const SEND_ERROR = '送れませんでした。電波の良い所でもう一度ためしてください';
const CAMERA_ERROR = 'カメラを使えませんでした。ブラウザの設定でカメラを許可してください';

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

  useEffect(() => {
    let cancelled = false;
    navigator.mediaDevices
      .getUserMedia({ video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } }, audio: false })
      .then((stream) => {
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          void videoRef.current.play?.()?.catch(() => {});
        }
        setPhase('ready');
      })
      .catch(() => {
        if (cancelled) return;
        setError(CAMERA_ERROR);
        setPhase('error');
      });
    return () => {
      cancelled = true;
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    };
  }, []);

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
  return (
    <div role="dialog" aria-modal="true" aria-label="2秒ラストレップを撮る" className="fixed inset-0 z-30 flex flex-col bg-ink text-white">
      <video ref={videoRef} playsInline muted className="min-h-0 w-full flex-1 bg-black object-cover" />
      <div className="space-y-3 px-4 pt-4 pb-[max(20px,env(safe-area-inset-bottom))]">
        <p role="status" aria-live="polite" className="text-center text-sm font-bold">
          {phase === 'starting' && 'カメラを準備しています'}
          {phase === 'ready' && !error && '「撮る」を押すと2秒だけ撮ります'}
          {phase === 'recording' && '撮影中…（2秒）'}
          {phase === 'sending' && '送っています…'}
          {phase === 'done' && '保存しました。仲間にはその週の終わりまで見えます'}
        </p>
        {error && (
          <p role="alert" className="rounded-fl bg-coral-light px-4 py-3 text-sm font-bold text-ink">
            {error}
          </p>
        )}
        {phase !== 'done' && phase !== 'error' && (
          <ThickButton tone="gold" disabled={phase !== 'ready'} onClick={onShoot}>
            {busy ? '…' : error ? 'もう一度撮る' : '撮る'}
          </ThickButton>
        )}
        <ThickButton tone="white" size="sm" className="w-full" onClick={onClose} disabled={busy}>
          {phase === 'done' ? 'とじる' : 'やめる'}
        </ThickButton>
      </div>
    </div>
  );
}
