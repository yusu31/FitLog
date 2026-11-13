import { ApiProperty } from '@nestjs/swagger';
import type { GhostResult } from '../common/ghost.js';
import { STAMP_KEYS, type StampKey } from '../common/stats.js';
import type { CellStatus } from '../common/week.js';
import { BODY_PARTS, RECORD_KINDS, type BodyPart, type RecordKind } from '../db/schema.js';
import { CREATABLE_KINDS, DISTANCE_M_MAX, DISTANCE_M_MIN, DURATION_S_MAX, DURATION_S_MIN, ROUTE_POINTS_MAX, ROUTE_POINTS_MIN, type CreatableKind } from './record-input.js';

// GPX のルート（GeoJSON の LineString）。点は [経度, 緯度]
export class RunRoute {
  @ApiProperty({ enum: ['LineString'] })
  type!: 'LineString';

  @ApiProperty({
    type: 'array',
    items: { type: 'array', items: { type: 'number' }, minItems: 2, maxItems: 2 },
    minItems: ROUTE_POINTS_MIN,
    maxItems: ROUTE_POINTS_MAX,
    example: [[139.7671, 35.6812], [139.7745, 35.6895]],
    description: '[経度, 緯度] の並び。2〜3,000 点（GPX は取り込み時に間引く）',
  })
  coordinates!: [number, number][];
}

export class RunDetail {
  @ApiProperty({ minimum: DISTANCE_M_MIN, maximum: DISTANCE_M_MAX, example: 5000, description: '距離（m）。100〜200,000（0.1〜200km）の整数' })
  distanceM!: number;

  @ApiProperty({ minimum: DURATION_S_MIN, maximum: DURATION_S_MAX, example: 1800, description: '時間（秒）。60〜86,400（1分〜24時間）の整数。ペースは画面が計算する' })
  durationS!: number;

  @ApiProperty({ type: RunRoute, required: false, description: 'GPX を取り込んだランだけ。作成時に送れる。返すのは詳細（GET /records/{id}）だけで、作成の応答と一覧には含めない' })
  route?: RunRoute;
}

// 地図ゴースト（F-17）。自分のルート付きランの詳細にだけ付く、自分の「ひとつ前のルート付きラン」
export class PreviousRun {
  @ApiProperty({ format: 'uuid', description: '前回のランの記録 id' })
  recordId!: string;

  @ApiProperty({ format: 'date-time', example: '2026-10-20T03:00:00.000Z' })
  recordedAt!: string;

  @ApiProperty({ minimum: DISTANCE_M_MIN, maximum: DISTANCE_M_MAX, example: 4200 })
  distanceM!: number;

  @ApiProperty({ minimum: DURATION_S_MIN, maximum: DURATION_S_MAX, example: 1800 })
  durationS!: number;

  @ApiProperty({ type: RunRoute })
  route!: RunRoute;
}

export class CreateRecordRequest {
  @ApiProperty({ format: 'uuid', description: '端末で作る ID。同じ ID を送り直しても、記録は1件のまま（冪等）' })
  id!: string;

  @ApiProperty({ enum: CREATABLE_KINDS, description: '筋トレ（workout）・ラン（run）・休み（rest）' })
  kind!: CreatableKind;

  @ApiProperty({ type: RunDetail, required: false, description: 'kind が run のときだけ必須（距離と時間）。ほかの kind に付けると 400' })
  run?: RunDetail;

  @ApiProperty({ format: 'date-time', example: '2026-11-01T09:00:00+09:00', description: '運動した時刻（ISO 8601）。未来は5分先まで' })
  recordedAt!: string;

  @ApiProperty({ required: false, description: 'あとから記録（F-21）。端末で保存を押した日より前の日の記録なら true。休みには付けられない（400）' })
  late?: boolean;

  @ApiProperty({ required: false, description: 'メニューのコピー（F-24）。仲間の記録をコピーして始めた筋トレだけに付ける、コピー元の人の userId。筋トレ以外は 409、同じグループの仲間でなければ 404' })
  copiedFromUserId?: string;
}

export class CopiedFrom {
  @ApiProperty({ type: String, nullable: true, example: 'ゆうすけ', description: 'コピー元の名前。見る人と同じグループにいなければ null' })
  name!: string | null;
}

