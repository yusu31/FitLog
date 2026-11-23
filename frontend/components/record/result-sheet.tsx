'use client';

import { useEffect, useState } from 'react';
import { cn } from 'cn';
import { BodyFigure } from '@/components/me/body-figure';
import { StampMedal } from '@/components/me/stamp-medal';
import { MyChara } from '@/components/fitlog/my-chara';
import type { BodyPart, StampKey } from '@/lib/api/generated';
import { BODY_PART_LABEL, BODY_PART_ORDER } from '@/lib/body-parts';
import { levelsOf } from '@/lib/heatmap';
import { STAMP_LABEL } from '@/lib/stats';
import { formatKcal } from '@/lib/body/body';
import { GHOST_MESSAGES, RECORD_MESSAGES, ghostUpMessage } from '@/lib/messages';
import { usePrefersReducedMotion } from '@/lib/use-browser-state';
import type { GhostResult } from '@/lib/shared/ghost';

// 0.8秒だと文字が読めず、キャラの動き（ガッツポーズは 320ms で2コマ）も分からなかった（公開版で本人が確認・2026-11-11）。
// 主な1行（約16字）を読め、キャラが数回動く長さにする。タップで飛ばせるので、急ぐ人は待たなくてよい
export const SHEET_MS = 3000;

export type SheetData = {
  setId: string;
  result: GhostResult | null;
  diff: number;
  isPersonalBest: boolean;
  summary: string;
  // 電波なしで押したとき、直後に添える1行（保存したこと・あとで送ること）
  note?: string;
  // 今日の記録で使った部位（F-19）。祝福の中で体の図を光らせる。無ければ出さない
  parts?: readonly BodyPart[];
  // 今月の何日目か（F-20）。分からないとき（まだ読み込めていない・電波なし）は出さない
  monthDay?: number;
  // 記録する日（きのうの分のとき、見出しを「きのう」にする。A02-8）。無ければ今日
  day?: 'today' | 'yesterday';
  // 推定消費カロリー（B14b）。体重が無い・時間が測れないときは無い（null も無いのと同じ）。本人だけの数字
  kcal?: number | null;
  // このセットで新しくとったスタンプ（D5 PR-2）。メダルが1回跳ねる。動きを減らす設定では動かさず、出すだけ
  newStamps?: readonly StampKey[];
};

// 結果シート（features.md 2.6）。「できた」の直後に 3秒出し、タップで飛ばせる。
// 画面の下に固定せず、セット一覧の流れの中（「できた」ボタンのすぐ下）に置く。入力欄やボタンを覆わない（A03-1・A11-3）

// 動きを減らす設定のときは、動かさず表示だけにする。責める言葉・悪い色は使わない（下回りも同じ明るい面）
export function ResultSheet({ sheet, onDismiss }: { sheet: SheetData | null; onDismiss: () => void }) {
  const reduced = usePrefersReducedMotion();
  const key = sheet?.setId;

  // 応援キャラの画像を先に読み込んでおく。電波がない場所で最初に「できた」を押しても、端末に残った画像が使える（A11-4）
  useEffect(() => {
    for (const pose of ['cheer', 'pb'] as const) {
      for (let i = 0; i < 2; i++) new Image().src = `/characters/${pose}_${i}.png`;
    }
  }, []);

  useEffect(() => {
    if (!key) return;
    const timer = setTimeout(onDismiss, SHEET_MS);
    return () => clearTimeout(timer);
    // 同じセットの結果が応答で直されても、3秒は数え直さない
  }, [key, onDismiss]);

  // 読み上げ用の領域は常に置き、中身だけ出し入れする（あとから挿入された領域は読まれないことがあるため）
  return (
    <div role="status" aria-live="polite" className="w-full">
      {sheet && <Body sheet={sheet} reduced={reduced} onDismiss={onDismiss} />}
    </div>
  );
}

