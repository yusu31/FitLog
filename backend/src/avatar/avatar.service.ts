import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import { DB, type Db } from '../db/db.module.js';
import { users } from '../db/schema.js';
import { normalizeAvatar, parseAvatarInput, type AvatarValue } from './avatar-input.js';

// キャラの設定（users.avatar の jsonb）。本人の行だけを読み書きする
@Injectable()
export class AvatarService {
  constructor(@Inject(DB) private readonly db: Db) {}

  async get(userId: string): Promise<AvatarValue> {
    const [u] = await this.db.select({ avatar: users.avatar }).from(users).where(eq(users.id, userId));
    if (!u) throw new NotFoundException({ code: 'USER_NOT_FOUND', message: 'ユーザーが見つかりません', details: null });
    return normalizeAvatar(u.avatar);
  }

  async set(userId: string, raw: unknown): Promise<AvatarValue> {
    const value = parseAvatarInput(raw);
    await this.db.update(users).set({ avatar: value }).where(eq(users.id, userId));
    return this.get(userId);
  }
}
