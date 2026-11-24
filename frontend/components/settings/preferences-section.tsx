'use client';

import Link from 'next/link';
import { withBack } from '@/lib/back-target';
import { Segmented } from '@/components/ui/segmented';
import { Switch } from '@/components/ui/switch';
import { FIRST_TAB_OPTIONS, NOTIFY_OPTIONS, REMINDER_HOURS, savePrefs } from '@/lib/preferences';
import { WEIGHT_UNITS } from '@/lib/unit';
import { usePreferences } from '@/lib/use-preferences';

const REVISION = process.env.NEXT_PUBLIC_APP_REVISION ?? 'dev';

// 設定の「表示」（最初のタブ・単位）「通知」「動画」「規約・版」。端末に保存する（サーバーには送らない）
export function PreferencesSection() {
  const prefs = usePreferences();
  return (
    <>
      <section aria-labelledby="prefs-display" className="space-y-3">
        <h2 id="prefs-display" className="text-note font-bold tracking-widest text-fg-subtle">
          表示
        </h2>
        <div className="fl-slab space-y-3 px-4 py-3">
          <div className="space-y-2">
            <p className="font-bold">最初に開くタブ</p>
            <Segmented
              legend="最初に開くタブ"
              options={FIRST_TAB_OPTIONS}
              value={prefs.firstTab}
              onChange={(firstTab) => savePrefs({ ...prefs, firstTab })}
            />
            <p className="text-note text-fg-muted">アプリを開いたときに、最初に出る画面です</p>
          </div>
          <div className="space-y-2">
            <p className="font-bold">重さの単位</p>
            <Segmented
              legend="重さの単位"
              options={WEIGHT_UNITS.map((u) => ({ value: u, label: u }))}
              value={prefs.unit}
              onChange={(unit) => savePrefs({ ...prefs, unit })}
            />
            <p className="text-note text-fg-muted">表示だけが変わります。記録は kg のまま保存します（lb は 5lb 刻みで入れます）</p>
          </div>
        </div>
      </section>

      <section aria-labelledby="prefs-notify" className="space-y-2">
        <h2 id="prefs-notify" className="text-note font-bold tracking-widest text-fg-subtle">
          通知
        </h2>
        <ul className="fl-slab divide-y divide-line px-4">
          {NOTIFY_OPTIONS.map(({ kind, label }) => (
            <li key={kind} className="flex min-h-14 items-center justify-between gap-3">
              <span className="font-bold">{label}</span>
              <Switch label={label} checked={prefs.notify[kind]} onChange={(on) => savePrefs({ ...prefs, notify: { ...prefs.notify, [kind]: on } })} />
            </li>
          ))}
        </ul>
        <div className="fl-slab space-y-2 px-4 py-3">
          <div className="flex min-h-11 items-center justify-between gap-3">
            <span className="font-bold">記録していない日に誘う</span>
            <Switch label="記録していない日に誘う" checked={prefs.reminderOn} onChange={(on) => savePrefs({ ...prefs, reminderOn: on })} />
          </div>
          <div className="flex min-h-11 items-center justify-between gap-3">
            <label htmlFor="prefs-reminder-hour" className="font-bold">
              誘う時刻
            </label>
            <select
              id="prefs-reminder-hour"
              value={prefs.reminderHour}
              disabled={!prefs.reminderOn}
              onChange={(e) => savePrefs({ ...prefs, reminderHour: Number(e.target.value) })}
              className="h-11 rounded-fl border-2 border-line bg-surface px-3 font-bold disabled:opacity-50"
            >
              {REMINDER_HOURS.map((h) => (
                <option key={h} value={h}>
                  {h}時
                </option>
              ))}
            </select>
          </div>
          <p className="text-note text-fg-muted">スマホへの通知はこれから作ります。届くようになったとき、1日1回・この時刻に（その日に記録が無いときだけ）お誘いします</p>
        </div>
      </section>

      <section aria-labelledby="prefs-video" className="space-y-2">
        <h2 id="prefs-video" className="text-note font-bold tracking-widest text-fg-subtle">
          動画
        </h2>
        <div className="fl-slab px-4 py-3">
          <div className="flex min-h-11 items-center justify-between gap-3">
            <span className="font-bold">動画を自動で再生する</span>
            <Switch label="動画を自動で再生する" checked={prefs.autoplayVideo} onChange={(on) => savePrefs({ ...prefs, autoplayVideo: on })} />
          </div>
          <p className="mt-1 text-note text-fg-muted">オンにすると、仲間タブの動画が音なしで流れます。通信量が増えるので、はじめはオフです</p>
        </div>
      </section>

      <section aria-labelledby="prefs-about" className="space-y-2">
        <h2 id="prefs-about" className="text-note font-bold tracking-widest text-fg-subtle">
          このアプリについて
        </h2>
        <ul className="fl-slab divide-y divide-line px-4">
          <li>
            <Link href={withBack('/terms', 'settings')} className="flex min-h-14 items-center font-bold outline-none focus-visible:ring-4 focus-visible:ring-teal/40">
              利用規約
            </Link>
          </li>
          <li>
            <Link href={withBack('/privacy', 'settings')} className="flex min-h-14 items-center font-bold outline-none focus-visible:ring-4 focus-visible:ring-teal/40">
              プライバシー
            </Link>
          </li>
          <li className="flex min-h-14 items-center justify-between">
            <span className="font-bold">版</span>
            <span className="fl-num text-fg-muted">{REVISION}</span>
          </li>
        </ul>
      </section>
    </>
  );
}
