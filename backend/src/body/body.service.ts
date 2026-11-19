import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { and, asc, desc, eq, lte } from 'drizzle-orm';
import { isUuid } from '../common/uuid.js';
import { DB, type Db } from '../db/db.module.js';
import { bodyWeights, exercises, groupMembers, records, runDetails, users, workoutSets } from '../db/schema.js';
import { avg7, bmi, deltaFromPrevious, estimateKcal, metsForRun, METS_WORKOUT, oneRepMax, type WeightPoint } from './body-calc.js';
import { parseHeightInput, parseMeasuredOn, parseProfileInput, parseWeightInput } from './body-input.js';
import type { BodyResponse, CaloriesResponse, OneRepMaxResponse, ProfileResponse } from './body.response.js';

const HISTORY_LIMIT = 120;

const weightNotFound = () => new NotFoundException({ code: 'WEIGHT_NOT_FOUND', message: 'その日の体重が見つかりません', details: null });
const recordNotFound = () => new NotFoundException({ code: 'RECORD_NOT_FOUND', message: '記録が見つかりません', details: null });
const userNotFound = () => new NotFoundException({ code: 'USER_NOT_FOUND', message: 'ユーザーが見つかりません', details: null });

// からだ（B14a）。体重と身長は本人だけ（持ち主の id で絞るだけで、他人の行は読めない）。プロフィールは同じグループの仲間まで
@Injectable()
export class BodyService {
  constructor(@Inject(DB) private readonly db: Db) {}

  async get(userId: string): Promise<BodyResponse> {
    const [user] = await this.db.select({ heightCm: users.heightCm }).from(users).where(eq(users.id, userId));
    const rows = await this.db
      .select({ date: bodyWeights.measuredOn, kg: bodyWeights.kg })
      .from(bodyWeights)
      .where(eq(bodyWeights.userId, userId))
      .orderBy(desc(bodyWeights.measuredOn))
      .limit(HISTORY_LIMIT);
    const points: WeightPoint[] = rows.reverse().map((r) => ({ date: r.date, kg: Number(r.kg) }));
    const heightCm = user?.heightCm == null ? null : Number(user.heightCm);
    const last = points.at(-1) ?? null;
    return {
      heightCm,
      latest: last,
      bmi: bmi(last?.kg ?? null, heightCm),
      avg7: last ? avg7(points, last.date) : null,
      deltaFromPrevious: deltaFromPrevious(points),
      weights: points.map((p) => ({ date: p.date, kg: p.kg, avg7: avg7(points, p.date) })),
    };
  }

  async setHeight(userId: string, raw: unknown): Promise<void> {
    const { heightCm } = parseHeightInput(raw);
    await this.db.update(users).set({ heightCm: heightCm === null ? null : String(heightCm) }).where(eq(users.id, userId));
  }

  // 同じ日は上書き（user_id＋日付の一意制約に対する upsert）
  async setWeight(userId: string, date: string, raw: unknown): Promise<void> {
    const measuredOn = parseMeasuredOn(date);
    const { kg } = parseWeightInput(raw);
    await this.db
      .insert(bodyWeights)
      .values({ userId, measuredOn, kg: String(kg) })
      .onConflictDoUpdate({ target: [bodyWeights.userId, bodyWeights.measuredOn], set: { kg: String(kg) } });
  }

  async removeWeight(userId: string, date: string): Promise<void> {
    const measuredOn = parseMeasuredOn(date);
    const deleted = await this.db
      .delete(bodyWeights)
      .where(and(eq(bodyWeights.userId, userId), eq(bodyWeights.measuredOn, measuredOn)))
      .returning({ id: bodyWeights.id });
    if (deleted.length === 0) throw weightNotFound();
  }

  // 種目ごとに、自分のセットの中でいちばん高い推定1RM
  async oneRepMax(userId: string): Promise<OneRepMaxResponse> {
    const rows = await this.db
      .select({
        exerciseId: workoutSets.exerciseId,
        name: exercises.name,
        weightKg: workoutSets.weightKg,
        reps: workoutSets.reps,
        date: records.localDate,
      })
      .from(workoutSets)
      .innerJoin(records, eq(records.id, workoutSets.recordId))
      .innerJoin(exercises, eq(exercises.id, workoutSets.exerciseId))
      .where(eq(records.userId, userId));

    const best = new Map<string, OneRepMaxResponse['items'][number]>();
    for (const r of rows) {
      const weightKg = Number(r.weightKg);
      const est = oneRepMax(weightKg, r.reps);
      if (!est) continue;
      const cur = best.get(r.exerciseId);
      if (!cur || est.kg > cur.kg) {
        best.set(r.exerciseId, { exerciseId: r.exerciseId, name: r.name, kg: est.kg, weightKg, reps: r.reps, approximate: est.approximate, date: r.date });
      }
    }
    return { items: [...best.values()].sort((a, b) => b.kg - a.kg || a.name.localeCompare(b.name)) };
  }

