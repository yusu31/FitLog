'use client';

import { useQueryClient } from '@tanstack/react-query';
import { Dumbbell, Footprints, MessageCircle, Moon } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useId, useRef, useState, type FormEvent } from 'react';
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
  STAMP_KEYS,
  describeItem,
  normalizeComment,
  stampState,
  stampStateWithPending,
  stampWhoLines,
  type PendingStamp,
  type StampKey,
} from '@/lib/feed';
import { LateTag } from '@/components/fitlog/late-tag';
import { formatJstTime, formatMonthDay } from '@/lib/format';
import { FEED_MESSAGES, FRIEND_MESSAGES } from '@/lib/messages';
import { useOnline } from '@/lib/use-browser-state';
import { useAppSession } from '@/lib/use-app-session';
import { FRIENDS_TEXT, LIGHT_QUICK_COMMENTS } from './friends-text';
import { AVATAR_BG } from './member-list';
import { StampButton, StampChip } from './stamp-button';

// 「新着」の札を外すまでの時間。カードが画面に見えてから、この時間そのまま見えていたら「読んだ」とみなす（通り過ぎただけでは外さない。A04-8）
const SEEN_AFTER_MS = 1500;

// 足跡の1件。スタンプ（付け外し）とコメント（定型4つ／休みは2つ＋自由入力 50字まで）。
// 付け外しは電波があるときだけ（F-30）。送ったあとは足跡を取り直すので、数と「自分が付けた」はサーバーの値になる。
// コメントの本文を読む画面は記録の詳細（S-21）。ここでは件数だけ出す
export function FeedCard({ item }: { item: FeedItem }) {
  const online = useOnline();
  const { data: session } = useAppSession();
  const isOwn = session?.user.id === item.author.id;
  const queryClient = useQueryClient();
  const addReaction = useAddReaction();
  const deleteReaction = useDeleteReaction();
  const [openComments, setOpenComments] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [stampNote, setStampNote] = useState<string | null>(null);
  // 「新着」の札は、そのカードを触ったら外す。触らなくても、画面に見えて少し経てば外す（A04-8）。サーバー側は、見たあと次に開いたときに外れる
  const [seen, setSeen] = useState(false);
  const cardRef = useRef<HTMLLIElement>(null);
  useEffect(() => {
    const el = cardRef.current;
    if (!item.isNew || seen || !el || typeof IntersectionObserver === 'undefined') return;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const observer = new IntersectionObserver(
      ([entry]) => {
        clearTimeout(timer);
        if (entry?.isIntersecting) timer = setTimeout(() => setSeen(true), SEEN_AFTER_MS);
      },
      { threshold: 0.6 },
    );
    observer.observe(el);
    return () => {
      observer.disconnect();
      clearTimeout(timer);
    };
  }, [item.isNew, seen]);
  const [pending, setPending] = useState<PendingStamp | null>(null);
  const { title, detail } = describeItem(item);
  const busy = addReaction.isPending || deleteReaction.isPending;

  const refresh = () => queryClient.invalidateQueries({ queryKey: getGetFeedQueryKey() });

  async function toggle(key: StampKey) {
    const { mine } = stampState(item.stamps, key);
    setNotice(null);
    setStampNote(null);
    setPending({ key, add: mine === null, base: item.stamps });
    try {
      if (mine) unwrap(await deleteReaction.mutateAsync({ id: item.id, reactionId: mine }));
      else unwrap(await addReaction.mutateAsync({ id: item.id, data: { id: crypto.randomUUID(), stampKey: key } }));
      setStampNote(mine ? FRIENDS_TEXT.stampCancelled : FRIENDS_TEXT.stampSent);
    } catch (e) {
      setPending(null);
      setNotice(sendErrorText(e, FEED_MESSAGES.stampFailed));
    } finally {
      void refresh();
    }
  }

  const who = stampWhoLines(item.stamps, session?.user.id);
  const hasMine = !isOwn && STAMP_KEYS[item.kind].some((key) => stampState(item.stamps, key).mine !== null);
  const KindIcon = item.kind === 'run' ? Footprints : item.kind === 'rest' ? Moon : Dumbbell;
  return (
    <li ref={cardRef} className="fl-slab space-y-3 px-4 py-4" onClickCapture={() => setSeen(true)}>
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
            <span className="ml-2 inline-flex items-center gap-1 text-sub-strong">
              <KindIcon aria-hidden data-testid="kind-icon" className="size-4 shrink-0 text-teal-dark" />
              {title}
            </span>
            {detail && <span className="ml-1.5 text-sm text-sub-strong">{detail}</span>}
          </p>
          <p className="mt-0.5 text-note font-bold text-sub">
            {formatMonthDay(item.localDate)} {item.late ? <LateTag /> : formatJstTime(item.recordedAt)}
            {item.isNew && !seen && (
              <span className="ml-1.5 rounded-full bg-coral px-1.5 py-0.5 text-note font-extrabold text-ink">{FEED_MESSAGES.newTag}</span>
            )}
          </p>
        </div>
      </div>

      <ul aria-label={`${item.author.name}の${title}へのスタンプ`} className="flex flex-wrap gap-1.5">
        {STAMP_KEYS[item.kind].map((key) => {
          const { count, mine } = stampStateWithPending(item.stamps, key, pending);
          // 自分の足跡には自分でスタンプを付けない（U11）。もらった分だけ見せる
          if (isOwn) {
            return count > 0 ? (
              <li key={key}>
                <StampChip stampKey={key} count={count} />
              </li>
            ) : null;
          }
          return (
            <li key={key}>
              <StampButton compact stampKey={key} count={count} pressed={mine !== null} disabled={!online || busy} onClick={() => void toggle(key)} />
            </li>
          );
        })}
        {item.kind !== 'rest' && (
          <li>
            <Link
              href={`/record-detail?id=${encodeURIComponent(item.id)}&by=${encodeURIComponent(item.author.id)}`}
              className="flex min-h-11 items-center rounded-full border-2 border-line bg-white px-3 text-sm font-extrabold text-sub-strong outline-none focus-visible:ring-4 focus-visible:ring-teal/40"
            >
              {FRIEND_MESSAGES.open}
            </Link>
          </li>
        )}
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

      {/* だれが押したか（A04-2）。スタンプが付いているときだけ。自分は「あなた」 */}
      {who.length > 0 && (
        <p data-testid="stamp-who" className="text-note font-bold text-sub-strong">
          {who.join(' ／ ')}
        </p>
      )}
      {stampNote && (
        <p role="status" className="text-sm font-bold text-teal-deep">
          {stampNote}
        </p>
      )}
      {hasMine && !stampNote && <p className="text-note font-bold text-sub-strong">{FRIENDS_TEXT.stampUndoHint}</p>}
      {stampNote === FRIENDS_TEXT.stampSent && <p className="text-note font-bold text-sub-strong">{FRIENDS_TEXT.stampUndoHint}</p>}
      {!online && <p className="text-note font-bold text-sub-strong">{FEED_MESSAGES.offlineNote}</p>}
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
  const [sent, setSent] = useState<string[]>([]);
  const panelRef = useRef<HTMLDivElement>(null);

  // 開いたら、そのコメント欄まで滑らかに動かす（画面がガクッと跳ばないように。A04-4）
  useEffect(() => {
    const calm = typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    panelRef.current?.scrollIntoView?.({ behavior: calm ? 'auto' : 'smooth', block: 'nearest' });
  }, []);

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
      setSent((list) => [...list, body]);
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
    <div ref={panelRef} className="space-y-2 rounded-fl bg-face p-3">
      <ul aria-label="定型コメント" className="flex flex-wrap gap-1.5">
        {LIGHT_QUICK_COMMENTS[item.kind].map((body) => (
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
        <label htmlFor={inputId} className="text-note font-bold text-sub-strong">
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
      {sent.length > 0 && (
        <ul aria-label={FRIENDS_TEXT.sentCommentsLabel} className="space-y-1">
          {sent.map((body, i) => (
            <li key={`${i}-${body}`} className="rounded-lg bg-white px-3 py-2 text-sm font-bold break-all">
              {body}
            </li>
          ))}
        </ul>
      )}
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