export class RecordResponse {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ enum: RECORD_KINDS })
  kind!: RecordKind;

  @ApiProperty({ format: 'date-time', description: '運動した時刻（UTC）' })
  recordedAt!: string;

  @ApiProperty({ example: '2026-11-01', description: '日本時間の日付（YYYY-MM-DD）。サーバーが recordedAt から出す' })
  localDate!: string;

  @ApiProperty({ required: false, description: 'あとから記録した記録だけ true（「あとから記録」の札。F-21）。いつもの記録には付かない' })
  late?: boolean;

  @ApiProperty({ type: CopiedFrom, required: false, description: 'メニューをコピーして始めた記録だけ（「◯◯さんから」の札。F-24）。コピー元が今も見る人と同じグループなら name、抜けていれば name が null（画面は「仲間から」）' })
  copiedFrom?: CopiedFrom;

  @ApiProperty({ type: RunDetail, required: false, description: 'ランの記録だけ。距離と時間' })
  run?: RunDetail;
}

// 一覧・詳細に入れるセット。再送の応答（SetResponse）と違い、ゴーストの比べ結果と自己ベストの札は付けない（記録した瞬間に使うもの）
export class RecordedSet {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ example: 1 })
  setNo!: number;

  @ApiProperty({ example: 40 })
  weightKg!: number;

  @ApiProperty({ example: 10 })
  reps!: number;
}

export class RecordedExercise {
  @ApiProperty({ format: 'uuid' })
  exerciseId!: string;

  @ApiProperty({ example: 'ベンチプレス' })
  name!: string;

  @ApiProperty({ enum: BODY_PARTS, required: false, description: '種目の部位。仲間の自作種目をコピーするとき、自分の種目として作る際に使う（F-24）。応答には必ず入る。端末が楽観的更新で作る仮の行には無い' })
  bodyPart?: BodyPart;

  @ApiProperty({ type: [RecordedSet], description: 'セット番号の昇順' })
  sets!: RecordedSet[];
}

// 一覧の1件・詳細。RecordResponse に、筋トレなら種目ごとのセットを足したもの
export class RecordDetailResponse extends RecordResponse {
  @ApiProperty({
    type: [RecordedExercise],
    required: false,
    description: '筋トレの記録だけ。種目ごとのセット（種目は最初にセットを足した順）。セットが無ければ空の配列。ランと休みには付かない',
  })
  exercises?: RecordedExercise[];

  @ApiProperty({
    type: String,
    format: 'uuid',
    required: false,
    description: '動画があるときだけ（詳細 GET /records/{id} のみ）。見るときの GET /videos/{id}/url に使う',
  })
  videoId?: string;

  @ApiProperty({
    type: PreviousRun,
    required: false,
    description:
      '地図ゴースト（F-17）。ルート付きのランの詳細を持ち主本人が開いたときだけ、本人の「ひとつ前のルート付きラン」を返す（手入力のランは飛ばす）。前回が無い・仲間が見たときは付かない',
  })
  previousRun?: PreviousRun;
}

export class RecordListResponse {
  @ApiProperty({ type: [RecordDetailResponse], description: '新しい順（運動した時刻の降順。同じ時刻は id の降順）' })
  items!: RecordDetailResponse[];

  @ApiProperty({ type: String, nullable: true, description: '続きがあるときの印。次の呼び出しの cursor にそのまま渡す。最後のページは null' })
  nextCursor!: string | null;
}

export class CreateSetRequest {
  @ApiProperty({ format: 'uuid', description: '端末で作る ID。同じ ID を送り直しても、セットは1件のまま（冪等）' })
  id!: string;

  @ApiProperty({ format: 'uuid', description: '種目の ID（一覧の種目か、自分で追加した種目）' })
  exerciseId!: string;

  @ApiProperty({ minimum: 1, maximum: 99, example: 1, description: 'その種目の何セット目か（1〜99）。同じ記録・同じ種目の中で一意' })
  setNo!: number;

  @ApiProperty({ minimum: 0, maximum: 500, multipleOf: 0.5, example: 40, description: '重量（kg）。0〜500 の 0.5 刻み。自重の種目は 0' })
  weightKg!: number;

  @ApiProperty({ minimum: 1, maximum: 999, example: 10, description: '回数（1〜999 の整数）' })
  reps!: number;
}

