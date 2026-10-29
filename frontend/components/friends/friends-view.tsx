'use client';

import { useQueryClient } from '@tanstack/react-query';
import { Link2, Plus, Users } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { PageTitle } from '@/components/fitlog/app-shell';
import { ThickButton } from '@/components/fitlog/thick-button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { getGetCurrentGroupQueryKey, useCreateGroup, useGetCurrentGroup, type GroupDetailResponse } from '@/lib/api/generated';
import { authClient } from '@/lib/auth-client';
import { messageOf } from '@/lib/api/message';
import { InvitePanel } from './invite-panel';

const GROUP_NAME_MAX = 20;
export const GROUP_MEMBER_MAX = 5;

// S-20 仲間（docs/screen-design.md 4章）。グループがないときは「作る」と「招待リンクで参加する」の2つだけ。
// 足跡・週の合計・スタンプは、記録の機能（02-2 の後続）ができてから足す。
export function FriendsView() {
  const { data, isPending, isError } = useGetCurrentGroup();

  return (
    <>
      <PageTitle>なかま</PageTitle>
      {isPending ? (
        <div aria-busy="true" aria-label="読み込み中" className="mx-4 mt-3 h-40 animate-pulse rounded-xl bg-face" />
      ) : isError || !data || (data.status !== 200 && data.status !== 404) ? (
        <p role="alert" className="mx-4 mt-4 rounded-xl bg-coral-light px-4 py-3 text-sm font-bold text-ink">
          読み込めませんでした。電波の良い所で開き直してください
        </p>
      ) : data.status === 404 ? (
        <NoGroup />
      ) : (
        <GroupPanel group={data.data} />
      )}
    </>
  );
}

function NoGroup() {
  const [open, setOpen] = useState(false);
  return (
    <div className="space-y-4 px-4 pt-3">
      <section className="fl-stripes relative overflow-hidden rounded-xl bg-teal-dark [--stripe:rgb(0_0_0/0.14)] px-5 pt-4 pb-5 text-white shadow-[0_4px_0_var(--color-teal-deep)]">
        <span className="fl-tag bg-gold text-ink">TEAM</span>
        <h2 className="mt-3 text-2xl leading-snug font-black">仲間と、見せ合おう</h2>
        <p className="mt-1 text-sm leading-relaxed font-bold">
          グループは1つ・<span className="fl-num text-base">{GROUP_MEMBER_MAX}</span>人まで。記録した日やスタンプを、仲間どうしで見せ合えます。
        </p>
        {!open && (
          <ThickButton tone="gold" className="mt-4" onClick={() => setOpen(true)}>
            <Plus aria-hidden />
            グループを作る
          </ThickButton>
        )}
      </section>

      {open && <CreateGroupForm onCancel={() => setOpen(false)} />}

      <section className="fl-slab flex gap-3 px-4 py-3">
        <span className="mt-0.5 flex size-10 shrink-0 items-center justify-center rounded-full bg-teal-light text-teal-dark">
          <Link2 aria-hidden className="size-5" />
        </span>
        <div>
          <h2 className="font-extrabold">招待リンクで参加する</h2>
          <p className="mt-0.5 text-sm text-sub">仲間から届いたリンクを開くと、参加の画面が開きます。</p>
        </div>
      </section>
    </div>
  );
}

function CreateGroupForm({ onCancel }: { onCancel: () => void }) {
  const queryClient = useQueryClient();
  const createGroup = useCreateGroup();
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const name = String(new FormData(event.currentTarget).get('name') ?? '').trim();
    // 1〜20字（見た目の1文字を1と数える。API と同じ数え方）
    const length = Array.from(name).length;
    if (length < 1 || length > GROUP_NAME_MAX) {
      setError(`グループ名は1〜${GROUP_NAME_MAX}字で入れてください`);
      return;
    }
    setError(null);
    try {
      const res = await createGroup.mutateAsync({ data: { name } });
      if (res.status !== 201) {
        setError(messageOf(res.data, 'グループを作れませんでした'));
        return;
      }
      await queryClient.invalidateQueries({ queryKey: getGetCurrentGroupQueryKey() });
    } catch {
      setError('通信に失敗しました。電波の良い所でもう一度お試しください');
    }
  }

  return (
    <form onSubmit={onSubmit} className="fl-slab space-y-3 px-4 py-4" aria-label="グループを作る">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="group-name" className="font-extrabold">
          グループ名
        </Label>
        <Input
          id="group-name"
          name="name"
          maxLength={GROUP_NAME_MAX}
          autoComplete="off"
          placeholder="例: 朝トレ部"
          aria-describedby="group-name-hint"
          aria-invalid={error ? true : undefined}
          className="h-12 text-base"
        />
        <p id="group-name-hint" className="text-xs text-sub">
          1〜{GROUP_NAME_MAX}字。あとから仲間に見えます
        </p>
      </div>
      {error && (
        <p role="alert" className="rounded-lg bg-coral-light px-3 py-2 text-sm font-bold text-ink">
          {error}
        </p>
      )}
      <div className="flex gap-2">
        <ThickButton type="submit" disabled={createGroup.isPending} className="flex-1">
          {createGroup.isPending ? '作っています…' : '作る'}
        </ThickButton>
        <ThickButton tone="white" size="sm" onClick={onCancel} className="min-h-14">
          やめる
        </ThickButton>
      </div>
    </form>
  );
}

// キャラの服の色から、名前の頭文字を置く丸の色を決める（白文字が読める濃い色に寄せる）
const AVATAR_BG: Record<string, string> = {
  teal: '#0e7f83',
  navy: '#1e2a3a',
  coral: '#c23b2d',
  purple: '#6a57cf',
  gold: '#8a6200',
};

function GroupPanel({ group }: { group: GroupDetailResponse }) {
  const { data: session } = authClient.useSession();
  const me = session?.user.id;
  const count = group.members.length;

  return (
    <div className="space-y-4 px-4 pt-3">
      <section className="fl-stripes relative overflow-hidden rounded-xl bg-coral px-5 pt-4 pb-5 text-ink shadow-[0_4px_0_var(--color-coral-dark)]">
        <span className="fl-tag bg-ink text-white">TEAM</span>
        <p className="mt-3 flex items-baseline gap-1.5 leading-none">
          <span className="fl-num text-7xl">{count}</span>
          <span className="text-xl font-black">人</span>
          <span className="ml-1 text-sm font-bold">／ {GROUP_MEMBER_MAX}人まで</span>
        </p>
        <h2 className="mt-2 text-lg font-black break-all">{group.name}</h2>
      </section>

      <section aria-labelledby="members-heading">
        <h2 id="members-heading" className="flex items-center gap-1.5 pb-2 text-xs font-bold tracking-widest text-sub">
          <Users aria-hidden className="size-4" />
          メンバー
        </h2>
        <ul className="space-y-2">
          {group.members.map((m) => (
            <li key={m.id} className="fl-slab flex min-h-14 items-center gap-3 px-3 py-2">
              <span
                aria-hidden
                className="flex size-11 shrink-0 items-center justify-center rounded-full text-lg font-black text-white"
                style={{ background: AVATAR_BG[m.avatar.shirtColor] ?? AVATAR_BG.navy }}
              >
                {Array.from(m.name)[0]}
              </span>
              <span className="min-w-0 flex-1 truncate text-base font-extrabold">{m.name}</span>
              {m.id === me && <span className="fl-tag bg-gold text-ink">あなた</span>}
            </li>
          ))}
        </ul>
      </section>

      <InvitePanel full={count >= GROUP_MEMBER_MAX} />
    </div>
  );
}
