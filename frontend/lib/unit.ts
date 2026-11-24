// 重さの単位（kg / lb）。表示だけを変え、保存は kg のまま（API・DB は kg）。
// 入力欄は lb のとき 5lb 刻みで動かし、kg に直して保存する（DB は 0.5kg 刻みなので、lb に戻すと数字が少しずれることがある）
export type WeightUnit = 'kg' | 'lb';
export const WEIGHT_UNITS: readonly WeightUnit[] = ['kg', 'lb'];
export const KG_PER_LB = 0.45359237;
export const LB_PER_KG = 1 / KG_PER_LB;

// kg → 表示の数（lb は小数1桁まで）
export function toUnit(kg: number, unit: WeightUnit): number {
  return unit === 'kg' ? kg : Math.round(kg * LB_PER_KG * 10) / 10;
}

// 表示の数 → kg（lb からは 0.1 刻みの kg。記録の 0.5 刻みへそろえるのは呼ぶ側の clamp）
export function fromUnit(value: number, unit: WeightUnit): number {
  return unit === 'kg' ? value : Math.round(value * KG_PER_LB * 10) / 10;
}

// lb の 5 の倍数（grid）へそろえて動かす。いまの値が 5 の倍数の近く（0.5kg の丸めで生じるずれ。約0.75lb 以内）なら、その倍数から動かす
export function stepLb(kg: number, dir: 1 | -1, grid = 5): number {
  const base = kg * LB_PER_KG / grid;
  const near = Math.round(base);
  const index = Math.abs(base - near) * grid < 0.8 ? near + dir : dir > 0 ? Math.ceil(base) : Math.floor(base);
  return Math.max(0, index) * grid;
}
