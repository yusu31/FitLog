'use client';

import { useQueryClient } from '@tanstack/react-query';
import { Dumbbell, Footprints, MessageCircle, Moon, Video } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useId, useRef, useState, type FormEvent } from 'react';
import { cn } from 'cn';
import { buttonClass, ThickButton } from '@/components/fitlog/thick-button';
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
import { Avatar } from '@/components/fitlog/avatar';
import { FeedBand, FeedMedia, MediaBadges } from './feed-media';
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
  const stampKeys = STAMP_KEYS[item.kind];
  const hasMine = !isOwn && stampKeys.some((key) => stampState(item.stamps, key).mine !== null);
  const KindIcon = item.kind === 'run' ? Footprints : item.kind === 'rest' ? Moon : item.kind === 'post' ? Video : Dumbbell;
  return (
    <li ref={cardRef} className="fl-slab space-y-3 px-4 py-4" onClickCapture={() => setSeen(true)}>
      <div className="flex items-center gap-3">
        <Avatar avatar={item.author.avatar} size={44} />
        <div className="min-w-0 flex-1">
          <p className="truncate text-[15px] leading-tight font-extrabold">
            {item.author.name}
            <KindIcon aria-hidden data-testid="kind-icon" className="ml-2 inline size-4 shrink-0 align-[-2px] text-brand" />
          </p>
          <p className="mt-0.5 text-note font-bold text-fg-subtle">
            {formatMonthDay(item.localDate)} {item.late ? <LateTag /> : formatJstTime(item.recordedAt)}
            {item.isNew && !seen && (
              <span className="ml-1.5 rounded-full bg-coral px-1.5 py-0.5 text-note font-extrabold text-fg">{FEED_MESSAGES.newTag}</span>
            )}
          </p>
        </div>
      </div>

      {/* PR 5: 動画の上のふちに帯（種目と数字・達成のチップ）。動画には重ねない。動画があれば縦の写真の面に押した人の顔だけ重ねる */}
      <FeedBand item={item} title={title} detail={detail} thin={!item.hasVideo} />
      {item.hasVideo ? <FeedMedia item={item} isOwn={isOwn} title={title} /> : <MediaBadges item={item} />}

      {/* ひとこと（PR 4）。仲間にも見える。動画の下に出す */}
      {item.caption && <p className="text-base font-bold">{item.caption}</p>}

      {/* スタンプは横いっぱいに均等（押し損ねを減らす）。自分の記録は、もらった分だけ見せる（U11） */}
      <ul aria-label={`${item.author.name}の${title}へのスタンプ`} className={isOwn ? 'flex flex-wrap gap-1.5' : cn('grid gap-1.5', stampKeys.length === 2 ? 'grid-cols-2' : 'grid-cols-4')}>
        {stampKeys.map((key) => {
          const { count, mine } = stampStateWithPending(item.stamps, key, pending);
          if (isOwn) {
            return count > 0 ? (
              <li key={key}>
                <StampChip stampKey={key} count={count} />
              </li>
            ) : null;
          }
          return (
            <li key={key} className="flex">
              <StampButton compact fill stampKey={key} count={count} pressed={mine !== null} disabled={!online || busy} onClick={() => void toggle(key)} />
            </li>
          );
        })}
      </ul>

      {/* 「くわしく見る」「コメント」は下の行。仲間の投稿には「くわしく見る」を出さない（見る先が無い）。自分の投稿は消す入口なので残す */}
      <ul aria-label={`${item.author.name}の${title}の操作`} className="flex gap-1.5">
        {item.kind !== 'rest' && (item.kind !== 'post' || isOwn) && (
          <li className="flex-1">
            <Link
              href={
                isOwn
                  ? `/record-detail?id=${encodeURIComponent(item.id)}&from=me&back=friends`
                  : `/record-detail?id=${encodeURIComponent(item.id)}&by=${encodeURIComponent(item.author.id)}`
              }
              className={cn(buttonClass({ variant: 'secondary', size: 'sm' }), 'w-full')}
            >
              {FRIEND_MESSAGES.open}
            </Link>
          </li>
        )}
        <li className="flex-1">
          <ThickButton variant="secondary" size="sm" className="w-full" aria-expanded={openComments} onClick={() => setOpenComments((v) => !v)}>
            <MessageCircle aria-hidden className="size-4" />
            {FEED_MESSAGES.commentsOpen(item.commentCount)}
          </ThickButton>
        </li>
      </ul>

      {/* だれが押したか（A04-2）。スタンプが付いているときだけ。自分は「あなた」 */}
      {who.length > 0 && (
        <p data-testid="stamp-who" className="text-note font-bold text-fg-muted">
          {who.join(' ／ ')}
        </p>
      )}
      {stampNote && (
        <p role="status" className="text-sm font-bold text-brand">
          {stampNote}
        </p>
      )}
      {hasMine && !stampNote && <p className="text-note font-bold text-fg-muted">{FRIENDS_TEXT.stampUndoHint}</p>}
      {stampNote === FRIENDS_TEXT.stampSent && <p className="text-note font-bold text-fg-muted">{FRIENDS_TEXT.stampUndoHint}</p>}
      {!online && <p className="text-note font-bold text-fg-muted">{FEED_MESSAGES.offlineNote}</p>}
      {notice && (
        <p role="alert" className="rounded-lg bg-coral-light px-3 py-2 text-sm font-bold text-fg">
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
    <div ref={panelRef} className="space-y-2 rounded-fl bg-canvas p-3">
      <ul aria-label="定型コメント" className="flex flex-wrap gap-1.5">
        {LIGHT_QUICK_COMMENTS[item.kind].map((body) => (
          <li key={body}>
            <ThickButton
              variant="secondary" size="sm"
              disabled={disabled}
              onClick={() => void send(body)}
            >
              {body}
            </ThickButton>
          </li>
        ))}
      </ul>
      <form onSubmit={(e) => void onSubmit(e)} className="space-y-2">
        <label htmlFor={inputId} className="text-note font-bold text-fg-muted">
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
            <li key={`${i}-${body}`} className="rounded-lg bg-surface px-3 py-2 text-sm font-bold break-all">
              {body}
            </li>
          ))}
        </ul>
      )}
      {message && (
        <p
          role={message.kind === 'error' ? 'alert' : 'status'}
          className={cn('rounded-lg px-3 py-2 text-sm font-bold text-fg', message.kind === 'error' ? 'bg-coral-light' : 'bg-teal-light')}
        >
          {message.text}
        </p>
      )}
    </div>
  );
}
