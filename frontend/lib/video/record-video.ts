export const CLIP_MS = 2000;
const BITS_PER_SECOND = 2_500_000;

// 2秒だけ撮って、動画（Blob）を返す。止まるのは CLIP_MS の後。何も撮れなければ例外
export function recordClip(stream: MediaStream, mimeType: string): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const recorder = new MediaRecorder(stream, { mimeType, videoBitsPerSecond: BITS_PER_SECOND });
    const chunks: Blob[] = [];
    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunks.push(e.data);
    };
    recorder.onstop = () => {
      if (chunks.length === 0) reject(new Error('動画を撮れませんでした'));
      else resolve(new Blob(chunks, { type: recorder.mimeType || mimeType }));
    };
    recorder.start();
    setTimeout(() => recorder.stop(), CLIP_MS);
  });
}
