import type { ExerciseResponse } from '@/lib/api/generated';

// 一覧の種目30件（backend/drizzle/0003_seed_exercises.sql の固定 ID）の一言説明。
// 初心者が「何の運動で、どこに効くか」を名前だけで分かるようにする（D3-2・本人が案2を選択）。
// 「じぶんの」種目（isCustom）には無い。静止画2枚は次の PR で足す（free-exercise-db・Unlicense）
const HINTS: Record<number, string> = {
  1: 'ベンチに寝て、バーを胸から押し上げる。胸の基本',
  2: '背もたれを起こして押す。胸の上のほうに効く',
  3: 'ダンベルを両手で押し上げる。左右の差が分かる',
  4: '道具なし。床で体を上下させて胸を鍛える',
  5: '腕を横に開いて閉じる。胸の広がりをつくる',
  6: 'バーを胸の前へ引き下ろす。背中の広がりに効く',
  7: 'バーにぶら下がり、体を引き上げる。背中の王道',
  8: '前かがみでバーをおなかへ引く。背中の厚みをつくる',
  9: '片手でダンベルを引き上げる。背中を片側ずつ',
  10: '床のバーを立ち上がって持ち上げる。背中と脚の全身種目',
  11: 'ダンベルを頭の上へ押し上げる。肩の基本',
  12: '腕を横に持ち上げる。肩の丸みをつくる',
  13: 'ロープを顔へ引く。肩の後ろと姿勢に効く',
  14: 'ひじを曲げてダンベルを巻き上げる。力こぶ',
  15: '手のひらを向かい合わせて巻き上げる。腕の太さに効く',
  16: '頭の後ろでひじを伸ばす。二の腕の裏側',
  17: '平行なバーで体を上下させる。二の腕と胸',
  18: '仰向けで上体を丸めて起こす。腹筋の入門',
  19: '仰向けで脚を上げ下げする。下腹に効く',
  20: '自転車をこぐように、ひじとひざを近づける。腹筋の横まで',
  21: 'ベンチに肩を乗せ、腰を持ち上げる。お尻の種目',
  22: '後ろ足を台に乗せて沈む。お尻と太ももに強く効く',
  23: '仰向けで腰を持ち上げる。道具なしでお尻',
  24: '立った姿勢から腰を落として立つ。脚の基本',
  25: '台に座って足で重りを押す。脚を安全に鍛える',
  26: '座ってひざを伸ばす。太ももの前側',
  27: 'ひざを曲げて重りを引く。太ももの裏側',
  28: '足を前に踏み出して沈む。脚とお尻',
  29: '背すじを伸ばして上体を倒す。太ももの裏とお尻',
  30: 'かかとを持ち上げる。ふくらはぎ',
};

const SEED_ID = /^00000000-0000-4000-8000-0000000000(\d{2})$/;

// 一言説明。じぶんの種目と、一覧に無い ID は undefined
export function exerciseHint(exercise: Pick<ExerciseResponse, 'id' | 'isCustom'>): string | undefined {
  if (exercise.isCustom) return undefined;
  const m = SEED_ID.exec(exercise.id);
  return m ? HINTS[Number(m[1])] : undefined;
}

// 静止画2枚（開始・終了の姿勢）。出典 yuhonas/free-exercise-db（Unlicense）。対応表は public/exercises/SOURCES.json
export function exerciseImages(exercise: Pick<ExerciseResponse, 'id' | 'isCustom'>): [string, string] | undefined {
  if (exercise.isCustom) return undefined;
  const m = SEED_ID.exec(exercise.id);
  if (!m || !HINTS[Number(m[1])]) return undefined;
  return [`/exercises/${m[1]}-0.jpg`, `/exercises/${m[1]}-1.jpg`];
}
