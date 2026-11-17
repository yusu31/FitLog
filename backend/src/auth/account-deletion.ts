import { Logger } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import type { Db } from '../db/db.module.js';
import { exercises, records, routines, videos } from '../db/schema.js';
import type { VideoStorage } from '../videos/video-storage.js';

const logger = new Logger('AccountDeletion');

// 退会の前に、本人のデータを消す（F2-b）。最後に users の行を消すのは better-auth（このあと）。
//
// 順番が大事:
// 1. 動画の S3 ファイル: 置き場所（s3_key）は DB の videos にしか無い。行を先に消すと、ファイルの場所が分からなくなる。
//    ファイルの削除に失敗しても退会は止めない（置き場の不具合で、消したい人が消せなくなるのを避ける）。失敗はログに残す
// 2. 記録 → ルーティン → 自分の種目 の順に消す。種目はセット（workout_sets・routine_sets）から参照されているので、参照している側を先に消す。
//    記録を消すと、セット・ランの詳細・動画の行・その記録に付いたスタンプとコメントが ON DELETE CASCADE で一緒に消える
// 3. 仲間の記録に付けた自分のスタンプ・コメント、セッション、パスワード、グループの所属は、users を消すときの
//    ON DELETE CASCADE（移行 0015）で消える。グループ・招待の作成者と、仲間の記録の「コピー元」は SET NULL（空になるだけ）
export async function deleteAccountData(db: Db, storage: VideoStorage, userId: string): Promise<void> {
  const keys = (
    await db.select({ s3Key: videos.s3Key }).from(videos).innerJoin(records, eq(records.id, videos.recordId)).where(eq(records.userId, userId))
  ).map((row) => row.s3Key);
  if (keys.length > 0) {
    try {
      await storage.deleteMany(keys);
    } catch (err) {
      // キーそのものは出さない（記録の ID を含むため）。件数と原因だけ
      logger.warn(`動画ファイルを消せなかった（${keys.length}件）。退会は続ける: ${err instanceof Error ? err.message : String(err)}`);
    }
  }
  await db.delete(records).where(eq(records.userId, userId));
  await db.delete(routines).where(eq(routines.userId, userId));
  await db.delete(exercises).where(eq(exercises.createdBy, userId));
  logger.log('退会のために、本人のデータを消した');
}