  // 1つの記録の推定消費カロリー。自分の記録だけ（他人・存在しない・UUID でない → 404）
  async calories(userId: string, recordId: string): Promise<CaloriesResponse> {
    if (!isUuid(recordId)) throw recordNotFound();
    const [record] = await this.db.select({ userId: records.userId, kind: records.kind, localDate: records.localDate }).from(records).where(eq(records.id, recordId));
    if (!record || record.userId !== userId) throw recordNotFound();

    const out = (p: Partial<CaloriesResponse>): CaloriesResponse => ({ recordId, kcal: null, mets: null, durationSec: null, weightKg: null, reason: null, ...p });
    if (record.kind === 'rest') return out({ reason: 'REST' });

    // 記録の日以前でいちばん新しい体重
    const [w] = await this.db
      .select({ kg: bodyWeights.kg })
      .from(bodyWeights)
      .where(and(eq(bodyWeights.userId, userId), lte(bodyWeights.measuredOn, record.localDate)))
      .orderBy(desc(bodyWeights.measuredOn))
      .limit(1);
    const weightKg = w ? Number(w.kg) : null;

    let mets: number | null;
    let durationSec: number;
    if (record.kind === 'run') {
      const [run] = await this.db.select({ distanceM: runDetails.distanceM, durationS: runDetails.durationS }).from(runDetails).where(eq(runDetails.recordId, recordId));
      if (!run) return out({ reason: 'NO_DURATION', weightKg });
      durationSec = run.durationS;
      mets = metsForRun(run.distanceM / 1000 / (run.durationS / 3600));
      if (mets === null) return out({ reason: 'TOO_SLOW', durationSec, weightKg });
    } else {
      // 筋トレ: 最初のセット〜最後のセットの時間。測れない（セットが1つ）ときは出さない
      const sets = await this.db.select({ createdAt: workoutSets.createdAt }).from(workoutSets).where(eq(workoutSets.recordId, recordId)).orderBy(asc(workoutSets.createdAt));
      durationSec = sets.length < 2 ? 0 : Math.round((sets[sets.length - 1].createdAt.getTime() - sets[0].createdAt.getTime()) / 1000);
      if (durationSec <= 0) return out({ reason: 'NO_DURATION', weightKg });
      mets = METS_WORKOUT;
    }

    if (weightKg === null) return out({ reason: 'NO_WEIGHT', mets, durationSec });
    return out({ kcal: estimateKcal(mets, durationSec, weightKg), mets, durationSec, weightKg });
  }

  async getProfile(userId: string): Promise<ProfileResponse> {
    const [u] = await this.db.select({ id: users.id, name: users.name, bio: users.bio, favoriteKind: users.favoriteKind, activeTime: users.activeTime }).from(users).where(eq(users.id, userId));
    if (!u) throw userNotFound();
    return { userId: u.id, name: u.name, bio: u.bio, favoriteKind: u.favoriteKind as ProfileResponse['favoriteKind'], activeTime: u.activeTime as ProfileResponse['activeTime'] };
  }

  async setProfile(userId: string, raw: unknown): Promise<ProfileResponse> {
    const input = parseProfileInput(raw);
    await this.db.update(users).set(input).where(eq(users.id, userId));
    return this.getProfile(userId);
  }

  // 仲間のプロフィール。同じグループにいる人だけ（そうでなければ存在を教えず 404）
  async getMateProfile(viewerId: string, targetId: string): Promise<ProfileResponse> {
    if (targetId === viewerId) return this.getProfile(viewerId);
    const [mine] = await this.db.select({ groupId: groupMembers.groupId }).from(groupMembers).where(eq(groupMembers.userId, viewerId));
    if (!mine) throw userNotFound();
    const [theirs] = await this.db.select({ groupId: groupMembers.groupId }).from(groupMembers).where(and(eq(groupMembers.userId, targetId), eq(groupMembers.groupId, mine.groupId)));
    if (!theirs) throw userNotFound();
    return this.getProfile(targetId);
  }
}
