import { BodyPart } from '@/lib/api/generated';

// ヒートマップの部位（design.md の BodyPart）の日本語名。並びは API の一覧（部位の順）と同じ
export const BODY_PART_ORDER = [
  BodyPart.chest,
  BodyPart.back,
  BodyPart.shoulders,
  BodyPart.arms,
  BodyPart.abs,
  BodyPart.glutes,
  BodyPart.legs,
] as const;

export const BODY_PART_LABEL: Record<BodyPart, string> = {
  chest: '胸',
  back: '背中',
  shoulders: '肩',
  arms: '腕',
  abs: '腹',
  glutes: 'お尻',
  legs: '脚',
};
