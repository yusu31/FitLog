// 端末ごとの設定（通知の種類・誘う時刻・動画の自動再生）。見た目（theme.ts）と同じく localStorage に置く。
// サーバーには送らない。壊れた値・保存できない環境では既定値で動く（fail-open）
export type NotifyKind = 'stamp' | 'comment' | 'friend_record' | 'friend_joined';

export const NOTIFY_OPTIONS: readonly { kind: NotifyKind; label: string }[] = [
  { kind: 'stamp', label: 'スタンプをもらったとき' },
  { kind: 'comment', label: 'コメントをもらったとき' },
  { kind: 'friend_record', label: '仲間が記録したとき' },
  { kind: 'friend_joined', label: '仲間が加わったとき' },
];

export type Preferences = {
  autoplayVideo: boolean;
  notify: Record<NotifyKind, boolean>;
  // 誘う通知（その日に記録が無いときだけ・1日1回）。Web Push は別の PR で作るので、いまは時刻の保存だけ
  reminderOn: boolean;
  reminderHour: number;
};

export const PREFS_KEY = 'fitlog-prefs';
export const REMINDER_DEFAULT_HOUR = 19;
// 誘う時刻の選べる範囲（朝6時〜夜22時）
export const REMINDER_HOURS = Array.from({ length: 17 }, (_, i) => i + 6);

export const DEFAULT_PREFS: Preferences = {
  autoplayVideo: false,
  notify: { stamp: true, comment: true, friend_record: true, friend_joined: true },
  reminderOn: true,
  reminderHour: REMINDER_DEFAULT_HOUR,
};

// 保存された文字を設定にする。足りない項目・型の違う項目は既定値のまま
export function parsePrefs(raw: string | null | undefined): Preferences {
  if (!raw) return DEFAULT_PREFS;
  try {
    const v = JSON.parse(raw) as Record<string, unknown>;
    const notifyRaw = (v.notify ?? {}) as Record<string, unknown>;
    const notify = { ...DEFAULT_PREFS.notify };
    for (const { kind } of NOTIFY_OPTIONS) if (typeof notifyRaw[kind] === 'boolean') notify[kind] = notifyRaw[kind];
    const hour = v.reminderHour;
    return {
      autoplayVideo: typeof v.autoplayVideo === 'boolean' ? v.autoplayVideo : DEFAULT_PREFS.autoplayVideo,
      notify,
      reminderOn: typeof v.reminderOn === 'boolean' ? v.reminderOn : DEFAULT_PREFS.reminderOn,
      reminderHour: typeof hour === 'number' && REMINDER_HOURS.includes(hour) ? hour : DEFAULT_PREFS.reminderHour,
    };
  } catch {
    return DEFAULT_PREFS;
  }
}

// useSyncExternalStore 用。保存された文字が同じなら同じオブジェクトを返す（描画のたびに作り直さない）
let cachedRaw: string | null | undefined;
let cached: Preferences = DEFAULT_PREFS;
export function readPrefs(): Preferences {
  let raw: string | null = null;
  try {
    raw = localStorage.getItem(PREFS_KEY);
  } catch {
    raw = null;
  }
  if (raw !== cachedRaw) {
    cachedRaw = raw;
    cached = parsePrefs(raw);
  }
  return cached;
}

const listeners = new Set<() => void>();
export const subscribePrefs = (fn: () => void) => {
  listeners.add(fn);
  window.addEventListener('storage', fn);
  return () => {
    listeners.delete(fn);
    window.removeEventListener('storage', fn);
  };
};

export function savePrefs(next: Preferences): void {
  try {
    localStorage.setItem(PREFS_KEY, JSON.stringify(next));
  } catch {
    // 保存できなくても、この画面の間は切り替わる
  }
  cachedRaw = undefined;
  listeners.forEach((fn) => fn());
}

export const SERVER_PREFS = DEFAULT_PREFS;
