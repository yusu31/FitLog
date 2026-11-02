'use client';

import { Ellipsis, Moon, Trash2 } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { cn } from 'cn';
import { ThickButton } from '@/components/fitlog/thick-button';
import { sendErrorText } from '@/lib/api/api-error';
import { useListRecords, type RecordDetailResponse } from '@/lib/api/generated';
import { formatDistance, formatDuration, formatMonthDay, WEEKDAYS, weekdayIndex } from '@/lib/format';
import { ME_MESSAGES } from '@/lib/messages';
import { useRecordMutations } from '@/lib/mutations';
import { useOnline } from '@/lib/use-browser-state';

const PAGE_SIZE = '20';
const LOAD_ERROR = '読み込めませんでした。電波の良い所で開き直してください';

// 「…」と確認ダイアログの状態は、ページをまたいで1つだけ持つ（同時に開くのは1つ）
type Actions = {
  menuFor: string | null;
  setMenuFor: (id: string | null) => void;
  askDelete: (record: RecordDetailResponse) => void;
  online: boolean;
  deleted: ReadonlySet<string>;
};

// 記録の一覧（新しい順・20件ずつ）。「もっと見る」で、前の応答の nextCursor を渡して続きを読む。
// 1ページ = 1つの部品にして、次のページの部品を下に足していく（先に読んだ分は TanStack Query が覚えているので消えない）。
// 各記録の「…」から「削除」を選べる（確認つき・電波があるときだけ。features.md 2.11）。
// 左スワイプは使わない（見つけにくく誤操作もある。screen-design.md）
export function RecordsList() {
  const online = useOnline();
  const { deleteRecord } = useRecordMutations();
  const [menuFor, setMenuFor] = useState<string | null>(null);
  const [confirming, setConfirming] = useState<RecordDetailResponse | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  // 消せた記録。一覧を取り直すまでの間も、すぐ見えなくする
  const [deleted, setDeleted] = useState<ReadonlySet<string>>(new Set());

  useEffect(() => {
    if (!menuFor && !confirming) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      setConfirming(null);
      setMenuFor(null);
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [menuFor, confirming]);

  function onDelete(record: RecordDetailResponse) {
    setConfirming(null);
    setNotice(null);
    deleteRecord
      .mutateAsync({ id: record.id })
      .then(() => setDeleted((prev) => new Set(prev).add(record.id)))
      .catch((e: unknown) => setNotice(sendErrorText(e, ME_MESSAGES.deleteError)));
  }

  const actions: Actions = {
    menuFor,
    setMenuFor,
    askDelete: (record) => {
      setMenuFor(null);
      setConfirming(record);
    },
    online,
    deleted,
  };

  return (
    <section aria-labelledby="records-heading">
      <h2 id="records-heading" className="mb-2 text-sm font-extrabold text-sub-strong">
        記録
      </h2>
      {notice && (
        <p role="alert" className="mb-2 rounded-fl bg-coral-light px-4 py-3 text-sm font-bold text-ink">
          {notice}
        </p>
      )}
      <ul aria-label="記録" className="space-y-2">
        <RecordsPage cursor={undefined} isFirst actions={actions} />
      </ul>

      {confirming && <ConfirmDelete record={confirming} onCancel={() => setConfirming(null)} onConfirm={() => onDelete(confirming)} />}
    </section>
  );
}

function RecordsPage({ cursor, isFirst = false, actions }: { cursor: string | undefined; isFirst?: boolean; actions: Actions }) {
  const { data, isPending, isError } = useListRecords({ limit: PAGE_SIZE, ...(cursor ? { cursor } : {}) });
  const [more, setMore] = useState(false);

  if (isPending) {
    return (
      <li aria-busy="true" aria-label="記録を読み込み中" className="h-16 animate-pulse rounded-fl bg-face" />
    );
  }
  if (isError || !data || data.status !== 200) {
    return (
      <li role="alert" className="rounded-fl bg-coral-light px-4 py-3 text-sm font-bold text-ink">
        {LOAD_ERROR}
      </li>
    );
  }
  const { items, nextCursor } = data.data;
  const shown = items.filter((r) => !actions.deleted.has(r.id));
  return (
    <>
      {isFirst && shown.length === 0 && (
        <li className="fl-slab px-4 py-5 text-center text-sm font-bold text-sub-strong">まだ記録がありません</li>
      )}
      {shown.map((record) => (
        <RecordRow key={record.id} record={record} actions={actions} />
      ))}
      {nextCursor &&
        (more ? (
          <RecordsPage cursor={nextCursor} actions={actions} />
        ) : (
          <li className="list-none pt-1">
            <ThickButton tone="white" size="sm" className="w-full" onClick={() => setMore(true)}>
              もっと見る
            </ThickButton>
          </li>
        ))}
    </>
  );
}

function RecordRow({ record, actions }: { record: RecordDetailResponse; actions: Actions }) {
  const { title, detail } = summarize(record);
  const open = actions.menuFor === record.id;
  return (
    <li className="fl-slab relative flex min-h-16 items-center gap-3 py-1 pr-1 pl-3">
      {/* 日付と中身をまとめて、記録の詳細（S-21）へのリンクにする。自分の記録なので from=me を付ける */}
      <Link
        href={`/record-detail?id=${encodeURIComponent(record.id)}&from=me`}
        className="flex min-h-14 min-w-0 flex-1 items-center gap-3 rounded-fl outline-none focus-visible:ring-4 focus-visible:ring-teal/40"
      >
      <div className="w-[68px] shrink-0 leading-tight">
        <p className="fl-num text-xl text-ink">{formatMonthDay(record.localDate)}</p>
        <p className="text-[11px] font-bold text-sub">{WEEKDAYS[weekdayIndex(record.localDate)]}曜</p>
      </div>
      <div className="min-w-0 flex-1">
        <p className="flex items-center gap-1.5 truncate text-[15px] leading-tight font-extrabold">
          {record.kind === 'rest' && (
            <span
              aria-hidden
              className={cn('flex size-5 shrink-0 items-center justify-center rounded-full bg-grape-dark text-white')}
            >
              <Moon className="size-3" />
            </span>
          )}
          {title}
        </p>
        {detail && <p className="mt-0.5 text-xs font-bold text-sub">{detail}</p>}
      </div>
      </Link>
      <button
        type="button"
        aria-label={`${formatMonthDay(record.localDate)} ${title}の メニュー`}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => actions.setMenuFor(open ? null : record.id)}
        className="flex size-11 shrink-0 items-center justify-center rounded-fl text-sub-strong outline-none focus-visible:ring-4 focus-visible:ring-teal/40"
      >
        <Ellipsis aria-hidden className="size-6" />
      </button>
      {open && (
        <div
          role="menu"
          // 下のタブに隠れないよう、開いたときに見える所までスクロールする（タブの高さ分の余白を取る）
          ref={(el) => el?.scrollIntoView?.({ block: 'nearest' })}
          className="absolute top-full right-1 z-10 mt-1 w-56 scroll-mb-28 rounded-fl border-2 border-line bg-white p-1 shadow-lg"
        >
          <button
            type="button"
            role="menuitem"
            disabled={!actions.online}
            onClick={() => actions.askDelete(record)}
            className="flex min-h-11 w-full items-center gap-2 rounded-lg px-3 text-left font-extrabold text-coral-strong outline-none focus-visible:ring-4 focus-visible:ring-teal/40 disabled:text-sub disabled:opacity-100"
          >
            <Trash2 aria-hidden className="size-5" />
            削除
          </button>
          {!actions.online && <p className="px-3 pb-2 text-xs text-sub-strong">{ME_MESSAGES.offlineNote}</p>}
        </div>
      )}
    </li>
  );
}

