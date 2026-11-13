// 表の定義の置き場。表は機能と同じ PR で足す（認証＝02-1 ③a、記録＝02-2 など）。
import { sql } from 'drizzle-orm';
import { boolean, check, date, index, integer, jsonb, numeric, pgEnum, pgTable, primaryKey, smallint, text, timestamp, uniqueIndex, uuid } from 'drizzle-orm/pg-core';

// ── better-auth が使う4つの表 ──────────────────────────────────────────
// 列の形は better-auth 1.7.14 の @better-auth/core/dist/db/get-tables.mjs の定義に合わせる。
// 表名を複数形（users 等）にするため、betterAuth の drizzleAdapter に usePlural: true を渡す（src/auth/auth.ts）。
// better-auth は ID を自分で作る（text）。

// キャラの設定の既定値（docs/database-design.md users.avatar）
export const DEFAULT_AVATAR = {
  body: 'A',
  hair: 1,
  hairColor: 'brown',
  shirtColor: 'teal',
  pantsColor: 'navy',
} as const;

export const users = pgTable('users', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  email: text('email').notNull().unique(),
  emailVerified: boolean('email_verified').notNull().default(false),
  image: text('image'),
  // better-auth の列ではない。登録のときは渡されないので、DB の既定値で埋まる
  avatar: jsonb('avatar').notNull().default(DEFAULT_AVATAR),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export const sessions = pgTable('sessions', {
  id: text('id').primaryKey(),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  token: text('token').notNull().unique(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  ipAddress: text('ip_address'),
  userAgent: text('user_agent'),
  userId: text('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
});

export const accounts = pgTable('accounts', {
  id: text('id').primaryKey(),
  accountId: text('account_id').notNull(),
  providerId: text('provider_id').notNull(),
  userId: text('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  accessToken: text('access_token'),
  refreshToken: text('refresh_token'),
  idToken: text('id_token'),
  accessTokenExpiresAt: timestamp('access_token_expires_at', { withTimezone: true }),
  refreshTokenExpiresAt: timestamp('refresh_token_expires_at', { withTimezone: true }),
  scope: text('scope'),
  // メール＋パスワード登録のときのパスワードのハッシュ（better-auth が scrypt で作る）
  password: text('password'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export const verifications = pgTable('verifications', {
  id: text('id').primaryKey(),
  identifier: text('identifier').notNull(),
  value: text('value').notNull(),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

// ── グループと招待（docs/database-design.md 3章） ─────────────────────────────
export const groups = pgTable('groups', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
  createdBy: text('created_by').references(() => users.id),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

// user_id の UNIQUE が「1人が入れるグループは1つ」を守る。人数の上限（5人）は制約では守れないので、参加の処理で数え直す
export const groupMembers = pgTable(
  'group_members',
  {
    groupId: uuid('group_id')
      .notNull()
      .references(() => groups.id),
    userId: text('user_id')
      .notNull()
      .unique()
      .references(() => users.id, { onDelete: 'cascade' }),
    joinedAt: timestamp('joined_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.groupId, t.userId] })],
);

// 招待リンクの値そのものは保存しない（SHA-256 のハッシュだけ）。取り消しは行を消さず revoked_at に時刻を入れる
export const invitations = pgTable('invitations', {
  id: uuid('id').primaryKey().defaultRandom(),
  groupId: uuid('group_id')
    .notNull()
    .references(() => groups.id),
  tokenHash: text('token_hash').notNull().unique(),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  createdBy: text('created_by').references(() => users.id),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  revokedAt: timestamp('revoked_at', { withTimezone: true }),
});

// ── 種目（docs/database-design.md exercises） ─────────────────────────────────
// ヒートマップの部位（仮置きの7つ。体の図 F-12 を作るときに細かく分けるかを決める）
export const BODY_PARTS = ['chest', 'back', 'shoulders', 'arms', 'abs', 'glutes', 'legs'] as const;
export type BodyPart = (typeof BODY_PARTS)[number];
export const bodyPart = pgEnum('body_part', BODY_PARTS);

// 一覧の種目（約30件）は created_by が NULL で、マイグレーションが固定の ID で入れる。自分で足した種目は作者の ID が入る。
// 同名の防止は2本の部分でない索引で守る（大文字小文字は区別しない）。一覧の種目と同名の追加は、別の行どうしなので API で確かめる。
export const exercises = pgTable(
  'exercises',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    name: text('name').notNull(),
    bodyPart: bodyPart('body_part').notNull(),
    createdBy: text('created_by').references(() => users.id),
    // お試しの前回値（一覧の種目だけ。2つは同時に入れる）。記録としては保存しない
    trialWeightKg: numeric('trial_weight_kg', { precision: 4, scale: 1 }),
    trialReps: smallint('trial_reps'),
  },
  (t) => [
    index('exercises_created_by_idx').on(t.createdBy),
    uniqueIndex('exercises_created_by_name_uq').on(t.createdBy, sql`lower(${t.name})`),
    // お試しの前回値は、重量と回数を同時に入れる（片方だけは不可）
    check('exercises_trial_pair_ck', sql`(${t.trialWeightKg} is null) = (${t.trialReps} is null)`),
    uniqueIndex('exercises_common_name_uq')
      .on(sql`lower(${t.name})`)
      .where(sql`${t.createdBy} is null`),
  ],
);

// ── 記録（docs/database-design.md records） ──────────────────────────────────
// 筋トレ・ラン・休みの3種類を kind で分ける「1回の記録の入れ物」。種類ごとの中身は workout_sets・run_details が持つ。
export const RECORD_KINDS = ['workout', 'run', 'rest'] as const;
export type RecordKind = (typeof RECORD_KINDS)[number];
export const recordKind = pgEnum('record_kind', RECORD_KINDS);

// id は端末で作る UUID（オフラインで作った記録が、再送されても二重にならないため。F-30）
// local_date は、サーバーが recorded_at から日本時間（Asia/Tokyo）で出す日付
export const records = pgTable(
  'records',
  {
    id: uuid('id').primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => users.id),
    kind: recordKind('kind').notNull(),
    recordedAt: timestamp('recorded_at', { withTimezone: true }).notNull(),
    localDate: date('local_date').notNull(),
    // あとから記録（F-21）。端末で保存を押した日より前の日の記録なら true。端末が保存の時点で決めるので、オフラインで翌日に届いても変わらない
    late: boolean('late').notNull().default(false),
    // メニューのコピー（F-24）。コピーして始めた記録だけ、コピー元の人の id が入る。抜けた仲間でも消さない（画面は「仲間から」と出す）
    copiedFromUserId: text('copied_from_user_id').references(() => users.id),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('records_user_local_date_idx').on(t.userId, t.localDate.desc()),
    index('records_user_recorded_at_idx').on(t.userId, t.recordedAt.desc()),
    // 休みは1日1件（筋トレ・ランは1日に何件でもよい）
    uniqueIndex('records_rest_per_day_uq')
      .on(t.userId, t.localDate)
      .where(sql`${t.kind} = 'rest'`),
  ],
);

// ── ランの詳細（docs/database-design.md run_details） ──────────────────────
// kind = 'run' の記録に1行。距離は m・時間は秒の整数で持つ（ペースは画面が計算する。DB には持たない）。
// route は GPX を取り込んだランだけ（GeoJSON の LineString。点は [経度, 緯度]・2〜3,000 点）。gpx_s3_key は元の GPX を S3 に置くときに足す
export const runDetails = pgTable(
  'run_details',
  {
    recordId: uuid('record_id')
      .primaryKey()
      .references(() => records.id, { onDelete: 'cascade' }),
    distanceM: integer('distance_m').notNull(),
    durationS: integer('duration_s').notNull(),
    route: jsonb('route').$type<{ type: 'LineString'; coordinates: [number, number][] }>(),
  },
  (t) => [
    check('run_details_distance_ck', sql`${t.distanceM} between 100 and 200000`),
    check('run_details_duration_ck', sql`${t.durationS} between 60 and 86400`),
    // API の検査をすり抜けても、LineString でない・点の数が範囲外のものは DB が止める
    check('run_details_route_ck', sql`${t.route} is null or (${t.route}->>'type' = 'LineString' and jsonb_array_length(${t.route}->'coordinates') between 2 and 3000)`),
  ],
);

// ── 筋トレのセット（docs/database-design.md workout_sets） ──────────────────
// id は端末で作る UUID（再送しても二重にならない。F-30）。範囲の検査は API でもするが、すり抜けても DB が止める（CHECK）。
// 重量は 0〜500 の 0.5 刻み、回数は 1〜999、セット番号は 1〜99（セット番号の上限は docs/design.md 7章）
export const workoutSets = pgTable(
  'workout_sets',
  {
    id: uuid('id').primaryKey(),
    recordId: uuid('record_id')
      .notNull()
      .references(() => records.id, { onDelete: 'cascade' }),
    exerciseId: uuid('exercise_id')
      .notNull()
      .references(() => exercises.id),
    setNo: smallint('set_no').notNull(),
    weightKg: numeric('weight_kg', { precision: 4, scale: 1 }).notNull(),
    reps: smallint('reps').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    // 同じ記録・同じ種目・同じセット番号の二重登録を防ぐ
    uniqueIndex('workout_sets_record_exercise_set_uq').on(t.recordId, t.exerciseId, t.setNo),
    // 前回の取得（ゴースト）・自己ベストの判定
    index('workout_sets_exercise_record_idx').on(t.exerciseId, t.recordId),
    check('workout_sets_set_no_ck', sql`${t.setNo} between 1 and 99`),
    check('workout_sets_weight_ck', sql`${t.weightKg} between 0 and 500 and (${t.weightKg} * 2) = trunc(${t.weightKg} * 2)`),
    check('workout_sets_reps_ck', sql`${t.reps} between 1 and 999`),
  ],
);

// ── スタンプとコメント（docs/database-design.md reactions・comments） ─────────────
// どちらも id は端末で作る UUID（再送しても二重にならない。F-30）。記録を消すと一緒に消える（ON DELETE CASCADE）。
// stamp_key の一覧は DB に持たず、コードの定数（src/feed/stamps.ts）にする（増やすたびにマイグレーションを要さないため）
export const reactions = pgTable(
  'reactions',
  {
    id: uuid('id').primaryKey(),
    recordId: uuid('record_id')
      .notNull()
      .references(() => records.id, { onDelete: 'cascade' }),
    userId: text('user_id')
      .notNull()
      .references(() => users.id),
    stampKey: text('stamp_key').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    // 同じ人が同じ記録に同じスタンプを二重に付けられない（記録ごとの一覧にも使う）
    uniqueIndex('reactions_record_user_stamp_uq').on(t.recordId, t.userId, t.stampKey),
  ],
);

// 本文は 1〜50 字。数え方は Unicode のコードポイント数（PostgreSQL の char_length と、API の Array.from(text).length が一致する）
export const comments = pgTable(
  'comments',
  {
    id: uuid('id').primaryKey(),
    recordId: uuid('record_id')
      .notNull()
      .references(() => records.id, { onDelete: 'cascade' }),
    userId: text('user_id')
      .notNull()
      .references(() => users.id),
    body: text('body').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('comments_record_created_at_idx').on(t.recordId, t.createdAt),
    check('comments_body_ck', sql`char_length(${t.body}) between 1 and 50`),
  ],
);

// ── 動画（docs/database-design.md videos） ─────────────────────────────────────
// 1記録に1本（record_id が UNIQUE）。行は署名付き POST を発行するときに作る（置き終わった印は持たない。やり直しは同じキーで署名し直す）。
// s3_key は記録ごとに決まる（videos/{record_id}）ので、撮り直しは同じ場所を上書きする。
// size_bytes は画面の申告で、署名の条件（サイズは申告値ちょうど）にも入れるので、S3 に置かれたものと一致する。
// visible_until は仲間に見える期限（記録の週の日曜 24:00 日本時間。本人は期限に関係なく見られる）
export const videos = pgTable(
  'videos',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    recordId: uuid('record_id')
      .notNull()
      .unique()
      .references(() => records.id, { onDelete: 'cascade' }),
    s3Key: text('s3_key').notNull(),
    contentType: text('content_type').notNull(),
    sizeBytes: integer('size_bytes').notNull(),
    visibleUntil: timestamp('visible_until', { withTimezone: true }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [check('videos_size_ck', sql`${t.sizeBytes} between 1 and 10485760`)],
);