function Body({ sheet, reduced, onDismiss }: { sheet: SheetData; reduced: boolean; onDismiss: () => void }) {
  const { result, diff, isPersonalBest, summary, note, parts, monthDay, day, kcal, newStamps } = sheet;
  const kcalText = formatKcal(kcal);
  const gold = result === 'up' || isPersonalBest;
  const [upLabel, upAmount] = ghostUpMessage(diff).split(' ');
  return (
    <button
      type="button"
      data-testid="result-sheet"
      data-motion={reduced ? 'reduced' : 'full'}
      onClick={onDismiss}
      className={cn(
        'relative flex w-full items-start gap-2 rounded-fl px-4 py-4 text-left text-fg outline-none',
        'focus-visible:ring-4 focus-visible:ring-teal/40',
        gold ? 'bg-gold' : 'bg-teal-light',
        !reduced && 'animate-in fade-in duration-300',
      )}
    >
      <span className="min-w-0 flex-1">
        {isPersonalBest && <span className="fl-tag mb-2 bg-night text-white">{RECORD_MESSAGES.best}</span>}
        <span className="block text-[26px] leading-tight font-extrabold">
          {result === 'up' ? (
            <>
              {upLabel} <span className="fl-num text-[40px]">{upAmount}</span>
            </>
          ) : result === 'same' ? (
            GHOST_MESSAGES.same
          ) : result === 'down' ? (
            GHOST_MESSAGES.down
          ) : (
            RECORD_MESSAGES.recorded
          )}
        </span>
        <span className="mt-1 block text-sm opacity-85">{summary}</span>
        {monthDay !== undefined && (
          <span data-testid="month-day" className="mt-1 block text-sm font-bold">
            今月 <span className="fl-num text-xl">{monthDay}</span> 日目（今月の合計）
          </span>
        )}
        {kcalText && (
          <span data-testid="sheet-kcal" className="mt-1 block text-sm font-bold">
            {kcalText}
          </span>
        )}
        {note && <span className="mt-1 block text-base font-bold">{note}</span>}
        {newStamps && newStamps.length > 0 && (
          <span data-testid="new-stamps" className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1">
            {newStamps.map((k) => (
              <span key={k} className="flex items-center gap-1 text-sm font-extrabold">
                <span className={reduced ? undefined : 'fl-medal-pop'}>
                  <StampMedal stampKey={k} earned size={32} />
                </span>
                スタンプ「{STAMP_LABEL[k]}」をとった！
              </span>
            ))}
          </span>
        )}
        {parts && parts.length > 0 && <TodayParts parts={parts} day={day} />}
      </span>
      <CheerSprite pose={isPersonalBest ? 'pb' : 'cheer'} />
    </button>
  );
}

// 応援キャラ。画像が読み込めなかったとき（電波がなく、まだ端末に無い画像）は、壊れた画像アイコンを出さず何も出さない（A11-4）。
// <img> の読み込み失敗は伝わらない（bubble しない）ので、捕まえる側（capture）で受ける
function CheerSprite({ pose }: { pose: 'pb' | 'cheer' }) {
  const [failed, setFailed] = useState(false);
  if (failed) return null;
  return (
    <span onErrorCapture={() => setFailed(true)} className="shrink-0">
      <MyChara pose={pose} size={64} />
    </span>
  );
}

// 今日きたえた部位（F-19）。からだの図（F-12）と同じ体の図で、使った部位だけを一番濃い色にする。色だけに頼らず、部位名も書く
function TodayParts({ parts, day }: { parts: readonly BodyPart[]; day?: 'today' | 'yesterday' }) {
  const levels = levelsOf(parts.map((bodyPart) => ({ bodyPart, sets: 4 })));
  const names = BODY_PART_ORDER.filter((p) => parts.includes(p)).map((p) => BODY_PART_LABEL[p]);
  return (
    <div data-testid="today-parts" className="mt-3 flex items-center gap-3">
      <div className="flex gap-2 rounded-lg bg-surface px-3 py-2">
        <BodyFigure view="front" levels={levels} size={36} />
        <BodyFigure view="back" levels={levels} size={36} />
      </div>
      <p className="text-sm font-bold">{day === 'yesterday' ? 'きのう' : '今日'}きたえたところ: {names.join('・')}</p>
    </div>
  );
}

