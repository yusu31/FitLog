// API のエラーの応答（code・message・details。docs/design.md 5章）から、画面に出せる文言を取り出す。
// 形が違うとき（通信の途中で切れた等）は、呼ぶ側が決めた文言にする
export function messageOf(body: unknown, fallback: string): string {
  const message = (body as { message?: unknown } | null)?.message;
  return typeof message === 'string' && message.length > 0 ? message : fallback;
}
