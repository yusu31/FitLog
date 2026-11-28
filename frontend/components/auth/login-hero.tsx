// ログイン画面の上半分（案 R。Issue #473）。左上に白い印と FitLog、大見出し、仲間の頭文字の丸の重なり。
// 背景の絵は LoginBackdrop が下に敷く（差し替え式）。数字や見本の枠は置かない
const AVATARS = [
  { initial: 'さ', tone: 'bg-teal-deep text-white' },
  { initial: 'た', tone: 'bg-gold text-fg' },
  { initial: 'み', tone: 'bg-coral text-fg' },
  { initial: 'ゆ', tone: 'bg-grape-dark text-white' },
] as const;

export function LoginHero() {
  return (
    <div data-testid="login-hero">
      <div className="flex items-center gap-2 text-lg">
        <span aria-hidden="true" className="grid size-9 place-items-center rounded-xl bg-white">
          <span className="size-4 rounded-full bg-teal-dark" />
        </span>
        <span className="font-extrabold tracking-wider">FitLog</span>
      </div>
      <h1 className="mt-6 text-page-title leading-tight font-extrabold">
        今日の1回を、
        <br />
        <span className="text-gold">動画に</span>。
      </h1>
      <div className="mt-5 flex -space-x-2" aria-hidden="true">
        {AVATARS.map((a) => (
          <span key={a.initial} className={`grid size-9 place-items-center rounded-full border-2 border-white text-sm font-extrabold ${a.tone}`}>
            {a.initial}
          </span>
        ))}
      </div>
    </div>
  );
}
