import { describe, expect, it } from 'vitest';
import { resolveSession } from './use-app-session';

const live = { user: { id: 'u1', name: 'A', email: 'a@example.com' } };
const cached = { id: 'u9', name: '控え' };

describe('resolveSession（電波なしで開き直してもログイン画面へ飛ばさない）', () => {
  it('サーバーが確かめたログイン情報があれば、それを使い、控えを更新する', () => {
    expect(resolveSession({ data: live, isPending: false, error: null }, cached)).toEqual({
      session: { user: { id: 'u1', name: 'A', email: 'a@example.com' } },
      save: { id: 'u1', name: 'A' },
      clear: false,
    });
  });

  it('確認中（isPending）は未決のまま。控えは使わない', () => {
    expect(resolveSession({ data: null, isPending: true, error: null }, cached)).toEqual({
      session: null,
      save: null,
      clear: false,
    });
  });

  it('サーバーが「未ログイン」と答えた（エラーなし・データなし）なら、控えを消してログアウト扱い', () => {
    expect(resolveSession({ data: null, isPending: false, error: null }, cached)).toEqual({
      session: null,
      save: null,
      clear: true,
    });
  });

  it('401 のときも、控えを消してログアウト扱い', () => {
    expect(resolveSession({ data: null, isPending: false, error: { status: 401 } }, cached)).toEqual({
      session: null,
      save: null,
      clear: true,
    });
  });

  it.each([[0], [500], [503]])('通信失敗（status %i）で控えがあれば、控えの人としてログイン中扱い', (status) => {
    expect(resolveSession({ data: null, isPending: false, error: { status } }, cached)).toEqual({
      session: { user: { id: 'u9', name: '控え' } },
      save: null,
      clear: false,
    });
  });

  it('通信失敗でも控えが無ければ、ログアウト扱い（控えは消さない＝そもそも無い）', () => {
    expect(resolveSession({ data: null, isPending: false, error: { status: 0 } }, null)).toEqual({
      session: null,
      save: null,
      clear: false,
    });
  });
});
