// A2: 画面ごとにページタイトルを変える（タブ・履歴・読み上げで画面を区別できるように）。
// テンプレート「%s | FitLog」は layout.tsx が持ち、各ページは画面名だけを渡す
const PAGES: [path: string, title: string][] = [
  ['login', 'ログイン'],
  ['signup', '新規登録'],
  ['terms', '利用規約'],
  ['privacy', 'プライバシーの扱い'],
  ['today', '今日'],
  ['friends', '仲間'],
  ['me', '自分'],
  ['me/stats', '記録のまとめ'],
  ['exercises', '種目を選ぶ'],
  ['record', '筋トレを記録'],
  ['record-detail', '記録の詳細'],
  ['run', 'ランを記録'],
  ['rest', 'おやすみ'],
  ['invite', 'グループへの招待'],
  ['settings', '設定'],
  ['settings/account', 'アカウントの設定'],
  ['settings/credits', 'クレジット'],
  ['settings/group', 'グループの設定'],
];

describe('ページタイトル（A2）', () => {
  it.each(PAGES)('%s のタイトルは「%s」', async (path, title) => {
    const mod = await import(`./${path}/page`);
    expect(mod.metadata?.title).toBe(title);
  });

  it('全画面のタイトルが重ならない', () => {
    const titles = PAGES.map(([, t]) => t);
    expect(new Set(titles).size).toBe(titles.length);
  });

  it('layout は「%s | FitLog」のテンプレートと、既定のタイトルを持つ', async () => {
    const { metadata } = await import('./layout');
    expect(metadata.title).toEqual({ default: 'FitLog', template: '%s | FitLog' });
  });
});
