import { screen } from '@testing-library/react';
import { renderWithQuery } from '@/lib/test/fake-api';
import type { GroupDetailResponse } from '@/lib/api/generated';
import { MemberList } from './member-list';

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
