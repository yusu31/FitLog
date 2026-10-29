// ログイン・登録のあとに戻る先（?next=）を、このサイトの中のパスだけに絞る。
// 絞らないと、?next=https://悪いサイト で「ログインしたら外のサイトへ飛ばす」罠（オープンリダイレクト）になる。
// 招待リンク（/invite?token=…）の値は、このパスの中のクエリとして画面をまたいで運ぶ（docs/screen-design.md S-03）。
export const DEFAULT_NEXT_PATH = '/today';

export function safeNextPath(raw: string | null | undefined): string {
  if (!raw) return DEFAULT_NEXT_PATH;
  // 「/」で始まり、2文字目が「/」「\」でない（//evil.com や /\evil.com はブラウザが外のサイトとして読む）
  if (!raw.startsWith('/') || raw.startsWith('//') || raw.startsWith('/\\')) return DEFAULT_NEXT_PATH;
  // 制御文字（改行・タブなど）はブラウザが取り除いて別の URL に化けることがある
  if (/[\u0000-\u001f\u007f]/.test(raw)) return DEFAULT_NEXT_PATH;
  return raw;
}

// 登録⇄ログインの行き来で、戻り先を失わないようにリンクへ付ける
export function withNext(path: string, next: string): string {
  return next === DEFAULT_NEXT_PATH ? path : `${path}?next=${encodeURIComponent(next)}`;
}
