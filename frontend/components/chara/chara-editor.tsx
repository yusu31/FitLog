'use client';

import { useQueryClient } from '@tanstack/react-query';
import { ChevronLeft } from 'lucide-react';
import Link from 'next/link';
import { useState, type KeyboardEvent } from 'react';
import { Chara } from '@/components/fitlog/chara';
import { FullScreen } from '@/components/fitlog/full-screen';
import { POSES, type PoseKey } from '@/components/fitlog/sprite';
import { ThickButton } from '@/components/fitlog/thick-button';
import { getGetMyAvatarQueryKey, useGetMyAvatar, useSetMyAvatar } from '@/lib/api/generated';
import { messageOf } from '@/lib/api/message';
import {
  ACCESSORY_OPTIONS,
  BODY_OPTIONS,
  HAIR_COLORS,
  HAIR_OPTIONS,
  PANTS_COLORS,
  SHIRT_COLORS,
  normalizeChara,
  type CharaSettings,
} from '@/lib/chara';
import { CHARA_MESSAGES } from '@/lib/chara-messages';
import { cn } from '@/lib/utils';
import { useRequireSession } from '@/lib/use-require-session';

const TABS = ['body', 'hair', 'shirt', 'pants', 'accessory', 'pose'] as const;
type Tab = (typeof TABS)[number];

