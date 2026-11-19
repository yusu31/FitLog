import { screen, within } from '@testing-library/react';
import { calls, installFakeApi, renderWithQuery } from '@/lib/test/fake-api';
import { FriendsToday, summarizeFriendsToday } from './friends-today';

vi.mock('@/lib/auth-client', () => ({
  authClient: { useSession: () => ({ data: { user: { id: 'u1', name: 'わたし' } }, isPending: false }) },
}));

const TODAY = '2026-11-04';
const GROUP = '/api/groups/current';
const FEED = `/api/feed?weekStart=${TODAY}`;
const ok = (body: unknown) => ({ status: 200, body });
const avatar = { body: 'a', hair: 1, hairColor: '#000', shirtColor: '#0a0', pantsColor: '#00a' };
const member = (id: string, name: string) => ({ id, name, avatar });
const group = (...members: ReturnType<typeof member>[]) => ({ id: 'g1', name: 'ジム仲間', members });
const item = (id: string, authorId: string, name: string, localDate: string, kind: 'workout' | 'run' | 'rest' = 'workout') => ({
  id,
  kind,
  recordedAt: `${localDate}T03:00:00.000Z`,
  localDate,
  author: member(authorId, name),
  exerciseNames: [],
  stamps: [],
  commentCount: 0,
});
const feed = (...items: unknown[]) => ok({ items, nextCursor: null, totals: { recordedUserCount: 0, totalVolumeKg: 0, totalDistanceM: 0 } });

describe('summarizeFriendsToday（仲間の今日の足跡の集計）', () => {
  const me = 'u1';
  it('自分と今日以外の足跡は数えない', () => {
    const items = [item('1', 'u1', 'わたし', TODAY), item('2', 'u2', '田中', '2026-11-03'), item('3', 'u3', '佐藤', TODAY)];
    expect(summarizeFriendsToday(items, me, TODAY)).toEqual({ recorded: ['佐藤'], rested: [] });
  });
  it('同じ人は1回だけ。記録とおやすみの両方があれば記録を優先する', () => {
    const items = [item('1', 'u2', '田中', TODAY, 'rest'), item('2', 'u2', '田中', TODAY, 'run'), item('3', 'u3', '佐藤', TODAY, 'rest'), item('4', 'u3', '佐藤', TODAY, 'rest')];
    expect(summarizeFriendsToday(items, me, TODAY)).toEqual({ recorded: ['田中'], rested: ['佐藤'] });
  });
  it('足跡が0件なら両方空', () => {
    expect(summarizeFriendsToday([], me, TODAY)).toEqual({ recorded: [], rested: [] });
  });
});

describe('FriendsToday（A01-8・A02-1 今日画面の上の仲間の足跡）', () => {
  it('グループが無いときは、手順と「仲間を招待する」（仲間タブへのリンク）を出す', async () => {
    installFakeApi({ [GROUP]: { status: 404, body: { message: 'なし' } } });
    renderWithQuery(<FriendsToday today={TODAY} />);
    const card = await screen.findByRole('region', { name: '仲間' });
    expect(within(card).getByText(/グループを作って/)).toBeInTheDocument();
    expect(within(card).getByRole('link', { name: '仲間を招待する' })).toHaveAttribute('href', '/friends');
    expect(calls.some((c) => c.includes('/api/feed'))).toBe(false);
  });

  it('自分1人のグループでも、招待の入口を出す', async () => {
    installFakeApi({ [GROUP]: ok(group(member('u1', 'わたし'))) });
    renderWithQuery(<FriendsToday today={TODAY} />);
    const card = await screen.findByRole('region', { name: '仲間' });
    expect(within(card).getByRole('link', { name: '仲間を招待する' })).toHaveAttribute('href', '/friends');
  });

  it('仲間が今日記録していれば、名前を1行で出し、仲間タブへのリンクになる', async () => {
    installFakeApi({
      [GROUP]: ok(group(member('u1', 'わたし'), member('u2', '田中'), member('u3', '佐藤'))),
      [FEED]: feed(item('1', 'u2', '田中', TODAY), item('2', 'u3', '佐藤', TODAY, 'rest'), item('3', 'u1', 'わたし', TODAY)),
    });
    renderWithQuery(<FriendsToday today={TODAY} />);
    const link = await screen.findByRole('link', { name: /仲間の今日/ });
    expect(link).toHaveAttribute('href', '/friends');
    expect(link).toHaveTextContent('田中 が記録');
    expect(link).toHaveTextContent('佐藤 はおやすみ');
    expect(link).not.toHaveTextContent('わたし');
  });

  it('まだだれも記録していなければ、一言（責めない）を出す', async () => {
    installFakeApi({ [GROUP]: ok(group(member('u1', 'わたし'), member('u2', '田中'))), [FEED]: feed() });
    renderWithQuery(<FriendsToday today={TODAY} />);
    expect(await screen.findByRole('link', { name: /仲間の今日/ })).toHaveTextContent('まだ 足跡は ないよ');
  });

  it('4人以上は3人まで書いて「ほか○人」にまとめる', async () => {
    installFakeApi({
      [GROUP]: ok(group(member('u1', 'わたし'), member('u2', 'A'), member('u3', 'B'), member('u4', 'C'), member('u5', 'D'))),
      [FEED]: feed(item('1', 'u2', 'A', TODAY), item('2', 'u3', 'B', TODAY), item('3', 'u4', 'C', TODAY), item('4', 'u5', 'D', TODAY)),
    });
    renderWithQuery(<FriendsToday today={TODAY} />);
    expect(await screen.findByRole('link', { name: /仲間の今日/ })).toHaveTextContent('A・B・C ほか1人 が記録');
  });

  it('グループの取得に失敗したら何も出さない（画面の他の部分を邪魔しない）', async () => {
    installFakeApi({ [GROUP]: { status: 500, body: {} } });
    const { container } = renderWithQuery(<FriendsToday today={TODAY} />);
    await vi.waitFor(() => expect(calls).toContain(`GET ${GROUP}`));
    expect(container).toBeEmptyDOMElement();
  });
});
