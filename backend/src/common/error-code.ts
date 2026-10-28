// エラーの原因を表す短い印（例: ECONNREFUSED）を取り出す。メッセージ本文は取り出さない。
// drizzle は DB のエラーを別のエラーで包み、本当の原因を cause に入れる。message には SQL の引数が入るので、ログに出さない。
export function errorCode(err: unknown): string {
  const code = (err as { code?: unknown } | null)?.code;
  if (typeof code === 'string') return code;
  const causeCode = (err as { cause?: { code?: unknown } } | null)?.cause?.code;
  if (typeof causeCode === 'string') return causeCode;
  return 'unknown';
}

// SQL の文面らしい文字列か。DB のエラーの文字列は、SQL とその引数（メールアドレスやパスワードのハッシュ）を含みうる。
// 出どころが分からない文字列を、ログに通す前の見分けに使う。
const SQL_LIKE = /Failed query|params:|\binsert into\b|\bselect\b.+\bfrom\b|\bupdate\b.+\bset\b|\bdelete from\b/i;
export const looksLikeSql = (text: string): boolean => SQL_LIKE.test(text);