export class SetResponse {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ example: 1 })
  setNo!: number;

  @ApiProperty({ example: 40 })
  weightKg!: number;

  @ApiProperty({ example: 10 })
  reps!: number;

  @ApiProperty({
    enum: ['up', 'same', 'down'],
    nullable: true,
    description: '前回の同じセットとの比べ結果。重量が同じなら回数、違えば重量×回数で比べる。前回が無ければ null。down は「負け」と言わない',
  })
  result!: GhostResult | null;

  @ApiProperty({ description: 'その種目で、過去最大の重量×回数を超えたら true（同じは false。初めての記録の最初のセットも false）' })
  isPersonalBest!: boolean;
}

export class WeekDay {
  @ApiProperty({ example: '2026-10-26', description: '日本時間の日付（YYYY-MM-DD）' })
  date!: string;

  @ApiProperty({ enum: ['rec', 'rest', 'none'], description: '記録した日は rec、休んだ日は rest、何もない日は none。同じ日に記録と休みがあれば rec' })
  status!: CellStatus;
}

export class WeekResponse {
  @ApiProperty({ example: '2026-10-26', description: 'その週の月曜の日付' })
  weekStart!: string;

  @ApiProperty({ type: [WeekDay], description: '月曜から日曜までの7日分（日付の昇順）' })
  days!: WeekDay[];
}

export class HeatmapPart {
  @ApiProperty({ enum: BODY_PARTS, enumName: 'BodyPart' })
  bodyPart!: BodyPart;

  @ApiProperty({ minimum: 0, example: 3, description: 'その週に記録したセットのうち、この部位の種目のセット数' })
  sets!: number;
}

export class HeatmapResponse {
  @ApiProperty({ example: '2026-10-26', description: 'その週の月曜の日付' })
  weekStart!: string;

  @ApiProperty({ type: [HeatmapPart], description: 'すべての部位（0セットの部位も入る）。並びは部位の一覧の順' })
  parts!: HeatmapPart[];
}


export class StatsCalendarDay {
  @ApiProperty({ example: '2026-11-12' })
  date!: string;

  @ApiProperty({ enum: ['rec', 'rest', 'none'], description: '記録した日は rec、休んだ日は rest、何もない日は none。同じ日に記録と休みがあれば rec' })
  status!: CellStatus;
}

export class StatsMonth {
  @ApiProperty({ example: '2026-11', description: '今日を含む月（日本時間）' })
  month!: string;

  @ApiProperty({ minimum: 0, description: '今月、筋トレかランを記録した日の数' })
  activeDays!: number;

  @ApiProperty({ minimum: 0, description: '今月、休みだけを記録した日の数（同じ日に記録があれば数えない）' })
  restDays!: number;

  @ApiProperty({ minimum: 0, description: '今月の総重量（重量×回数の合計。kg。小数1桁）' })
  totalWeightKg!: number;

  @ApiProperty({ minimum: 0, description: '今月のランの合計距離（m）' })
  runDistanceM!: number;
}

export class StatsWeek {
  @ApiProperty({ example: '2026-11-09', description: 'その週の月曜の日付' })
  weekStart!: string;

  @ApiProperty({ minimum: 0 })
  totalWeightKg!: number;

  @ApiProperty({ minimum: 0 })
  runDistanceM!: number;
}

export class StatsStamp {
  @ApiProperty({ enum: STAMP_KEYS, enumName: 'StampKey' })
  key!: StampKey;

  @ApiProperty({ description: '獲得済みか（初めて・累計だけで決まる。連続日数の型は無い）' })
  earned!: boolean;
}

export class StatsResponse {
  @ApiProperty({ example: '2026-11-12', description: '集計の基準にした今日（日本時間）' })
  today!: string;

  @ApiProperty({ type: [StatsCalendarDay], description: '今日を最後にした365日分のマス（日付の昇順）。週・月・年の切替はこれを画面で切り出す' })
  calendar!: StatsCalendarDay[];

  @ApiProperty({ type: StatsMonth })
  month!: StatsMonth;

  @ApiProperty({ type: [StatsWeek], description: '今週を最後にした直近12週（月曜の昇順）' })
  weekly!: StatsWeek[];

  @ApiProperty({ type: [StatsStamp], description: 'スタンプ帳。全期間の記録から毎回計算する' })
  stamps!: StatsStamp[];

  @ApiProperty({ minimum: 0, description: '全期間のランの累計距離（m）。日本縦断（F-28）の進み具合に使う。今日より後の日付は数えない' })
  totalRunDistanceM!: number;
}
