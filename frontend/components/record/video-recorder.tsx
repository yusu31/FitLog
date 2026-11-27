'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { ThickButton } from '@/components/fitlog/thick-button';
import { sendErrorText, unwrap } from '@/lib/api/api-error';
import { createRecord, deleteRecord, issueVideoUpload, listRecords, updateRecordMemo } from '@/lib/api/generated';
import { isNativeApp } from '@/lib/gps/source';
import { toLocalDate } from '@/lib/shared/local-date';
import { recordClip } from '@/lib/video/record-video';
import { baseContentType, pickMimeType, uploadToS3 } from '@/lib/video/video-upload';

// review＝撮ったあとの見直し（ひとこと・撮り直す・送る）
type Phase = 'starting' | 'ready' | 'recording' | 'review' | 'sending' | 'done' | 'error';

// ひとこと（records.caption）の上限。API・DB と同じ（コードポイントで数える）
export const CAPTION_MAX = 50;
const countChars = (text: string): number => Array.from(text).length;
const KIND_TARGET_LABEL: Record<string, string> = { workout: '筋トレ', run: 'ラン', rest: 'おやすみ', post: '投稿' };

// 動画の付け先（PR 4）。recordId が null なら、送るときに「投稿」を新しく作る
type Target = { recordId: string | null; kind: string };

