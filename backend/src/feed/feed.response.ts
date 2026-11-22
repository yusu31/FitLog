import { ApiProperty } from '@nestjs/swagger';
import { MemberResponse } from '../groups/groups.response.js';
import { RECORD_KINDS, type RecordKind } from '../db/schema.js';
import { RunDetail } from '../records/records.response.js';
import { STAMP_KEYS, type StampKey } from './stamps.js';
import { COMMENT_BODY_MAX, FEED_PAGE_SIZE } from './feed-input.js';

export class StampUser {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ example: 'はなこ' })
  name!: string;
}

export class FeedStamp {
  @ApiProperty({ enum: STAMP_KEYS })
  stampKey!: StampKey;

  @ApiProperty({ example: 2, description: 'このスタンプを付けた人の数' })
  count!: number;

  @ApiProperty({ type: String, format: 'uuid', nullable: true, description: '自分が付けているときは、そのスタンプの id（外すときに DELETE /records/{id}/reactions/{reactionId} へ渡す）。付けていなければ null' })
  mine!: string | null;

  @ApiProperty({ type: [StampUser], description: 'このスタンプを付けた人（押した順。自分も入る。同じグループの人だけ。A04-2）' })
  by!: StampUser[];
}

export class FeedItem {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ enum: RECORD_KINDS })
  kind!: RecordKind;

  @ApiProperty({ format: 'date-time', description: '運動した時刻（UTC）' })
  recordedAt!: string;

  @ApiProperty({ example: '2026-11-02', description: '日本時間の日付（YYYY-MM-DD）' })
  localDate!: string;

  @ApiProperty({ required: false, description: 'あとから記録した記録だけ true（「あとから記録」の札。F-21）' })
  late?: boolean;

  @ApiProperty({ type: MemberResponse, description: '書いた人（自分の記録も入る）' })
  author!: MemberResponse;

  @ApiProperty({ type: [String], example: ['ベンチプレス', 'スクワット'], description: '筋トレの種目名（重複なし・最初にセットを足した順）。筋トレ以外は空の配列。セットの中身は記録の詳細で見る' })
  exerciseNames!: string[];

  @ApiProperty({ type: RunDetail, required: false, description: 'ランの記録だけ。距離と時間' })
  run?: RunDetail;

  @ApiProperty({ type: [FeedStamp], description: '付いているスタンプ（付いたものだけ。スタンプの一覧の順）' })
  stamps!: FeedStamp[];

  @ApiProperty({ example: 2, description: 'コメントの数' })
  commentCount!: number;

  @ApiProperty({ required: false, description: '動画が付いている記録だけ true（カードに再生の印を出す。A06-4）。それ以外は省く。見られるかどうかは GET /videos/week の unlocked と GET /videos/{id}/url が決める' })
  hasVideo?: boolean;

  @ApiProperty({ required: false, description: '新着の印（F4）。最後に仲間タブを見た時刻（POST /feed/seen）より後に来た仲間の記録と、仲間の新しいスタンプ・コメントが付いた自分の記録だけ true。それ以外は省く' })
  isNew?: boolean;
}

export class FeedUnreadResponse {
  @ApiProperty({ description: '最後に仲間タブを見たあとに、仲間の新しい記録か、自分の記録への仲間の新しいスタンプ・コメントがあれば true（週は区切らない）。一度も見ていなければ登録した時刻から数える' })
  hasNew!: boolean;
}

export class FeedTotals {
  @ApiProperty({ example: 3, description: 'その週に筋トレかランを記録した人の数（休みだけの人は数えない）' })
  recordedUserCount!: number;

  @ApiProperty({ example: 12400, description: '筋トレの総重量（kg。重量×回数の合計）' })
  totalVolumeKg!: number;

  @ApiProperty({ example: 18000, description: 'ランの総距離（m）' })
  totalDistanceM!: number;
}

export class FeedResponse {
  @ApiProperty({ example: '2026-10-26', description: '合計の対象の週の月曜の日付（指定した日を含む週。指定しなければ今週）' })
  weekStart!: string;

  @ApiProperty({ type: [FeedItem], description: `新しい順（運動した時刻の降順。同じ時刻は id の降順）。1回に ${FEED_PAGE_SIZE} 件。自分の記録も含む。グループに入っていなければ空` })
  items!: FeedItem[];

  @ApiProperty({ type: String, nullable: true, description: '続きがあるときの印。次の呼び出しの cursor にそのまま渡す。最後のページは null' })
  nextCursor!: string | null;

  @ApiProperty({ type: FeedTotals, description: 'その週のグループ合計（ページに関係なく週全体）。順位・連続日数は持たない。グループに入っていなければすべて 0' })
  totals!: FeedTotals;
}

export class CreateReactionRequest {
  @ApiProperty({ format: 'uuid', description: '端末で作る ID。同じ ID を送り直しても、スタンプは1件のまま（冪等）' })
  id!: string;

  @ApiProperty({ enum: STAMP_KEYS, description: '筋トレ・ランには nice/fire/clap/smile、休みには rest_slow/rest_again' })
  stampKey!: StampKey;
}

export class ReactionResponse {
  @ApiProperty({ format: 'uuid', description: 'スタンプの id。すでに同じスタンプを付けていたときは、そのときの id' })
  id!: string;

  @ApiProperty({ format: 'uuid' })
  recordId!: string;

  @ApiProperty({ enum: STAMP_KEYS })
  stampKey!: StampKey;
}

export class CreateCommentRequest {
  @ApiProperty({ format: 'uuid', description: '端末で作る ID。同じ ID を送り直しても、コメントは1件のまま（冪等）' })
  id!: string;

  @ApiProperty({ minLength: 1, maxLength: COMMENT_BODY_MAX, example: 'ナイス！', description: `本文。1〜${COMMENT_BODY_MAX} 字（Unicode のコードポイント数。絵文字1つも1字）。空白だけは不可` })
  body!: string;
}

export class CommentResponse {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ format: 'uuid' })
  recordId!: string;

  @ApiProperty({ example: 'ナイス！' })
  body!: string;

  @ApiProperty({ format: 'date-time' })
  createdAt!: string;

  @ApiProperty({ type: MemberResponse, description: '書いた人' })
  author!: MemberResponse;
}

export class CommentListResponse {
  @ApiProperty({ type: [CommentResponse], description: 'その記録のコメント。古い順（付けた時刻の昇順。同じ時刻は id の昇順）。全件（記録ごとに仲間は最大5人なので、ページ分けはしない）。自分のコメントも含む' })
  items!: CommentResponse[];
}

export class ReactionListResponse {
  @ApiProperty({ type: [FeedStamp], description: 'その記録に付いているスタンプの集計（付いたものだけ。スタンプの一覧の順）。mine は自分のスタンプの id（外すときに使う）' })
  items!: FeedStamp[];
}
