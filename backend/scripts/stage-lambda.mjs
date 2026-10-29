// Lambda に載せるファイルの一式を .lambda/ に作る（docs/tech-stack.md「Lambda 用のまとめ方」）。
// 使い方: npm run build のあとに npm run package:lambda。zip にするのは Terraform（archive_file）の役目なので、ここではフォルダまで。
//
// やること: dist/ と package.json・lock をコピー → 本番の依存だけを入れる → 実行に要らないものを取り除く → 大きさを測って上限を超えたら失敗。
import { execFileSync } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, readdirSync, rmSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';

const OUT = resolve('.lambda');
// Lambda の上限は「展開後 250 MB」。実測（バイト数）は約 42.5 MB。実測の2倍強で上限の4割の 100 MB を予算にして、超えたら気づく
const BUDGET_MB = 100;
// 実行に要らないのに、本番の依存に入ってしまうもの（理由と、外しても動く確認は docs/tech-stack.md）
//  typescript: NestJS の peer 依存（型の道具）。実行時には読まれない
//  swagger-ui-dist: Swagger の画面の部品。API の仕様は build 時に出していて、実行時には画面を出さない
const PRUNE = ['typescript', 'swagger-ui-dist'];

if (!existsSync(join('dist', 'lambda.js'))) {
  console.error('dist/lambda.js がありません。先に npm run build を実行してください');
  process.exit(1);
}

// 消すのは、このスクリプトが作る .lambda だけ（取り違えて別のフォルダを消さないよう、名前を確かめる）
if (existsSync(OUT)) {
  if (!OUT.endsWith('.lambda')) throw new Error(`消す対象が .lambda ではありません: ${OUT}`);
  rmSync(OUT, { recursive: true, force: true });
}
mkdirSync(OUT);
cpSync('dist', join(OUT, 'dist'), { recursive: true });
cpSync('package.json', join(OUT, 'package.json'));
cpSync('package-lock.json', join(OUT, 'package-lock.json'));

// --omit=optional が要る理由: better-auth は多くの統合先（vitest・vite・drizzle-kit など）を「任意の peer 依存」として宣言していて、
// lock では dev かつ任意の印（devOptional）になり、--omit=dev だけでは残る（実測: 本番の依存を入れた直後の node_modules が、du の値で 198 MB → 105 MB に減った）。
// --ignore-scripts: 入れるだけで、依存の install スクリプトを動かさない（供給網の事故を避ける）
// npm は npm run 経由で動かしたときの npm_execpath（npm-cli.js）を node で直接起動する（Windows の shell 経由の警告を避ける）
const npmCli = process.env.npm_execpath;
if (!npmCli) throw new Error('npm run package:lambda で実行してください（npm_execpath がありません）');
execFileSync(process.execPath, [npmCli, 'ci', '--omit=dev', '--omit=optional', '--ignore-scripts', '--no-audit', '--no-fund'], {
  cwd: OUT,
  stdio: 'inherit',
});

for (const name of PRUNE) rmSync(join(OUT, 'node_modules', name), { recursive: true, force: true });

function sizeOf(path) {
  const stat = statSync(path);
  if (!stat.isDirectory()) return stat.size;
  return readdirSync(path).reduce((sum, entry) => sum + sizeOf(join(path, entry)), 0);
}
const mb = sizeOf(OUT) / 1024 / 1024;
console.log(`展開後の大きさ: ${mb.toFixed(1)} MB（予算 ${BUDGET_MB} MB・Lambda の上限 250 MB）`);
if (mb > BUDGET_MB) {
  console.error('予算を超えました。何が増えたか（du -sm .lambda/node_modules/* | sort -rn）を確かめてください');
  process.exit(1);
}
