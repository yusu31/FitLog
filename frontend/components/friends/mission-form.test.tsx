import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { GroupDetailResponse } from '@/lib/api/generated';
import { calls, installFakeApi, renderWithQuery } from '@/lib/test/fake-api';
import { MissionForm } from './mission-form';

const AVATAR = { body: 'A', hair: 1, hairColor: 'brown', shirtColor: 'teal', pantsColor: 'navy', accessory: 'none' };
const GROUP: GroupDetailResponse = {
  id: 'g1',
  name: '朝トレ部',
  description: '朝6時に走る',
  background: 'yard',
  members: [{ id: 'u1', name: 'たろう', avatar: AVATAR, today: 'none' }],
};

afterEach(() => vi.unstubAllGlobals());

const lastPatch = (): unknown => {
  const fetchMock = vi.mocked(fetch);
  const call = [...fetchMock.mock.calls].reverse().find(([, init]) => init?.method === 'PATCH');
  return call && JSON.parse(String(call[1]?.body));
};

describe('MissionForm（ミッションを直す。02-9 PR 6）', () => {
  it('今の名前・説明・背景が入っている', () => {
    renderWithQuery(<MissionForm group={GROUP} />);
    expect(screen.getByLabelText('ミッション名')).toHaveValue('朝トレ部');
    expect(screen.getByLabelText('ミッションの説明')).toHaveValue('朝6時に走る');
    expect(screen.getByRole('radio', { name: '運動場' })).toBeChecked();
    expect(screen.getAllByRole('radio')).toHaveLength(4);
  });

  it('直して保存すると PATCH で3つを送り、「保存しました」を出す', async () => {
    installFakeApi({ 'PATCH /api/groups/current': { status: 200, body: { ...GROUP, name: '夜トレ部' } }, '/api/groups/current': { status: 200, body: GROUP } });
    renderWithQuery(<MissionForm group={GROUP} />);
    const user = userEvent.setup();
    const name = screen.getByLabelText('ミッション名');
    await user.clear(name);
    await user.type(name, '夜トレ部');
    await user.click(screen.getByRole('radio', { name: 'ジム' }));
    await user.click(screen.getByRole('button', { name: '保存する' }));
    expect(await screen.findByRole('status')).toHaveTextContent('保存しました');
    expect(lastPatch()).toEqual({ name: '夜トレ部', description: '朝6時に走る', background: 'gym' });
    expect(calls).toContain('PATCH /api/groups/current');
  });

  it('説明を空にすると null を送って消す', async () => {
    installFakeApi({ 'PATCH /api/groups/current': { status: 200, body: { ...GROUP, description: null } }, '/api/groups/current': { status: 200, body: GROUP } });
    renderWithQuery(<MissionForm group={GROUP} />);
    const user = userEvent.setup();
    await user.clear(screen.getByLabelText('ミッションの説明'));
    await user.click(screen.getByRole('button', { name: '保存する' }));
    await waitFor(() => expect(lastPatch()).toEqual({ name: '朝トレ部', description: null, background: 'yard' }));
  });

  it('名前が空なら送らずに知らせる', async () => {
    installFakeApi({});
    renderWithQuery(<MissionForm group={GROUP} />);
    const user = userEvent.setup();
    await user.clear(screen.getByLabelText('ミッション名'));
    await user.click(screen.getByRole('button', { name: '保存する' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('グループ名は1〜20字');
    expect(calls).toHaveLength(0);
  });

  it('保存に失敗したら、責めない言い方で知らせる', async () => {
    installFakeApi({ 'PATCH /api/groups/current': { status: 500, body: {} } });
    renderWithQuery(<MissionForm group={GROUP} />);
    await userEvent.setup().click(screen.getByRole('button', { name: '保存する' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('ミッションを保存できませんでした');
  });
});