function ConfirmDelete({ record, onCancel, onConfirm }: { record: RecordDetailResponse; onCancel: () => void; onConfirm: () => void }) {
  const { title, detail } = summarize(record);
  return (
    <div className="fixed inset-0 z-30 flex items-end justify-center bg-ink/50 p-4 sm:items-center">
      <div role="alertdialog" aria-modal="true" aria-labelledby="del-record-title" aria-describedby="del-record-desc" className="w-full max-w-sm rounded-2xl bg-white p-5">
        <h2 id="del-record-title" className="text-xl font-extrabold">
          {ME_MESSAGES.deleteTitle}
        </h2>
        <p id="del-record-desc" className="mt-2 text-sm text-sub-strong">
          <span className="fl-num text-base text-ink">{formatMonthDay(record.localDate)}</span> ・ {title}
          {detail && <> ・ {detail}</>} を取り消します。
          {record.kind === 'workout' && <> {ME_MESSAGES.deleteNote}</>}
        </p>
        <div className="mt-5 flex gap-2">
          <ThickButton autoFocus tone="white" size="sm" className="flex-1" onClick={onCancel}>
            やめる
          </ThickButton>
          <ThickButton tone="coral" size="sm" className="flex-1" onClick={onConfirm}>
            削除する
          </ThickButton>
        </div>
      </div>
    </div>
  );
}

function summarize(record: RecordDetailResponse): { title: string; detail: string } {
  if (record.kind === 'rest') return { title: 'おやすみ', detail: '' };
  if (record.kind === 'run') {
    const run = record.run;
    return { title: 'ラン', detail: run ? `${formatDistance(run.distanceM)} ・ ${formatDuration(run.durationS)}` : '' };
  }
  const exercises = record.exercises ?? [];
  if (exercises.length === 0) return { title: '筋トレ', detail: '' };
  const sets = exercises.reduce((sum, e) => sum + e.sets.length, 0);
  const extra = exercises.length - 1;
  return { title: `${exercises[0].name}${extra > 0 ? ` ほか${extra}種目` : ''}`, detail: `${sets}セット` };
}
