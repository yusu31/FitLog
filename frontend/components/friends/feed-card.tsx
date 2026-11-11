'use client';

import { useQueryClient } from '@tanstack/react-query';
import { MessageCircle } from 'lucide-react';
import { useId, useState, type FormEvent } from 'react';
import { cn } from 'cn';
import { ThickButton } from '@/components/fitlog/thick-button';
import { Input } from '@/components/ui/input';
import { sendErrorText, unwrap } from '@/lib/api/api-error';
import {
  getGetFeedQueryKey,
  useAddComment,
  useAddReaction,
  useDeleteReaction,
  type FeedItem,
} from '@/lib/api/generated';
import {
  COMMENT_MAX,
  QUICK_COMMENTS,
  STAMP_KEYS,
  describeItem,
  normalizeComment,
  stampState,
  type StampKey,
} from '@/lib/feed';
import { formatJstTime, formatMonthDay } from '@/lib/format';
import { FEED_MESSAGES } from '@/lib/messages';
import { useOnline } from '@/lib/use-browser-state';
import { AVATAR_BG } from './member-list';
import { StampButton } from './stamp-button';

// 足跡の1件。スタンプ（付け外し）とコメント（定型4つ／休みは2つ＋自由入力 50字まで）。
// 付け外しは電波があるときだけ（F-30）。送ったあとは足跡を取り直すので、数と「自分が付けた」はサーバーの値になる。
// コメントの本文を読む画面は記録の詳細（S-21）。ここでは件数だけ出す
export function FeedCard({ item }: { item: FeedItem }) {
  const online = useOnline();
  const queryClient = useQueryClient();
  const addReaction = useAddReaction();
  const deleteReaction = useDeleteReaction();
  const [openComments, setOpenComments] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const { title, detail } = describeItem(item);
  const busy = addReaction.isPending || deleteReaction.isPending;

  const refresh = () => queryClient.invalidateQueries({ queryKey: getGetFeedQueryKey() });

  async function toggle(key: StampKey) {
    const { mine } = stampState(item.stamps, key);
    setNotice(null);
    try {
      if (mine) unwrap(await deleteReaction.mutateAsync({ id: item.id, reactionId: mine }));
      else unwrap(await addReaction.mutateAsync({ id: item.id, data: { id: crypto.randomUUID(), stampKey: key } }));
    } catch (e) {
      setNotice(sendErrorText(e, FEED_MESSAGES.stampFailed));
    } finally {
      void refresh();
    }
  }

  return (
    <li className="fl-slab space-y-2 px-3 py-3">
      <div className="flex items-center gap-3">
        <span
          aria-hidden
          className="flex size-11 shrink-0 items-center justify-center rounded-full text-[19px] font-extrabold text-white"
          style={{ background: AVATAR_BG[item.author.avatar.shirtColor] ?? AVATAR_BG.navy }}
        >
          {Array.from(item.author.name)[0]}
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[15px] leading-tight font-extrabold">
            {item.author.name}
            <span className="ml-2 text-sub-strong">{title}</span>
            {detail && <span className="ml-1.5 text-sm text-sub-strong">{detail}</span>}
          </p>
          <p className="mt-0.5 text-xs font-bold text-sub">
            {formatMonthDay(item.localDate)} {formatJstTime(item.recordedAt)}
          </p>
        </div>
      </div>

      <ul aria-label={`${item.author.name}の${title}へのスタンプ`} className="flex flex-wrap gap-1.5">
        {STAMP_KEYS[item.kind].map((key) => {
          const { count, mine } = stampState(item.stamps, key);
          return (
            <li key={key}>
              <StampButton stampKey={key} count={count} pressed={mine !== null} disabled={!online || busy} onClick={() => void toggle(key)} />
            </li>
          );
        })}
        <li>
          <button
            type="button"
            aria-expanded={openComments}
            onClick={() => setOpenComments((v) => !v)}
            className="flex min-h-11 items-center gap-1.5 rounded-full border-2 border-line bg-white px-3 text-sm font-extrabold text-sub-strong outline-none focus-visible:ring-4 focus-visible:ring-teal/40"
          >
            <MessageCircle aria-hidden className="size-4" />
            {FEED_MESSAGES.commentsOpen(item.commentCount)}
          </button>
        </li>
      </ul>

      {!online && <p className="text-xs font-bold text-sub-strong">{FEED_MESSAGES.offlineNote}</p>}
      {notice && (
        <p role="alert" className="rounded-lg bg-coral-light px-3 py-2 text-sm font-bold text-ink">
          {notice}
        </p>
      )}
      {openComments && <CommentPanel item={item} online={online} onSent={() => void refresh()} />}
    </li>
  );
}

// 定型コメントのボタンと、自由入力（50字まで）。送れたら一言出して入力欄を空にする
function CommentPanel({ item, online, onSent }: { item: FeedItem; online: boolean; onSent: () => void }) {
  const addComment = useAddComment();
  const inputId = useId();
  const [message, setMessage] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null);
  const [text, setText] = useState('');

  async function send(raw: string): Promise<boolean> {
    const body = normalizeComment(raw);
    if (body === null) {
      setMessage({ kind: 'error', text: FEED_MESSAGES.commentLength });
      return false;
    }
    setMessage(null);
    try {
      unwrap(await addComment.mutateAsync({ id: item.id, data: { id: crypto.randomUUID(), body } }));
      setMessage({ kind: 'ok', text: FEED_MESSAGES.commentSent });
      onSent();
      return true;
    } catch (e) {
      setMessage({ kind: 'error', text: sendErrorText(e, FEED_MESSAGES.commentFailed) });
      return false;
    }
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (await send(text)) setText('');
  }

  const disabled = !online || addComment.isPending;
  return (
    <div className="space-y-2 rounded-fl bg-face p-3">
      <ul aria-label="定型コメント" className="flex flex-wrap gap-1.5">
        {QUICK_COMMENTS[item.kind].map((body) => (
          <li key={body}>
            <button
              type="button"
              disabled={disabled}
              onClick={() => void send(body)}
              className="min-h-11 rounded-full border-2 border-teal-light bg-white px-3 text-sm font-extrabold text-teal-dark outline-none focus-visible:ring-4 focus-visible:ring-teal/40 disabled:opacity-60"
            >
              {body}
            </button>
          </li>
        ))}
      </ul>
      <form onSubmit={(e) => void onSubmit(e)} className="space-y-2">
        <label htmlFor={inputId} className="text-xs font-bold text-sub-strong">
          {FEED_MESSAGES.commentInputLabel}
        </label>
        <div className="flex gap-2">
          <Input
            id={inputId}
            value={text}
            onChange={(e) => setText(e.target.value)}
            maxLength={COMMENT_MAX}
            autoComplete="off"
            className="h-11 flex-1 text-base"
          />
          <ThickButton type="submit" size="sm" disabled={disabled}>
            {FEED_MESSAGES.commentSend}
          </ThickButton>
        </div>
      </form>
      {message && (
        <p
          role={message.kind === 'error' ? 'alert' : 'status'}
          className={cn('rounded-lg px-3 py-2 text-sm font-bold text-ink', message.kind === 'error' ? 'bg-coral-light' : 'bg-teal-light')}
        >
          {message.text}
        </p>
      )}
    </div>
  );
}
