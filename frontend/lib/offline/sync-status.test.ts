import { ApiError } from '@/lib/api/api-error';
import { getAddSetMutationKey, getCreateRecordMutationKey, getDeleteSetMutationKey } from '@/lib/api/generated';
import { isWaiting, summarizeQueue } from './sync-status';

type M = Parameters<typeof summarizeQueue>[0][number];
const m = (key: readonly unknown[], status: string, extra: { failureCount?: number; failureReason?: unknown } = {}): M => ({
  options: { mutationKey: key },
  state: { status, ...extra },
});
const create = (status = 'pending', extra = {}) => m(getCreateRecordMutationKey(), status, extra);
const set = (status = 'pending', extra = {}) => m(getAddSetMutationKey(), status, extra);

// T-OFF-07: 件数は送信待ち（終わっていない作成系）だけを数える
describe('summarizeQueue（送信待ちの件数）', () => {
  it('0件', () => {
    expect(summarizeQueue([])).toEqual({ count: 0, retrying: false, authExpired: false });
  });

  it('1件', () => {
    expect(summarizeQueue([create()]).count).toBe(1);
  });

  it('筋トレ・ランの区別なく、記録の作成とセットの追加の合計を数える（多数）', () => {
    expect(summarizeQueue([create(), set(), set(), create()]).count).toBe(4);
  });

  it('終わったもの（成功・拒否されて外れたもの）は数えない', () => {
    expect(summarizeQueue([create('success'), set('error'), create('idle'), set()]).count).toBe(1);
  });

  it('削除（電波があるときだけの操作）は送信待ちに数えない', () => {
    expect(summarizeQueue([m(getDeleteSetMutationKey(), 'pending'), create()]).count).toBe(1);
  });

  it('送れなかったことがあるもの（failureCount>0）があれば retrying', () => {
    expect(summarizeQueue([create('pending', { failureCount: 0 })]).retrying).toBe(false);
    expect(summarizeQueue([create(), set('pending', { failureCount: 1 })]).retrying).toBe(true);
  });

  it('401 で止まっているものがあれば authExpired（500 では立たない）', () => {
    expect(summarizeQueue([create('pending', { failureCount: 1, failureReason: new ApiError(401, {}) })]).authExpired).toBe(true);
    expect(summarizeQueue([create('pending', { failureCount: 1, failureReason: new ApiError(500, {}) })]).authExpired).toBe(false);
    expect(summarizeQueue([create('pending', { failureCount: 1, failureReason: new TypeError('x') })]).authExpired).toBe(false);
  });
});

describe('isWaiting（帯を出すか）', () => {
  const base = { count: 1, retrying: false, authExpired: false };
  it('電波があって送っている最中は出さない（ちらつき防止）', () => {
    expect(isWaiting(base, true)).toBe(false);
  });
  it('電波が無ければ出す', () => {
    expect(isWaiting(base, false)).toBe(true);
  });
  it('再送待ち・401 なら電波があっても出す', () => {
    expect(isWaiting({ ...base, retrying: true }, true)).toBe(true);
    expect(isWaiting({ ...base, authExpired: true }, true)).toBe(true);
  });
  it('0件なら、電波が無くても出さない', () => {
    expect(isWaiting({ count: 0, retrying: false, authExpired: false }, false)).toBe(false);
  });
});
