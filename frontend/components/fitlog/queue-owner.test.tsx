import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { QueueOwner } from './queue-owner';

type S = { data: { user: { id: string; name: string } } | null; isPending: boolean };
let session: S = { data: { user: { id: 'u1', name: 'A' } }, isPending: false };
vi.mock('@/lib/use-app-session', () => ({ useAppSession: () => session }));
vi.mock('@/lib/offline/resume', () => ({ setQueueOwner: vi.fn() }));

const A: S = { data: { user: { id: 'u1', name: 'A' } }, isPending: false };
const B: S = { data: { user: { id: 'u2', name: 'B' } }, isPending: false };
const OUT: S = { data: null, isPending: false };
const PENDING: S = { data: A.data, isPending: true };

let client: QueryClient;
const ui = () => (
  <QueryClientProvider client={client}>
    <QueueOwner />
  </QueryClientProvider>
);
const has = (key: unknown[]) => client.getQueryData(key) !== undefined;

beforeEach(() => {
  client = new QueryClient();
  session = A;
  client.setQueryData(['/api/feed'], { status: 200 }); // 閲覧キャッシュ（端末に残す対象）
  client.setQueryData(['/api/groups/current'], { status: 200 }); // 閲覧キャッシュの対象外
});
afterEach(cleanup);

describe('QueueOwner: 閲覧キャッシュの消去（S4。前の人の記録を次の人に見せない）', () => {
  it('同じ人のまま再描画しても消さない', () => {
    const { rerender } = render(ui());
    rerender(ui());
    expect(has(['/api/feed'])).toBe(true);
  });

  it('確認中（isPending）は消さない。確認が済んで同じ人だったときも消さない', () => {
    session = PENDING;
    const { rerender } = render(ui());
    session = A;
    rerender(ui());
    expect(has(['/api/feed'])).toBe(true);
  });

  it('ログアウト（ログイン中 → 未ログイン）で、閲覧用の結果を消す。ほかは消さない', () => {
    const { rerender } = render(ui());
    session = OUT;
    rerender(ui());
    expect(has(['/api/feed'])).toBe(false);
    expect(has(['/api/groups/current'])).toBe(true);
  });

  it('別の人に変わったら消す', () => {
    const { rerender } = render(ui());
    session = B;
    rerender(ui());
    expect(has(['/api/feed'])).toBe(false);
  });

  it('最初から未ログインなら、何も消さない（境界: 変化なし）', () => {
    session = OUT;
    render(ui());
    expect(has(['/api/feed'])).toBe(true);
  });
});
