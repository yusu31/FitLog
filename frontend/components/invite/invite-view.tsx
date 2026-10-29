'use client';

import { useQueryClient } from '@tanstack/react-query';
import { Link2, LogIn, UserPlus, Users } from 'lucide-react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useState, type ReactNode } from 'react';
import { ThickButton } from '@/components/fitlog/thick-button';
import { getGetCurrentGroupQueryKey, useAcceptInvitation, useGetInvitation } from '@/lib/api/generated';
import { messageOf } from '@/lib/api/message';
import { authClient } from '@/lib/auth-client';
import { withNext } from '@/lib/next-path';

// S-03 招待を受ける（docs/screen-design.md 1章）。グループ名と今の人数はログイン前でも見える。
// 参加はログイン後。未ログインなら「登録して参加」「ログインして参加」を出し、終わったらこの画面へ戻す（?next=）
export function InviteView() {
  const token = useSearchParams().get('token') ?? '';
  // 招待リンクの値は base64url（URL にそのまま載る文字）。それ以外の文字が来ても、パスを壊さないように包む
  const encoded = encodeURIComponent(token);
  const preview = useGetInvitation(encoded, { query: { enabled: token.length > 0, retry: false } });

  if (!token) return <Problem title="リンクが正しくありません">届いたリンクを、もう一度開いてください。</Problem>;
  if (preview.isPending) {
    return (
      <Frame>
        <div aria-busy="true" aria-label="読み込み中" className="h-40 animate-pulse rounded-fl bg-face" />
      </Frame>
    );
  }
  if (preview.isError || !preview.data) {
    return <Problem title="読み込めませんでした">電波の良い所で、もう一度開いてください。</Problem>;
  }
  if (preview.data.status === 410) {
    return <Problem title="期限が切れています">招待リンクは7日間だけ使えます。仲間に、新しいリンクをもらってください。</Problem>;
  }
  if (preview.data.status !== 200) {
    return (
      <Problem title="このリンクは使えません">取り消されたか、まちがっている可能性があります。仲間に、新しいリンクをもらってください。</Problem>
    );
  }

  const { groupName, memberCount, memberMax } = preview.data.data;
  const full = memberCount >= memberMax;
  return (
    <Frame>
      <section className="fl-stripes relative overflow-hidden rounded-fl bg-coral px-[18px] pt-3.5 pb-4 text-ink shadow-[0_4px_0_var(--color-coral-dark)]">
        <span className="fl-tag bg-gold text-ink">INVITE</span>
        <p className="mt-3 text-sm font-bold">グループに招待されています</p>
        <h1 className="mt-1 text-2xl font-extrabold break-all">{groupName}</h1>
        <p className="mt-2 flex items-baseline gap-1.5 leading-none">
          <span className="fl-num text-5xl">{memberCount}</span>
          <span className="text-lg font-extrabold">人</span>
          <span className="ml-1 text-sm font-bold">／ {memberMax}人まで</span>
        </p>
      </section>
      {full ? (
        <p role="status" className="fl-slab px-4 py-3 text-sm font-bold">
          このグループは満員です（{memberMax}人まで）。仲間に相談してください。
        </p>
      ) : (
        <JoinActions token={token} encoded={encoded} />
      )}
    </Frame>
  );
}

function JoinActions({ token, encoded }: { token: string; encoded: string }) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { data: session, isPending } = authClient.useSession();
  const accept = useAcceptInvitation();
  const [error, setError] = useState<string | null>(null);
  const next = `/invite?token=${encodeURIComponent(token)}`;

  if (isPending) return <div aria-busy="true" aria-label="読み込み中" className="h-14 animate-pulse rounded-fl bg-face" />;

  if (!session) {
    return (
      <div className="space-y-3">
        <p className="text-sm text-sub">参加するには、登録かログインが必要です。終わると、この画面に戻ります。</p>
        <Link
          href={withNext('/signup', next)}
          className="fl-thick flex min-h-14 items-center justify-center gap-2 rounded-fl bg-teal-dark text-lg font-extrabold tracking-wider text-white [--thick:var(--color-teal-deep)] [&_svg]:size-5"
        >
          <UserPlus aria-hidden />
          登録して参加
        </Link>
        <Link
          href={withNext('/login', next)}
          className="fl-thick flex min-h-14 items-center justify-center gap-2 rounded-fl border-2 border-teal-light bg-white text-lg font-extrabold tracking-wider text-teal-dark [--thick:#b8e3e4] [&_svg]:size-5"
        >
          <LogIn aria-hidden />
          ログインして参加
        </Link>
      </div>
    );
  }

  async function onJoin() {
    setError(null);
    try {
      const res = await accept.mutateAsync({ token: encoded });
      if (res.status !== 200) {
        setError(messageOf(res.data, '参加できませんでした'));
        return;
      }
      await queryClient.invalidateQueries({ queryKey: getGetCurrentGroupQueryKey() });
      router.replace('/friends');
    } catch {
      setError('通信に失敗しました。電波の良い所でもう一度お試しください');
    }
  }

  return (
    <div className="space-y-3">
      <p className="text-sm text-sub">
        <span className="font-extrabold text-ink">{session.user.name}</span> さんとして参加します。1人が入れるグループは1つです。
      </p>
      <ThickButton onClick={onJoin} disabled={accept.isPending}>
        <Users aria-hidden />
        {accept.isPending ? '参加しています…' : '参加する'}
      </ThickButton>
      {error && (
        <p role="alert" className="rounded-lg bg-coral-light px-3 py-2 text-sm font-bold text-ink">
          {error}
        </p>
      )}
    </div>
  );
}

// タブの無い全画面（docs/screen-design.md 1章「タブの無い画面は全画面で表示する」）
function Frame({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-dvh bg-[#e9ecef]">
      <main className="mx-auto flex min-h-dvh max-w-[430px] flex-col gap-4 bg-white px-4 pt-8 pb-10">{children}</main>
    </div>
  );
}

function Problem({ title, children }: { title: string; children: ReactNode }) {
  return (
    <Frame>
      <section className="fl-slab flex gap-3 px-4 py-4">
        <span className="mt-0.5 flex size-10 shrink-0 items-center justify-center rounded-full bg-coral-light text-coral-strong">
          <Link2 aria-hidden className="size-5" />
        </span>
        <div>
          <h1 className="text-lg font-extrabold">{title}</h1>
          <p className="mt-1 text-sm text-sub">{children}</p>
        </div>
      </section>
      <Link href="/friends" className="text-center text-sm font-extrabold text-teal-dark underline underline-offset-4">
        仲間タブへ
      </Link>
    </Frame>
  );
}
