// エラーの原因を表す短い印（例: ECONNREFUSED）を取り出す。メッセージ本文は取り出さない。
// drizzle は DB のエラーを別のエラーで包み、本当の原因を cause に入れる。message には SQL の引数が入るので、ログに出さない。
export function errorCode(err: unknown): string {
  const code = (err as { code?: unknown } | null)?.code;
  if (typeof code === 'string') return code;
  const causeCode = (err as { cause?: { code?: unknown } } | null)?.cause?.code;
  if (typeof causeCode === 'string') return causeCode;
  return 'unknown';
}
