import { LATE_MESSAGES } from '@/lib/messages';

// 「あとから記録」の札（F-21）。きのうの分などを、あとから入れた記録に付ける。時刻の代わりに出す（時刻は聞かない）
export function LateTag() {
  return <span className="fl-tag bg-gold-light text-ink">{LATE_MESSAGES.tag}</span>;
}
