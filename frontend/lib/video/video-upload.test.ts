import { describe, expect, it, vi } from 'vitest';
import { baseContentType, pickMimeType, uploadToS3 } from './video-upload';

describe('pickMimeType', () => {
  it('mp4 を撮れる端末では mp4 を先に選ぶ', () => {
    expect(pickMimeType((m) => m.startsWith('video/mp4') || m.startsWith('video/webm'))).toBe('video/mp4;codecs=avc1');
  });
  it('mp4 が撮れず webm だけなら webm を選ぶ', () => {
    expect(pickMimeType((m) => m.startsWith('video/webm'))).toBe('video/webm;codecs=vp9');
  });
  it('どちらも撮れなければ null', () => {
    expect(pickMimeType(() => false)).toBeNull();
  });
});

describe('baseContentType', () => {
  it('";codecs=" を外す', () => {
    expect(baseContentType('video/mp4;codecs=avc1')).toBe('video/mp4');
    expect(baseContentType('video/webm;codecs=vp9')).toBe('video/webm');
  });
  it('大文字・空白があっても基本の形式にそろえる', () => {
    expect(baseContentType('Video/MP4 ; codecs=avc1.640028')).toBe('video/mp4');
  });
  it('mp4・webm 以外は null', () => {
    expect(baseContentType('video/quicktime')).toBeNull();
    expect(baseContentType('')).toBeNull();
  });
});

describe('uploadToS3', () => {
  const upload = { url: 'https://bucket.s3.example/', fields: { key: 'k', 'Content-Type': 'video/mp4', Policy: 'p' } };
  const file = new Blob(['x'.repeat(10)], { type: 'video/mp4' });

  it('fields を全部入れ、最後に file を足して POST する', async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response(null, { status: 204 }));
    await uploadToS3(upload, file, fetcher);
    const [url, init] = fetcher.mock.calls[0];
    expect(url).toBe(upload.url);
    expect(init.method).toBe('POST');
    const keys = [...(init.body as FormData).keys()];
    expect(keys).toEqual(['key', 'Content-Type', 'Policy', 'file']);
    expect(init.credentials).toBe('omit');
  });

  it('204 以外は例外にする', async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response('no', { status: 403 }));
    await expect(uploadToS3(upload, file, fetcher)).rejects.toThrow();
  });
});
