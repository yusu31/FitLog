// 貼られた招待リンク（URL 全体、または token だけ）から token を取り出す（N8）。
// token は base64url（英数字と _ -）。長さは作る側が 24 バイト＝32 字だが、将来の変更に備えて幅を持たせる。
// 取り出せなければ null。別のサイトの URL でも、パスが /invite で token が正しい形なら通す
// （開発・本番でドメインが違うため。移る先はこのサイトの /invite だけなので、外のサイトへは飛ばない）
const TOKEN = /^[A-Za-z0-9_-]{8,128}$/;

export function extractInviteToken(input: string): string | null {
  const text = input.trim();
  if (!text) return null;
  if (TOKEN.test(text)) return text;
  try {
    const url = new URL(text);
    if (url.pathname.replace(/\/+$/, '') !== '/invite') return null;
    const token = url.searchParams.get('token') ?? '';
    return TOKEN.test(token) ? token : null;
  } catch {
    return null;
  }
}
