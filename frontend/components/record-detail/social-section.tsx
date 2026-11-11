'use client';

import { useQueryClient } from '@tanstack/react-query';
import { useId, useState, type FormEvent } from 'react';
import { cn } from 'cn';
import { ThickButton } from '@/components/fitlog/thick-button';
import { Input } from '@/components/ui/input';
import { sendErrorText, unwrap } from '@/lib/api/api-error';
import {
  getListCommentsQueryKey,
  getListReactionsQueryKey,
  useAddComment,
  useAddReaction,
  useDeleteComment,
  useDeleteReaction,
  useListComments,
  useListReactions,
  type CommentResponse,
  type FeedItemKind,
} from '@/lib/api/generated';
import { useAppSession } from '@/lib/use-app-session';
import { StampButton } from '@/components/friends/stamp-button';
import { COMMENT_MAX, STAMP_KEYS, normalizeComment, stampState, type StampKey } from '@/lib/feed';
import { formatJstTime, formatMonthDay } from '@/lib/format';
import { FEED_MESSAGES } from '@/lib/messages';
import { useOnline } from '@/lib/use-browser-state';

// S-21 のスタンプとコメント。仲間タブの足跡カード（feed-card.tsx）と同じ文言・スタンプの鍵を使う。
// 数と「自分が付けた」・コメントの一覧はサーバーの値。付け外し・投稿・削除のあとは取り直す。電波があるときだけ押せる（F-30）
export function SocialSection({ recordId, kind }: { recordId: string; kind: FeedItemKind }) {
  const online = useOnline();
  return (
    <div className="space-y-4">
      <Stamps recordId={recordId} kind={kind} online={online} />
      <Comments recordId={recordId} online={online} />
      {!online && <p className="text-center text-xs font-bold text-sub-strong">{FEED_MESSAGES.offlineNote}</p>}
    </div>
  );
}

function Stamps({ recordId, kind, online }: { recordId: string; kind: FeedItemKind; online: boolean }) {
  const queryClient = useQueryClient();
  const { data, isError } = useListReactions(recordId);
  const addReaction = useAddReaction();
  const deleteReaction = useDeleteReaction();
  const [notice, setNotice] = useState<string | null>(null);
  const busy = addReaction.isPending || deleteReaction.isPending;
  const stamps = data?.status === 200 ? data.data.items : [];
  const failed = isError || (data !== undefined && data.status !== 200);

  async function toggle(key: StampKey) {
    const { mine } = stampState(stamps, key);
    setNotice(null);
    try {
      if (mine) unwrap(await deleteReaction.mutateAsync({ id: recordId, reactionId: mine }));
      else unwrap(await addReaction.mutateAsync({ id: recordId, data: { id: crypto.randomUUID(), stampKey: key } }));
    } catch (e) {
      setNotice(sendErrorText(e, FEED_MESSAGES.stampFailed));
    } finally {
      void queryClient.invalidateQueries({ queryKey: getListReactionsQueryKey(recordId) });
    }
  }

  return (
    <section aria-labelledby="stamps-heading">
      <h2 id="stamps-heading" className="mb-2 text-base font-extrabold">
        {FEED_MESSAGES.stampsHeading}
      </h2>
      {failed ? (
        <p role="alert" className="rounded-fl bg-coral-light px-4 py-3 text-sm font-bold text-ink">
          {FEED_MESSAGES.stampsLoadFailed}
        </p>
      ) : (
        <ul aria-label="スタンプ" className="flex flex-wrap gap-1.5">
          {STAMP_KEYS[kind].map((key) => {
            const { count, mine } = stampState(stamps, key);
            return (
              <li key={key}>
                <StampButton
                  stampKey={key}
                  count={count}
                  pressed={mine !== null}
                  disabled={!online || busy || data === undefined}
                  onClick={() => void toggle(key)}
                />
              </li>
            );
          })}
        </ul>
      )}
      {notice && (
        <p role="alert" className="mt-2 rounded-lg bg-coral-light px-3 py-2 text-sm font-bold text-ink">
          {notice}
        </p>
      )}
    </section>
  );
}

function Comments({ recordId, online }: { recordId: string; online: boolean }) {
  const queryClient = useQueryClient();
  const { data: session } = useAppSession();
  const me = session?.user.id;
  const { data, isError } = useListComments(recordId);
  const addComment = useAddComment();
  const deleteComment = useDeleteComment();
  const inputId = useId();
  const [text, setText] = useState('');
  const [message, setMessage] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null);
  const items: CommentResponse[] = data?.status === 200 ? data.data.items : [];
  const failed = isError || (data !== undefined && data.status !== 200);
  const refresh = () => queryClient.invalidateQueries({ queryKey: getListCommentsQueryKey(recordId) });

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const body = normalizeComment(text);
    if (body === null) {
      setMessage({ kind: 'error', text: FEED_MESSAGES.commentLength });
      return;
    }
    setMessage(null);
    try {
      unwrap(await addComment.mutateAsync({ id: recordId, data: { id: crypto.randomUUID(), body } }));
      setMessage({ kind: 'ok', text: FEED_MESSAGES.commentSent });
      setText('');
      void refresh();
    } catch (e) {
      setMessage({ kind: 'error', text: sendErrorText(e, FEED_MESSAGES.commentFailed) });
    }
  }

  async function remove(commentId: string) {
    setMessage(null);
    try {
      unwrap(await deleteComment.mutateAsync({ id: commentId }));
    } catch (e) {
      setMessage({ kind: 'error', text: sendErrorText(e, FEED_MESSAGES.commentDeleteFailed) });
    } finally {
      void refresh();
    }
  }

  const disabled = !online || addComment.isPending;
  return (
    <section aria-labelledby="comments-heading" className="space-y-2">
      <h2 id="comments-heading" className="text-base font-extrabold">
        {FEED_MESSAGES.commentsHeading}
      </h2>
      {failed ? (
        <p role="alert" className="rounded-fl bg-coral-light px-4 py-3 text-sm font-bold text-ink">
          {FEED_MESSAGES.commentsLoadFailed}
        </p>
      ) : data !== undefined && items.length === 0 ? (
        <p className="fl-slab px-4 py-4 text-center text-sm font-bold text-sub-strong">{FEED_MESSAGES.commentsEmpty}</p>
      ) : data === undefined ? null : (
        <ul aria-label="コメント一覧" className="space-y-2">
          {items.map((c) => (
            <li key={c.id} className="fl-slab flex items-start gap-2 px-3 py-2">
              <div className="min-w-0 flex-1">
                <p className="text-xs font-bold text-sub-strong">
                  <span className="font-extrabold text-ink">{c.author.name}</span> {formatMonthDay(c.createdAt.slice(0, 10))}{' '}
                  {formatJstTime(c.createdAt)}
                </p>
                <p className="text-[15px] font-bold break-words">{c.body}</p>
              </div>
              {me !== undefined && c.author.id === me && (
                <button
                  type="button"
                  aria-label={`${FEED_MESSAGES.commentDelete}: ${c.body}`}
                  disabled={!online || deleteComment.isPending}
                  onClick={() => void remove(c.id)}
                  className="min-h-11 shrink-0 rounded-full border-2 border-line bg-white px-3 text-sm font-extrabold text-sub-strong outline-none focus-visible:ring-4 focus-visible:ring-teal/40 disabled:opacity-60"
                >
                  {FEED_MESSAGES.commentDelete}
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
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
    </section>
  );
}
