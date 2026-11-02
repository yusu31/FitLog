import { FORBIDDEN_WORDS } from './forbidden-words';
import { GHOST_MESSAGES, HOME_MESSAGES, RECORD_MESSAGES, ghostUpMessage } from './messages';

// 責めない言葉の検査（T-DATE-13・T-GHOST-13、features.md UC-12・2.5）。
// 使ってはいけない語の一覧（FORBIDDEN_WORDS）を、画面の文言定数がすべて避けていることを確かめる。
const collect = (v: unknown): string[] =>
  typeof v === 'string' ? [v] : typeof v === 'function' ? [] : Object.values(v as object).flatMap(collect);

describe('文言の定数', () => {
  it('ゴーストの結果の言い方は features.md 2.5 のとおり', () => {
    expect(ghostUpMessage(3)).toBe('前回超え +3');
    expect(GHOST_MESSAGES.same).toBe('前回と おなじ');
    expect(GHOST_MESSAGES.down).toBe('ちゃんと 記録したよ。むりしない日もOK');
  });

  it('使ってはいけない語の一覧が空でない（空だと検査が素通りする）', () => {
    expect(FORBIDDEN_WORDS.length).toBeGreaterThan(0);
    expect(FORBIDDEN_WORDS).toEqual(expect.arrayContaining(['また 0 から', '途切れ', '負け']));
  });

  const all = [...collect(GHOST_MESSAGES), ...collect(HOME_MESSAGES), ...collect(RECORD_MESSAGES), ghostUpMessage(1), ghostUpMessage(100)];

  it('検査の対象になる文言が集まっている', () => {
    expect(all.length).toBeGreaterThanOrEqual(5);
  });

  it.each(all)('「%s」は使ってはいけない語を含まない（T-DATE-13・T-GHOST-13）', (text) => {
    for (const word of FORBIDDEN_WORDS) expect(text).not.toContain(word);
  });

  // 検査自体が働くことの確認: 禁止語を含む文は検出される
  it('禁止語を含む文は検出される（検査が素通りしていない）', () => {
    expect(FORBIDDEN_WORDS.some((w) => '今日でまた 0 から'.includes(w))).toBe(true);
  });
});