// 付け先を自動で決める。優先順位: ①いま記録している最中の筋トレ → ②今日の記録のうち、いちばん新しい「動画がまだ無い」もの → ③どれも無ければ投稿。
// 動画が付いている記録はとばす（前の動画を消さない）。あとから記録（late）には動画を付けられないので除く。一覧は新しい順
async function resolveTarget(): Promise<Target> {
  const res = unwrap(await listRecords({ date: toLocalDate(new Date()), limit: '50' }));
  const open = res.data.items.filter((r) => !r.late && !r.videoId);
  const pick = open.find((r) => r.kind === 'workout' && r.active) ?? open[0];
  return pick ? { recordId: pick.id, kind: pick.kind } : { recordId: null, kind: 'post' };
}

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
// 全画面でカメラを見せ、「撮る」で2秒だけ撮影 → 全画面で見直す（ひとこと・撮り直す・送る）→ 「送る」で API から署名付き POST をもらい、S3 へ直接送る。
// recordId を渡すと、その記録に付ける。渡さない（undefined）と、付け先は自動（resolveTarget。無ければ「投稿」を作る）。
// 失敗しても記録（セット）は消えない。送れなかったら見直しの画面にもどるので、そのまま「送る」でやり直せる
export function VideoRecorder({ recordId, onClose }: { recordId?: string; onClose: () => void }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [phase, setPhase] = useState<Phase>('starting');
  const [error, setError] = useState<string | null>(null);
  const [waitedS, setWaitedS] = useState(0);
  // 「もう一度ためす」を押した回数。変わるとカメラを取り直す
  const [attempt, setAttempt] = useState(0);
  // 撮れた動画（見直しと送信に使う）・見直し用の URL・ひとこと・付け先
  const [clip, setClip] = useState<Blob | null>(null);
  const [caption, setCaption] = useState('');
  const [target, setTarget] = useState<Target | null>(recordId ? { recordId, kind: 'fixed' } : null);

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

  // 見直し用の URL は、撮り直し・閉じるときに手放す
  const clipUrl = useMemo(() => (clip && typeof URL.createObjectURL === 'function' ? URL.createObjectURL(clip) : null), [clip]);
  useEffect(() => () => {
    if (clipUrl) URL.revokeObjectURL?.(clipUrl);
  }, [clipUrl]);

  async function onShoot() {
    const stream = streamRef.current;
    const mime = pickMimeType((m) => MediaRecorder.isTypeSupported(m));
    if (!stream || !mime) return;
    setError(null);
    setPhase('recording');
    try {
      const blob = await recordClip(stream, mime);
      if (!baseContentType(blob.type || mime)) throw new Error('この形式の動画は送れません');
      setClip(blob);
      setPhase('review');
      // 付け先は、見直しの間に決めておく（「◯◯に付けます」と見せるため）。決められなくても、送るときにもう一度決める
      if (!recordId) resolveTarget().then(setTarget, () => setTarget(null));
    } catch (e) {
      setError(sendErrorText(e, SEND_ERROR));
      setPhase('ready');
    }
  }

  function onRetake() {
    setClip(null);
    setError(null);
    setPhase('ready');
  }

  async function onSend() {
    if (!clip) return;
    const contentType = baseContentType(clip.type || pickMimeType((m) => MediaRecorder.isTypeSupported(m)) || '');
    if (!contentType) return;
    setError(null);
    setPhase('sending');
    let createdPostId: string | null = null;
    try {
      const to = target ?? (await resolveTarget());
      const text = caption.trim();
      let id = to.recordId;
      if (!id) {
        // 付け先が無いとき: 動画とひとことだけの「投稿」を新しく作る（運動としては数えない）
        id = crypto.randomUUID();
        createdPostId = id;
        unwrap(await createRecord({ id, kind: 'post', recordedAt: new Date().toISOString(), ...(text ? { caption: text } : {}) }));
      } else if (text) {
        unwrap(await updateRecordMemo(id, { caption: text }));
      }
      const res = unwrap(await issueVideoUpload(id, { contentType, sizeBytes: clip.size }));
      await uploadToS3(res.data.upload, clip);
      setPhase('done');
    } catch (e) {
      // 投稿だけ作って動画が置けなかったときは、中身の無い投稿を残さない（次の「送る」で作り直す）
      if (createdPostId) void deleteRecord(createdPostId).catch(() => {});
      setError(sendErrorText(e, SEND_ERROR));
      setPhase('review');
    }
  }

  const busy = phase === 'recording' || phase === 'sending';
  const reviewing = phase === 'review' || phase === 'sending';
  const targetText = target ? (target.recordId ? (target.kind === 'fixed' ? 'この記録に付けます' : `${KIND_TARGET_LABEL[target.kind] ?? '記録'}に付けます`) : '投稿として送ります') : '付け先を決めています…';
  // 休憩の帯（rest-timer-bar の z-40）より前に出す。後ろだと「撮る」「あとで撮る」が隠れる
  return (
    <div role="dialog" aria-modal="true" aria-label="2秒ラストレップを撮る" className="fixed inset-0 z-50 flex flex-col bg-night text-white">
      <video ref={videoRef} playsInline muted className={`min-h-0 w-full flex-1 bg-black object-cover ${phase === 'error' || reviewing || phase === 'done' ? 'hidden' : ''}`} />
      {(reviewing || phase === 'done') && clipUrl && (
        <video aria-label="撮った動画（見直し）" src={clipUrl} autoPlay loop muted playsInline className="min-h-0 w-full flex-1 bg-black object-cover" />
      )}
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
          {phase === 'review' && !error && targetText}
          {phase === 'sending' && '送っています…'}
          {phase === 'done' && '保存しました。仲間にはその週の終わりまで見えます'}
        </p>
        {error && phase !== 'error' && (
          <p role="alert" className="rounded-fl bg-coral-light px-4 py-3 text-sm font-bold text-fg">
            {error}
          </p>
        )}
        {reviewing && (
          <div className="space-y-1">
            <label htmlFor="clip-caption" className="text-sm font-extrabold">
              ひとこと（{CAPTION_MAX}字まで・なくてもOK）
            </label>
            <input
              id="clip-caption"
              type="text"
              value={caption}
              disabled={phase === 'sending'}
              onChange={(e) => setCaption(Array.from(e.target.value).slice(0, CAPTION_MAX).join(''))}
              className="h-11 w-full rounded-fl border-2 border-line bg-white px-3 text-base font-bold text-fg outline-none focus-visible:ring-4 focus-visible:ring-teal/40"
            />
            <p className="text-right text-note font-bold text-white/80">
              {countChars(caption)}/{CAPTION_MAX}
            </p>
          </div>
        )}
        {reviewing && (
          <ThickButton tone="gold" disabled={phase === 'sending' || !clip} onClick={onSend}>
            {phase === 'sending' ? '…' : '送る'}
          </ThickButton>
        )}
        {reviewing && (
          <ThickButton tone="white" size="sm" className="w-full" onClick={onRetake} disabled={phase === 'sending'}>
            撮り直す
          </ThickButton>
        )}
        {phase !== 'done' && phase !== 'error' && !reviewing && (
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
