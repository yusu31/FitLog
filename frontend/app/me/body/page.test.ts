// A2: 画面ごとにページタイトルを変える。共通の一覧（app/page-titles.test.ts）には、入口をつなぐ B14b で足す
describe('からだ画面のタイトル', () => {
  it('me/body のタイトルは「からだ」', async () => {
    const mod = await import('./page');
    expect(mod.metadata?.title).toBe('からだ');
  });
});
