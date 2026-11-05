import { BadRequestException } from '@nestjs/common';
import { parseVideoInput, VIDEO_MAX_BYTES } from './video-input.js';

// 動画を置く署名付き POST を頼むときの入力検査（docs/design.md 4章 POST /records/{id}/video・F-13）。
// 大きさの上限 10MB（10,485,760 バイト）と形式が、S3 の署名の条件に入る値になる
const parse = (override: Record<string, unknown> = {}) => parseVideoInput({ contentType: 'video/mp4', sizeBytes: 1_500_000, ...override });
const rejects = (override: Record<string, unknown>) => expect(() => parse(override)).toThrow(BadRequestException);

describe('parseVideoInput（動画の入力検査）', () => {
  it('代表的な値（mp4・1.5MB）は通る', () => {
    expect(parse()).toEqual({ contentType: 'video/mp4', sizeBytes: 1_500_000 });
  });

  describe('大きさ（1〜10,485,760 バイトの整数）', () => {
    it.each<[string, number]>([
      ['下端 1', 1],
      ['上限ちょうど', VIDEO_MAX_BYTES],
    ])('%s は通る', (_name, sizeBytes) => {
      expect(parse({ sizeBytes }).sizeBytes).toBe(sizeBytes);
    });

    it.each<[string, unknown]>([
      ['0（空のファイル）', 0],
      ['上限 +1', VIDEO_MAX_BYTES + 1],
      ['負の数', -1],
      ['小数', 1.5],
      ['文字列 "1000"', '1000'],
      ['NaN', Number.NaN],
      ['無い', undefined],
    ])('%s は 400', (_name, sizeBytes) => {
      rejects({ sizeBytes });
    });
  });

  describe('形式（video/mp4・video/webm）', () => {
    it('webm も通る（MediaRecorder が mp4 に対応しない端末のため。撮影できた形式のまま保存する）', () => {
      expect(parse({ contentType: 'video/webm' }).contentType).toBe('video/webm');
    });

    it.each<[string, unknown]>([
      ['画像', 'image/png'],
      ['コーデック付き（画面が基本の形式だけを送る）', 'video/mp4;codecs=avc1'],
      ['大文字', 'VIDEO/MP4'],
      ['空', ''],
      ['数', 1],
      ['無い', undefined],
    ])('%s は 400', (_name, contentType) => {
      rejects({ contentType });
    });
  });

  it('理由は項目ごとに集めて返す（1回で直せるように）', () => {
    try {
      parseVideoInput({});
      expect.unreachable();
    } catch (e) {
      const body = (e as BadRequestException).getResponse() as { code: string; details: string[] };
      expect(body.code).toBe('VALIDATION_ERROR');
      expect(body.details).toHaveLength(2);
    }
  });

  it('body が無い・オブジェクトでなくても 400（落ちない）', () => {
    expect(() => parseVideoInput(undefined)).toThrow(BadRequestException);
    expect(() => parseVideoInput('x')).toThrow(BadRequestException);
  });
});
