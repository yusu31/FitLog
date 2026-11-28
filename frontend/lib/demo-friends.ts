import type { FeedItem } from '@/lib/api/generated';

// 仲間がいない人に見せる「見本の仲間」（02-9 ⑭・Issue #475）。画面だけのデータで、DB にも API にも作らない。
// 本物の仲間として数えない（最大5人の人数に入らない）。順位っぽい並び・連続日数・目標未達は作らない。休んだ人も責めない。
// 名前は架空と分かるひらがな。日付・時刻は出さない（見本なので）
export type DemoFriend = { item: FeedItem; note: string };

const at = '2026-01-01T00:00:00.000Z';
const base = { recordedAt: at, localDate: '2026-01-01', commentCount: 0 } as const;

export const DEMO_FRIENDS: readonly DemoFriend[] = [
  {
    note: '今日は胸の日。ゆっくり丁寧に',
    item: {
      ...base,
      id: 'demo-1',
      kind: 'workout',
      author: { id: 'demo-1', name: 'さとう', avatar: { body: 'A', hair: 1, hairColor: 'black', shirtColor: 'teal', pantsColor: 'navy', accessory: 'none' } },
      exerciseNames: ['ベンチプレス'],
      personalBestExercises: ['ベンチプレス'],
      stamps: [
        { stampKey: 'nice', count: 2, mine: null, by: [] },
        { stampKey: 'fire', count: 1, mine: null, by: [] },
      ],
    },
  },
  {
    note: '夕方の川沿いを、気持ちよく',
    item: {
      ...base,
      id: 'demo-2',
      kind: 'run',
      author: { id: 'demo-2', name: 'たなか', avatar: { body: 'B', hair: 2, hairColor: 'brown', shirtColor: 'coral', pantsColor: 'black', accessory: 'band2' } },
      exerciseNames: [],
      run: { distanceM: 5000, durationS: 1680 },
      milestoneDay: 7,
      stamps: [
        { stampKey: 'clap', count: 3, mine: null, by: [] },
        { stampKey: 'smile', count: 1, mine: null, by: [] },
      ],
    },
  },
  {
    note: '今日はゆっくり休む日',
    item: {
      ...base,
      id: 'demo-3',
      kind: 'rest',
      author: { id: 'demo-3', name: 'すずき', avatar: { body: 'B', hair: 4, hairColor: 'red', shirtColor: 'purple', pantsColor: 'gray', accessory: 'none' } },
      exerciseNames: [],
      stamps: [{ stampKey: 'rest_slow', count: 2, mine: null, by: [] }],
    },
  },
  {
    note: 'スクワットを3セット。脚が笑ってる',
    item: {
      ...base,
      id: 'demo-4',
      kind: 'workout',
      author: { id: 'demo-4', name: 'やまだ', avatar: { body: 'A', hair: 5, hairColor: 'gray', shirtColor: 'gold', pantsColor: 'khaki', accessory: 'glasses' } },
      exerciseNames: ['スクワット', 'レッグプレス'],
      stamps: [
        { stampKey: 'nice', count: 1, mine: null, by: [] },
        { stampKey: 'smile', count: 2, mine: null, by: [] },
      ],
    },
  },
];
