import { cn } from 'cn';
import type { StampKey } from '@/lib/api/generated';

// スタンプのメダル（D5 PR-2・判断ログ 42）。SVG のリボン付きの丸に数字。種類で色分け・まだは灰色。
// 色は「面の上の文字が 4.5:1 以上」になる濃さを使う（金だけは明るい面なので紺の文字）。
type Tone = 'teal' | 'coral' | 'gold' | 'grape';

// ティール＝はじめての記録・ランの合計／コーラル＝ラン系の初回／ゴールド＝日数／グレープ＝重さ
const TONE: Record<StampKey, Tone> = {
  'first-record': 'teal',
  'first-run': 'coral',
  'first-5k': 'coral',
  'first-10k': 'coral',
  'days-10': 'gold',
  'days-30': 'gold',
  'days-100': 'gold',
  'weight-1t': 'grape',
  'weight-10t': 'grape',
  'weight-100t': 'grape',
  'run-50k': 'teal',
  'run-100k': 'teal',
  'run-500k': 'teal',
};

// メダルの中の数字（短く。意味は下の名前で読む）
export const MEDAL_TEXT: Record<StampKey, string> = {
  'first-record': '1',
  'first-run': '1',
  'first-5k': '5',
  'first-10k': '10',
  'days-10': '10',
  'days-30': '30',
  'days-100': '100',
  'weight-1t': '1t',
  'weight-10t': '10t',
  'weight-100t': '100t',
  'run-50k': '50',
  'run-100k': '100',
  'run-500k': '500',
};

const FACE: Record<Tone, { face: string; ring: string; text: string }> = {
  teal: { face: 'fill-teal-dark', ring: 'stroke-teal-light', text: 'fill-white' },
  coral: { face: 'fill-coral-strong', ring: 'stroke-coral-light', text: 'fill-white' },
  gold: { face: 'fill-gold', ring: 'stroke-gold-light', text: 'fill-night' },
  grape: { face: 'fill-grape-dark', ring: 'stroke-white/70', text: 'fill-white' },
};

export function StampMedal({ stampKey, earned, size = 56, className }: { stampKey: StampKey; earned: boolean; size?: number; className?: string }) {
  const tone = FACE[TONE[stampKey]];
  const text = MEDAL_TEXT[stampKey];
  const fontSize = text.length >= 3 ? 15 : text.length === 2 ? 18 : 22;
  return (
    <svg
      aria-hidden
      data-testid="stamp-medal"
      data-earned={earned}
      viewBox="0 0 56 64"
      width={size}
      height={(size * 64) / 56}
      className={cn('shrink-0', className)}
    >
      {/* 下の影（立体に見せる） */}
      <ellipse cx="28" cy="60" rx="14" ry="3" className="fill-night/20" />
      {earned ? (
        <>
          {/* リボン → 丸 の順に重ねる（丸が手前） */}
          <path d="M17 34 L11 58 L20 53 L25 60 L29 38 Z" className={tone.face} />
          <path d="M39 34 L45 58 L36 53 L31 60 L27 38 Z" className={tone.face} opacity={0.8} />
          <circle cx="28" cy="26" r="22" className={tone.face} />
          <circle cx="28" cy="26" r="17.5" fill="none" strokeWidth="2" className={tone.ring} />
        </>
      ) : (
        // まだ：形は全部ふつうに塗り、グループ全体に薄さをかける（形ごとに薄くすると、重なった所が濃く透けて見える）
        <g opacity={0.35} className="fill-fg-muted">
          <path d="M17 34 L11 58 L20 53 L25 60 L29 38 Z" />
          <path d="M39 34 L45 58 L36 53 L31 60 L27 38 Z" />
          <circle cx="28" cy="26" r="22" />
          <circle cx="28" cy="26" r="17.5" fill="none" strokeWidth="2" className="stroke-white/70" />
        </g>
      )}
      <text
        x="28"
        y="26"
        textAnchor="middle"
        dominantBaseline="central"
        fontSize={fontSize}
        className={cn('fl-num', earned ? tone.text : 'fill-fg-muted')}
      >
        {text}
      </text>
    </svg>
  );
}
