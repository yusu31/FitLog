import { BodyPart } from '@/lib/api/generated';
import { HEAT_COLORS, type PartLevels } from '@/lib/heatmap';

// 体の図（前・後ろ）。部位ごとの段階を色にする。平らな塗り・線なし（プロトタイプ v8 の body() と同じ形）。
// v8 に無い腹・お尻は、v8 で灰色の胴の部分に割り当てた（前=腹、後ろの下=お尻）
const SKIN = '#F5CFA6';

export function BodyFigure({ view, levels, size = 118 }: { view: 'front' | 'back'; levels: PartLevels; size?: number }) {
  const c = (part: BodyPart) => HEAT_COLORS[levels[part]];
  const front = view === 'front';
  return (
    <svg
      data-testid={`body-${view}`}
      width={size}
      height={Math.round((size * 262) / 132)}
      viewBox="0 0 132 262"
      role="img"
      aria-label={front ? '前から見た体' : '後ろから見た体'}
    >
      <circle cx="66" cy="24" r="17" fill={SKIN} />
      <rect x="58" y="38" width="16" height="14" rx="6" fill={SKIN} />
      <circle data-part="shoulders" cx="32" cy="64" r="15" fill={c(BodyPart.shoulders)} />
      <circle data-part="shoulders" cx="100" cy="64" r="15" fill={c(BodyPart.shoulders)} />
      {front ? (
        <>
          <rect data-part="chest" x="40" y="52" width="25" height="34" rx="12" fill={c(BodyPart.chest)} />
          <rect data-part="chest" x="67" y="52" width="25" height="34" rx="12" fill={c(BodyPart.chest)} />
          <rect data-part="abs" x="47" y="90" width="38" height="44" rx="14" fill={c(BodyPart.abs)} />
        </>
      ) : (
        <>
          <path data-part="back" d="M44 54h44q6 0 5 8l-5 42q-1 8-9 8H53q-8 0-9-8L39 62q-1-8 5-8z" fill={c(BodyPart.back)} />
          <rect data-part="glutes" x="46" y="116" width="40" height="22" rx="11" fill={c(BodyPart.glutes)} />
        </>
      )}
      <rect data-part="arms" x="12" y="74" width="19" height="66" rx="9.5" fill={c(BodyPart.arms)} />
      <rect data-part="arms" x="101" y="74" width="19" height="66" rx="9.5" fill={c(BodyPart.arms)} />
      <circle cx="21" cy="150" r="9" fill={SKIN} />
      <circle cx="111" cy="150" r="9" fill={SKIN} />
      <rect data-part="legs" x="42" y="140" width="22" height="104" rx="11" fill={c(BodyPart.legs)} />
      <rect data-part="legs" x="68" y="140" width="22" height="104" rx="11" fill={c(BodyPart.legs)} />
      <rect x="38" y="244" width="28" height="12" rx="6" fill={SKIN} />
      <rect x="66" y="244" width="28" height="12" rx="6" fill={SKIN} />
    </svg>
  );
}
