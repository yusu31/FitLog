import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render } from '@testing-library/react';
import type { ReactElement } from 'react';
import { weekDates, weekStartOf } from '@/lib/shared/week';
import type { RecordDetailResponse, WeekResponse } from '@/lib/api/generated';

// 画面テスト用の偽の API。URL（パスと検索条件まで一致）ごとに応答を決める。決めていない URL は通信エラーになる。
export type Reply = { status: number; body?: unknown };
export const calls: string[] = [];

export function installFakeApi(routes: Record<string, Reply | Reply[]>) {
  calls.length = 0;
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string, init?: RequestInit) => {
      const method = init?.method ?? 'GET';
      calls.push(`${method} ${url}`);
      const route = routes[`${method} ${url}`] ?? routes[url];
      if (!route) throw new Error(`想定外の呼び出し: ${method} ${url}`);
      const { status, body } = Array.isArray(route) ? (route.length > 1 ? route.shift()! : route[0]) : route;
      // 204 は本文を持てない（Response が例外を投げる）
      return new Response(status === 204 ? null : JSON.stringify(body ?? {}), { status, headers: { 'Content-Type': 'application/json' } });
    }),
  );
}

// テストで作った QueryClient。1件ごとに送信待ちを片づける（再送待ちの送信が、次のテストの偽 API に届かないように）
const clients: QueryClient[] = [];
export function trackClient(client: QueryClient): QueryClient {
  clients.push(client);
  return client;
}
export function disposeClients(): void {
  for (const c of clients.splice(0)) c.getMutationCache().clear();
}

export function renderWithQuery(ui: ReactElement) {
  const client = trackClient(new QueryClient({ defaultOptions: { queries: { retry: false } } }));
  return render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>);
}

type Status = 'rec' | 'rest' | 'none';
// date を含む週の応答。statuses は {日付: 状態}。書かれていない日は none
export const weekOf = (date: string, statuses: Record<string, Status> = {}): WeekResponse => {
  const weekStart = weekStartOf(date);
  return { weekStart, days: weekDates(weekStart).map((d) => ({ date: d, status: statuses[d] ?? 'none' })) };
};

type Ex = { id: string; name: string; sets: [number, number][] };
// 筋トレの記録（種目ごとのセット [重量, 回数]）。localDate の正午（日本時間）に記録した扱い
export const workout = (id: string, localDate: string, exercises: Ex[]): RecordDetailResponse => ({
  id,
  kind: 'workout',
  recordedAt: `${localDate}T03:00:00.000Z`,
  localDate,
  exercises: exercises.map((e) => ({
    exerciseId: e.id,
    name: e.name,
    sets: e.sets.map(([weightKg, reps], i) => ({ id: `${id}-${e.id}-${i + 1}`, setNo: i + 1, weightKg, reps })),
  })),
});

export const restRecord = (id: string, localDate: string): RecordDetailResponse => ({
  id,
  kind: 'rest',
  recordedAt: `${localDate}T03:00:00.000Z`,
  localDate,
});

export const runRecord = (id: string, localDate: string, distanceM: number, durationS: number): RecordDetailResponse => ({
  id,
  kind: 'run',
  recordedAt: `${localDate}T03:00:00.000Z`,
  localDate,
  run: { distanceM, durationS },
});
