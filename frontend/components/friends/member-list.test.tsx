import { screen } from '@testing-library/react';
import { renderWithQuery } from '@/lib/test/fake-api';
import type { GroupDetailResponse } from '@/lib/api/generated';
import { GroupBand, MemberList } from './member-list';

vi.mock('@/lib/auth-client', () => ({ authClient: { useSession: () => ({ data: { user: { id: 'u1' } }, isPending: false }) } }));

const AVATAR = { body: 'A', hair: 1, hairColor: 'brown', shirtColor: 'teal', pantsColor: 'navy', accessory: 'none' };
const GROUP: GroupDetailResponse = {
  id: 'g1',
  name: '朝トレ部',
  members: [
    { id: 'u1', name: 'たろう', bio: '朝ランが好きです', avatar: AVATAR },
    { id: 'u2', name: 'はなこ', bio: null, avatar: AVATAR },
    { id: 'u3', name: 'じろう', avatar: AVATAR },
  ],
};

describe('MemberList（メンバーの一覧・ひとこと）', () => {
  it('ひとことがある人だけ、名前の下に出す', () => {
    renderWithQuery(<MemberList group={GROUP} />);
    expect(screen.getByText('朝ランが好きです')).toBeInTheDocument();
    expect(screen.getAllByRole('listitem')).toHaveLength(3);
    // ひとこと無し（null・未返却）の人には空の行を出さない
    expect(screen.getByText('はなこ').parentElement?.children).toHaveLength(1);
    expect(screen.getByText('じろう').parentElement?.children).toHaveLength(1);
  });

  it('自分には「あなた」を付ける', () => {
    renderWithQuery(<MemberList group={GROUP} />);
    expect(screen.getByText('あなた')).toBeInTheDocument();
  });
});

describe('GroupBand（1行の帯。D7-4）', () => {
  it('グループ名・人数・招待への入口を1行に出す', () => {
    renderWithQuery(<GroupBand group={GROUP} />);
    const band = screen.getByRole('region', { name: 'グループ' });
    expect(band).toHaveTextContent('朝トレ部');
    expect(band).toHaveTextContent('3人／5人まで');
    expect(screen.getByRole('link', { name: '招待' })).toHaveAttribute('href', '/settings/group?back=friends');
  });
  it('withInvite=false（グループの設定の中）や満員のときは、招待への入口を出さない', () => {
    const { unmount } = renderWithQuery(<GroupBand group={GROUP} withInvite={false} />);
    expect(screen.queryByRole('link', { name: '招待' })).not.toBeInTheDocument();
    unmount();
    const full = { ...GROUP, members: Array.from({ length: 5 }, (_, i) => ({ id: `m${i}`, name: `n${i}`, avatar: AVATAR })) };
    renderWithQuery(<GroupBand group={full} />);
    expect(screen.queryByRole('link', { name: '招待' })).not.toBeInTheDocument();
  });
});
