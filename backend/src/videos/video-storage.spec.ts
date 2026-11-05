import { S3Client } from '@aws-sdk/client-s3';
import { ServiceUnavailableException } from '@nestjs/common';
import { createVideoStorage, S3VideoStorage } from './video-storage.js';

// S3 に署名する部分（F-13）。署名は手元の計算だけで、ネットワークを使わない（偽の認証情報で足りる）。
// ここで確かめるのは「署名の条件に、サイズと形式と期限が入っているか」。S3 が実際にその条件を守って弾くかは、公開（02-3）の後に実物で確かめる
const client = new S3Client({ region: 'ap-northeast-1', credentials: { accessKeyId: 'AKIAFAKEFAKEFAKE', secretAccessKey: 'fake-secret' } });
const storage = new S3VideoStorage(client, 'fitlog-test-bucket', 300);
const KEY = 'videos/5f0e1b6a-3c7d-4e2a-9b1f-0a2c4d6e8f10';

type Policy = { expiration: string; conditions: unknown[] };
const policyOf = (fields: Record<string, string>): Policy => JSON.parse(Buffer.from(fields.Policy!, 'base64').toString('utf8')) as Policy;

describe('S3VideoStorage.presignUpload（署名付き POST）', () => {
  it('置き場は対象バケットで、キーと形式がフォームの項目に入る', async () => {
    const { url, fields } = await storage.presignUpload(KEY, 'video/mp4', 1_500_000);
    expect(url).toContain('fitlog-test-bucket');
    expect(fields.key).toBe(KEY);
    expect(fields['Content-Type']).toBe('video/mp4');
    expect(fields['X-Amz-Signature']).toMatch(/^[0-9a-f]{64}$/);
  });

  it('サイズは申告値ちょうど（下限も上限も同じ値）を署名の条件に入れる', async () => {
    const { fields } = await storage.presignUpload(KEY, 'video/mp4', 1_500_000);
    expect(policyOf(fields).conditions).toContainEqual(['content-length-range', 1_500_000, 1_500_000]);
  });

  it('形式の完全一致と、キーの完全一致を署名の条件に入れる（別の形式・別のキーでは置けない）', async () => {
    const { conditions } = policyOf((await storage.presignUpload(KEY, 'video/webm', 800_000)).fields);
    expect(conditions).toContainEqual(['eq', '$Content-Type', 'video/webm']);
    expect(conditions).toContainEqual({ key: KEY });
  });

  it('期限は 5 分（300 秒）', async () => {
    const before = Date.now();
    const { expiration } = policyOf((await storage.presignUpload(KEY, 'video/mp4', 1)).fields);
    const seconds = (Date.parse(expiration) - before) / 1000;
    expect(seconds).toBeGreaterThan(290);
    expect(seconds).toBeLessThanOrEqual(301);
  });
});

describe('S3VideoStorage.presignDownload（見る署名付き URL）', () => {
  it('対象のキーを指し、期限 300 秒と署名が付く', async () => {
    const url = new URL(await storage.presignDownload(KEY));
    expect(url.hostname).toContain('fitlog-test-bucket');
    expect(decodeURIComponent(url.pathname)).toBe(`/${KEY}`);
    expect(url.searchParams.get('X-Amz-Expires')).toBe('300');
    expect(url.searchParams.get('X-Amz-Signature')).toMatch(/^[0-9a-f]{64}$/);
  });
});

describe('createVideoStorage（環境変数から置き場を決める）', () => {
  it('VIDEO_BUCKET があれば S3 の窓口', () => {
    expect(createVideoStorage({ VIDEO_BUCKET: 'b', AWS_REGION: 'ap-northeast-1' })).toBeInstanceOf(S3VideoStorage);
  });

  it('VIDEO_BUCKET が無い（空も）ときは、署名を頼むと 503 VIDEO_STORAGE_UNAVAILABLE（ローカル開発で落ちずに案内できる）', async () => {
    for (const env of [{}, { VIDEO_BUCKET: '' }]) {
      const storage = createVideoStorage(env);
      const calls: Array<() => Promise<unknown>> = [() => storage.presignUpload('k', 'video/mp4', 1), () => storage.presignDownload('k')];
      for (const call of calls) {
        const err = await Promise.resolve().then(call).catch((e: unknown) => e);
        expect(err).toBeInstanceOf(ServiceUnavailableException);
        expect(((err as ServiceUnavailableException).getResponse() as { code: string }).code).toBe('VIDEO_STORAGE_UNAVAILABLE');
      }
    }
  });
});
