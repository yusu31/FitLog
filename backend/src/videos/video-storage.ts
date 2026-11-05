import { GetObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { ServiceUnavailableException } from '@nestjs/common';
import { createPresignedPost } from '@aws-sdk/s3-presigned-post';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

// 署名付き URL の有効期限（秒）。docs/design.md 6章「動画の URL が漏れる」: 短い期限（5分。既定）
export const VIDEO_URL_EXPIRES_SECONDS = 300;

export type PresignedPost = { url: string; fields: Record<string, string> };

// 動画の置き場への窓口。署名は手元の計算だけで、S3 とは通信しない。
// 抽象クラスにしているのは、Nest の注入の印（トークン）にするため。結合テストでは偽の実装に差し替えられる
export abstract class VideoStorage {
  abstract presignUpload(key: string, contentType: string, sizeBytes: number): Promise<PresignedPost>;
  abstract presignDownload(key: string): Promise<string>;
}

export class S3VideoStorage extends VideoStorage {
  constructor(
    private readonly client: S3Client,
    private readonly bucket: string,
    private readonly expiresIn: number = VIDEO_URL_EXPIRES_SECONDS,
  ) {
    super();
  }

  // 署名付き POST（フォーム送信形式）。サイズは申告値ちょうど・形式とキーは完全一致を署名の条件に入れる。
  // PUT 用の URL ではサイズの上限を付けにくいため POST に統一した（docs/infrastructure.md 3章）。条件を破ると S3 が直接エラーを返す
  presignUpload(key: string, contentType: string, sizeBytes: number): Promise<PresignedPost> {
    return createPresignedPost(this.client, {
      Bucket: this.bucket,
      Key: key,
      Fields: { 'Content-Type': contentType },
      Conditions: [
        ['content-length-range', sizeBytes, sizeBytes],
        ['eq', '$Content-Type', contentType],
      ],
      Expires: this.expiresIn,
    });
  }

  presignDownload(key: string): Promise<string> {
    return getSignedUrl(this.client, new GetObjectCommand({ Bucket: this.bucket, Key: key }), { expiresIn: this.expiresIn });
  }
}

// 置き場（バケット）が設定されていない環境（ローカル開発など）の窓口。署名を作ろうとすると 503 を返す
class UnavailableVideoStorage extends VideoStorage {
  private fail(): never {
    throw new ServiceUnavailableException({ code: 'VIDEO_STORAGE_UNAVAILABLE', message: '動画の置き場が設定されていません', details: null });
  }
  presignUpload(): Promise<PresignedPost> {
    return this.fail();
  }
  presignDownload(): Promise<string> {
    return this.fail();
  }
}

// 環境変数 VIDEO_BUCKET（バケット名）があれば S3 の窓口、無ければ 503 を返す窓口。
// 認証情報は AWS の標準の探し方（環境変数 → プロファイル → 実行ロール）に任せ、コードに書かない。リージョンの既定は東京
export function createVideoStorage(env: NodeJS.ProcessEnv = process.env): VideoStorage {
  const bucket = env.VIDEO_BUCKET;
  if (!bucket) return new UnavailableVideoStorage();
  return new S3VideoStorage(new S3Client({ region: env.AWS_REGION ?? 'ap-northeast-1' }), bucket);
}
