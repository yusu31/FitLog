import { extractInviteToken } from './invite-token';

describe('extractInviteToken（貼られた招待リンクから token を取り出す）', () => {
  // T-PEER-01: 同値分割（URL 全体／token だけ／前後の空白つき）
  it.each([
    ['https://fitlog.example/invite?token=tok_00000001', 'tok_00000001'],
    ['http://localhost:3000/invite?token=tok_00000001&x=1', 'tok_00000001'],
    ['tok_00000001', 'tok_00000001'],
    ['  tok_00000001\n', 'tok_00000001'],
    ['https://fitlog.example/invite/?token=tok_00000001', 'tok_00000001'],
  ])('%s → %s', (input, expected) => {
    expect(extractInviteToken(input)).toBe(expected);
  });

  // T-PEER-02: 取り出せないもの（空・別のページの URL・token の無い URL・使えない文字・長すぎる値）は null
  it.each([
    '',
    '   ',
    'https://example.com/other?token=tok_00000001',
    'https://fitlog.example/invite',
    'https://fitlog.example/invite?token=',
    'abc def ghi',
    '短い日本語の文',
    'a'.repeat(129),
  ])('「%s」は null', (input) => {
    expect(extractInviteToken(input)).toBeNull();
  });
});