// 選択肢の並び（文字のボタン）。どれか1つが選ばれている（aria-checked）
function ChoiceRow<T extends string | number>({ legend, options, value, onChange }: { legend: string; options: readonly { value: T; label: string }[]; value: T; onChange: (v: T) => void }) {
  return (
    <div role="radiogroup" aria-label={legend} className="flex flex-wrap gap-2">
      {options.map((o) => {
        const checked = value === o.value;
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={checked}
            onClick={() => onChange(o.value)}
            className={cn('min-h-11 rounded-fl px-3 text-sm font-bold outline-none focus-visible:ring-4 focus-visible:ring-teal/40', checked ? 'bg-teal-dark text-white' : 'bg-teal-light text-fg')}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

// 色の丸（Duolingo 型）。色の名前は読み上げ用の aria-label。選んでいる丸には太い縁
function ColorRow<T extends string>({ legend, options, value, onChange }: { legend: string; options: readonly { value: T; label: string; rgb: string }[]; value: T; onChange: (v: T) => void }) {
  return (
    <div role="radiogroup" aria-label={legend} className="flex flex-wrap gap-3">
      {options.map((o) => {
        const checked = value === o.value;
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={checked}
            aria-label={o.label}
            onClick={() => onChange(o.value)}
            className="flex size-11 items-center justify-center rounded-full outline-none focus-visible:ring-4 focus-visible:ring-teal/40"
          >
            <span className={cn('block size-9 rounded-full border-2', checked ? 'border-fg ring-2 ring-teal' : 'border-white shadow')} style={{ backgroundColor: o.rgb }} />
          </button>
        );
      })}
    </div>
  );
}

// 編集の本体。見本（上）に、選んだ内容がすぐ映る。保存するまでは端末の中だけの変更
export function CharaEditor({ initial }: { initial: CharaSettings }) {
  const queryClient = useQueryClient();
  const save = useSetMyAvatar();
  const [draft, setDraft] = useState<CharaSettings>(initial);
  const [tab, setTab] = useState<Tab>('body');
  const [pose, setPose] = useState<PoseKey>('idle');
  const [notice, setNotice] = useState<{ ok: boolean; text: string } | null>(null);
  const set = <K extends keyof CharaSettings>(key: K, value: CharaSettings[K]) => {
    setNotice(null);
    setDraft((d) => ({ ...d, [key]: value }));
  };

  // タブは左右の矢印キーで移れる（role=tablist の約束）
  function onTabKey(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    const next = event.key === 'ArrowRight' ? index + 1 : event.key === 'ArrowLeft' ? index - 1 : null;
    if (next === null) return;
    event.preventDefault();
    const target = TABS[(next + TABS.length) % TABS.length];
    setTab(target);
    document.getElementById(`chara-tab-${target}`)?.focus();
  }

  async function onSave() {
    setNotice(null);
    try {
      const res = await save.mutateAsync({ data: draft });
      if (res.status === 200) {
        await queryClient.invalidateQueries({ queryKey: getGetMyAvatarQueryKey() });
        setNotice({ ok: true, text: CHARA_MESSAGES.saved });
      } else {
        setNotice({ ok: false, text: messageOf(res.data, CHARA_MESSAGES.saveFailed) });
      }
    } catch {
      setNotice({ ok: false, text: CHARA_MESSAGES.saveFailed });
    }
  }

  return (
    <div className="space-y-4 px-4 pt-3 pb-10">
      <div data-testid="chara-stage" className="fl-slab flex items-center justify-center bg-teal-light/40 py-4">
        <Chara settings={draft} pose={pose} size={192} />
      </div>

      <div role="tablist" aria-label={CHARA_MESSAGES.tabsLabel} className="flex gap-1 overflow-x-auto">
        {TABS.map((t, i) => (
          <button
            key={t}
            id={`chara-tab-${t}`}
            type="button"
            role="tab"
            aria-selected={tab === t}
            aria-controls="chara-panel"
            tabIndex={tab === t ? 0 : -1}
            onClick={() => setTab(t)}
            onKeyDown={(e) => onTabKey(e, i)}
            className={cn('min-h-11 shrink-0 rounded-fl px-3 text-sm font-extrabold outline-none focus-visible:ring-4 focus-visible:ring-teal/40', tab === t ? 'bg-brand text-white' : 'bg-surface text-fg-muted')}
          >
            {CHARA_MESSAGES.tabs[t]}
          </button>
        ))}
      </div>

      <div id="chara-panel" role="tabpanel" aria-labelledby={`chara-tab-${tab}`} className="fl-slab space-y-4 px-4 py-4">
        {tab === 'body' && <ChoiceRow legend={CHARA_MESSAGES.tabs.body} options={BODY_OPTIONS} value={draft.body} onChange={(v) => set('body', v)} />}
        {tab === 'hair' && (
          <>
            <ChoiceRow legend={CHARA_MESSAGES.hairStyle} options={HAIR_OPTIONS} value={draft.hair} onChange={(v) => set('hair', v)} />
            <ColorRow legend={CHARA_MESSAGES.hairColor} options={HAIR_COLORS} value={draft.hairColor} onChange={(v) => set('hairColor', v)} />
          </>
        )}
        {tab === 'shirt' && <ColorRow legend={CHARA_MESSAGES.shirtColor} options={SHIRT_COLORS} value={draft.shirtColor} onChange={(v) => set('shirtColor', v)} />}
        {tab === 'pants' && <ColorRow legend={CHARA_MESSAGES.pantsColor} options={PANTS_COLORS} value={draft.pantsColor} onChange={(v) => set('pantsColor', v)} />}
        {tab === 'accessory' && <ChoiceRow legend={CHARA_MESSAGES.tabs.accessory} options={ACCESSORY_OPTIONS} value={draft.accessory} onChange={(v) => set('accessory', v)} />}
        {tab === 'pose' && (
          <>
            <ChoiceRow legend={CHARA_MESSAGES.tabs.pose} options={(Object.keys(POSES) as PoseKey[]).map((k) => ({ value: k, label: POSES[k].name }))} value={pose} onChange={setPose} />
            <p className="text-note text-fg-muted">{CHARA_MESSAGES.poseHint}</p>
          </>
        )}
      </div>

      <ThickButton type="button" size="sm" className="w-full" disabled={save.isPending} onClick={onSave}>
        {save.isPending ? CHARA_MESSAGES.saving : CHARA_MESSAGES.save}
      </ThickButton>
      {notice && (
        <p role={notice.ok ? 'status' : 'alert'} className="text-sm font-bold text-fg">
          {notice.text}
        </p>
      )}
    </div>
  );
}

// キャラ編集の画面（F-32）。自分タブの「キャラを変える」から来る
export function CharaPage() {
  useRequireSession();
  const avatar = useGetMyAvatar();
  const mine = avatar.data?.status === 200 ? normalizeChara(avatar.data.data) : null;
  return (
    <FullScreen>
      <header className="flex items-center gap-1 px-2 pt-3">
        <Link href="/me" aria-label={CHARA_MESSAGES.back} className="flex size-11 items-center justify-center rounded-fl text-fg-muted outline-none focus-visible:ring-4 focus-visible:ring-teal/40">
          <ChevronLeft aria-hidden className="size-7" />
        </Link>
        <h1 className="text-page-title font-extrabold">{CHARA_MESSAGES.title}</h1>
      </header>
      {mine ? (
        <CharaEditor initial={mine} />
      ) : (
        <p role={avatar.isError || (avatar.data && avatar.data.status !== 200) ? 'alert' : 'status'} className="px-4 pt-6 text-sm text-fg-muted">
          {avatar.isError || (avatar.data && avatar.data.status !== 200) ? CHARA_MESSAGES.loadFailed : CHARA_MESSAGES.loading}
        </p>
      )}
    </FullScreen>
  );
}
