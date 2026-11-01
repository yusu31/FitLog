// 表の定義の置き場。表は機能と同じ PR で足す（認証＝02-1 ③a、記録＝02-2 など）。
import { sql } from 'drizzle-orm';
import { boolean, check, index, jsonb, numeric, pgEnum, pgTable, primaryKey, smallint, text, timestamp, uniqueIndex, uuid } from 'drizzle-orm/pg-core';

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
