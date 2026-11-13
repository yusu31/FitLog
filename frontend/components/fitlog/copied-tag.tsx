import { FRIEND_MESSAGES } from '@/lib/messages';

// 「◯◯さんから」の札（F-24）。仲間のメニューをコピーして始めた記録に付ける。抜けた仲間なら name が null で「仲間から」
export function CopiedTag({ name }: { name: string | null }) {
  return <span className="fl-tag bg-teal-light text-ink">{FRIEND_MESSAGES.copiedTag(name)}</span>;
}
