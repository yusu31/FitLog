import { badgeText, describeNotification, formatNotificationTime, notificationHref } from './notifications';

const actor = { id: 'u2', name: 'はなこ', avatar: { body: 'A', hair: 1, hairColor: 'brown', shirtColor: 'coral', pantsColor: 'navy' } };

describe('通知の文言とリンク（D7-3）', () => {
  it.each([
    [{ kind: 'stamp', recordKind: 'workout', stampKey: 'nice' }, 'はなこさんが「ナイス」を送りました'],
    [{ kind: 'comment', recordKind: 'run', stampKey: null }, 'はなこさんがコメントしました'],
    [{ kind: 'friend_record', recordKind: 'run', stampKey: null }, 'はなこさんがランを記録しました'],
    [{ kind: 'friend_record', recordKind: 'workout', stampKey: null }, 'はなこさんが筋トレを記録しました'],
    [{ kind: 'friend_record', recordKind: 'rest', stampKey: null }, 'はなこさんがおやすみを記録しました'],
    [{ kind: 'friend_joined', recordKind: null, stampKey: null }, 'はなこさんが仲間に加わりました'],
  ] as const)('%o → 「%s」', (n, text) => {
    expect(describeNotification({ ...n, actor })).toBe(text);
  });

  it('リンク先: 仲間が加わった→仲間タブ／自分の記録へのスタンプ・コメント→from=me／仲間の記録→from なし', () => {
    expect(notificationHref({ kind: 'friend_joined', recordId: null })).toBe('/friends');
    expect(notificationHref({ kind: 'stamp', recordId: 'r 1' })).toBe('/record-detail?id=r%201&from=me');
    expect(notificationHref({ kind: 'comment', recordId: 'r1' })).toBe('/record-detail?id=r1&from=me');
    expect(notificationHref({ kind: 'friend_record', recordId: 'r1' })).toBe('/record-detail?id=r1');
  });

  it('ベルの数字は9を超えたら「9+」', () => {
    expect([1, 9, 10, 30].map(badgeText)).toEqual(['1', '9', '9+', '9+']);
  });

  it('時刻は日本時間の「月/日 時:分」（端末のタイムゾーンを使わない）', () => {
    expect(formatNotificationTime('2026-11-21T03:05:00.000Z')).toBe('11/21 12:05');
    expect(formatNotificationTime('2026-11-21T16:00:00.000Z')).toBe('11/22 1:00'); // 日本では翌日
  });
});
