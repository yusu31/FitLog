import type { PresignedPostResponse } from '@/lib/api/generated';

// 撮影の形式の候補。mp4（H.264）を先に、だめなら webm（spike/video-record の実機テストと同じ並び）
const MIMES = ['video/mp4;codecs=avc1', 'video/mp4', 'video/webm;codecs=vp9', 'video/webm;codecs=vp8', 'video/webm'] as const;

export type VideoContentType = 'video/mp4' | 'video/webm';

// この端末で撮れる最初の形式。どれも撮れなければ null（撮影の入口を出さない）
export function pickMimeType(isSupported: (mime: string) => boolean): string | null {
  return MIMES.find(isSupported) ?? null;
}

// API へ申告する形式。";codecs=..." は付けない（署名の条件に入るのは基本の形式だけ）
export function baseContentType(mime: string): VideoContentType | null {
  const base = mime.split(';')[0].trim().toLowerCase();
  return base === 'video/mp4' || base === 'video/webm' ? base : null;
}

// 署名付き POST: API が返した fields を順序のまま全部フォームに入れ、最後に file を足して S3 へ直接送る。
// file が最後でないと S3 が拒否する。Cookie は S3 へ送らない（credentials: 'omit'）
export async function uploadToS3(
  upload: PresignedPostResponse,
  file: Blob,
  fetcher: typeof fetch = fetch,
): Promise<void> {
  const form = new FormData();
  for (const [name, value] of Object.entries(upload.fields)) form.append(name, value);
  form.append('file', file);
  const res = await fetcher(upload.url, { method: 'POST', body: form, credentials: 'omit' });
  if (!res.ok) throw new Error(`動画を送れませんでした（${res.status}）`);
}
