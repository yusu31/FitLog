import { render, screen } from '@testing-library/react';
import type { GroupEventResponse } from '@/lib/api/generated';
import { GroupEvents, groupEventText } from './group-events';

const ev = (over: Partial<GroupEventResponse>): GroupEventResponse => ({ kind: 'joined', at: '2026-11-26T03:00:00.000Z', actorId: 'u2', actorName: 'はなこ', ...over });

describe('GroupEvents（出来事の1行。02-9 PR 7b）', () => {
  it('文言: 加わった・ミッションを変えた。自分は「あなた」・退会した人は「だれか」', () => {
    expect(groupEventText(ev({}), 'u1')).toBe('はなこさんが仲間に加わりました');
    expect(groupEventText(ev({ actorId: 'u1', actorName: 'たろう' }), 'u1')).toBe('あなたが仲間に加わりました');
    expect(groupEventText(ev({ kind: 'mission' }), 'u1')).toBe('はなこさんがミッションを変えました');
    expect(groupEventText(ev({ kind: 'mission', actorId: null, actorName: null }), 'u1')).toBe('だれかがミッションを変えました');
  });

  it('出来事を1行ずつ出す。無いとき・古い応答（events なし）は何も出さない', () => {
    const { rerender, container } = render(<GroupEvents events={[ev({}), ev({ kind: 'mission', at: '2026-11-27T01:00:00.000Z' })]} meId="u1" />);
    expect(screen.getAllByRole('listitem')).toHaveLength(2);
    rerender(<GroupEvents events={[]} meId="u1" />);
    expect(container).toBeEmptyDOMElement();
    rerender(<GroupEvents events={undefined} meId="u1" />);
    expect(container).toBeEmptyDOMElement();
  });
});
