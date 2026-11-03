import { ApiError } from '@/lib/api/api-error';
import {
  AUTH_RETRY_MS,
  classifyFailure,
  PARENT_MISSING_MAX_RETRIES,
  RETRY_BACKOFF_MS,
  SendCancelled,
  sendRetryDelay,
  shouldRetrySend,
} from './retry-policy';

const api = (status: number) => new ApiError(status, {});

// 送れなかったときの扱い（design.md 7章）を、状態コードの同値分割と境界値で確かめる（T-OFF-11・12・13）
describe('classifyFailure（状態コード → 扱い）', () => {
  it.each([
    [500, 'retry'],
    [502, 'retry'],
    [599, 'retry'], // 5xx の上端
    [408, 'retry'],
    [429, 'retry'],
    [401, 'auth'],
    [404, 'parent-missing'],
    [400, 'reject'],
    [403, 'reject'],
    [409, 'reject'],
    [422, 'reject'], // 表にない 4xx は、再送しても直らないので外す
    [499, 'reject'], // 4xx の上端
    [407, 'reject'], // 408 のすぐ下は再送しない
    [410, 'reject'],
  ])('%s は %s', (status, expected) => {
    expect(classifyFailure(api(status))).toBe(expected);
  });

  it('API の応答でない例外（fetch の通信の断）は再送する', () => {
    expect(classifyFailure(new TypeError('Failed to fetch'))).toBe('retry');
  });

  it('取り除かれた送信待ちは、再送しない（外す）', () => {
    expect(classifyFailure(new SendCancelled())).toBe('reject');
  });
});

describe('shouldRetrySend（retry するか）', () => {
  it('再送する種類は、記録の作成でもセットの追加でも回数の上限なく true', () => {
    for (const kind of ['record', 'set'] as const) {
      for (const status of [500, 408, 429, 401]) expect(shouldRetrySend(kind)(10_000, api(status))).toBe(true);
      expect(shouldRetrySend(kind)(10_000, new TypeError('x'))).toBe(true);
    }
  });

  it('400・403・409 は false', () => {
    for (const status of [400, 403, 409]) expect(shouldRetrySend('set')(0, api(status))).toBe(false);
  });

  it('セットの 404 は上限の手前まで待つ（境界: 上限-1 は true、上限ちょうどは false）', () => {
    const f = shouldRetrySend('set');
    expect(f(0, api(404))).toBe(true);
    expect(f(PARENT_MISSING_MAX_RETRIES - 1, api(404))).toBe(true);
    expect(f(PARENT_MISSING_MAX_RETRIES, api(404))).toBe(false);
  });

  it('記録の作成の 404 は待たずに外す（親が無いので待つ理由がない）', () => {
    expect(shouldRetrySend('record')(0, api(404))).toBe(false);
  });
});

describe('sendRetryDelay（再送の間隔）', () => {
  it('失敗が重なるほど空け、最後の間隔のまま続く', () => {
    expect(sendRetryDelay(0, api(500))).toBe(RETRY_BACKOFF_MS[0]);
    expect(sendRetryDelay(1, api(500))).toBe(RETRY_BACKOFF_MS[1]);
    expect(sendRetryDelay(RETRY_BACKOFF_MS.length - 1, api(500))).toBe(RETRY_BACKOFF_MS[RETRY_BACKOFF_MS.length - 1]);
    expect(sendRetryDelay(1_000_000, api(500))).toBe(RETRY_BACKOFF_MS[RETRY_BACKOFF_MS.length - 1]);
  });

  it('間隔は増える一方（短くならない）', () => {
    for (let i = 1; i < RETRY_BACKOFF_MS.length; i++) expect(RETRY_BACKOFF_MS[i]).toBeGreaterThan(RETRY_BACKOFF_MS[i - 1]);
  });

  it('401 は短い一定の間隔で確かめる', () => {
    expect(sendRetryDelay(0, api(401))).toBe(AUTH_RETRY_MS);
    expect(sendRetryDelay(50, api(401))).toBe(AUTH_RETRY_MS);
  });

  it('負の回数でも先頭の間隔（範囲の外で落ちない）', () => {
    expect(sendRetryDelay(-1, api(500))).toBe(RETRY_BACKOFF_MS[0]);
  });
});
