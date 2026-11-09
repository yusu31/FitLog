// 静的書き出し（out/）の先読みファイルの名前を、画面が取りに行く名前に直す（Issue #169）。
//
// 画面（Next.js の先読み）は /signup/__next.signup.__PAGE__.txt のように、区切りを「.」でつないだ名前を要求する。
// ところが Windows でビルドすると、Next.js が区切りの「\」を置き換え損ねて
// signup/__next.signup/__PAGE__.txt（フォルダの入れ子）で出力する。
// この名前のまま S3 に載せると要求した名前のファイルが無く、S3 は 403 を返す。
// そこでビルド直後に「__next. で始まるフォルダ」の中身を、フォルダ名 + 「.」 + 相対パス（区切りは「.」）の
// 1つのファイルへ移す。Linux でのビルドは最初からドット名なので何も起きない（0 件）。
import { readdirSync, renameSync, rmSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

/** フォルダ dir の中のファイルを、相対パス（区切りは / ）の配列で返す */
function listFiles(dir, prefix = "") {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory() ? listFiles(join(dir, e.name), `${prefix}${e.name}/`) : [`${prefix}${e.name}`],
  );
}

/**
 * outDir の下を探し、__next. で始まるフォルダの中のファイルを、ドットでつないだ名前のファイルへ移す。
 * _next/（ビルド成果物）の中は触らない。移したファイルの数を返す。
 */
export function flattenSegmentFiles(outDir) {
  let moved = 0;
  for (const e of readdirSync(outDir, { withFileTypes: true })) {
    if (!e.isDirectory() || e.name === "_next") continue;
    const dir = join(outDir, e.name);
    if (e.name.startsWith("__next.")) {
      for (const rel of listFiles(dir)) {
        renameSync(join(dir, ...rel.split("/")), join(outDir, `${e.name}.${rel.replaceAll("/", ".")}`));
        moved += 1;
      }
      rmSync(dir, { recursive: true, force: true });
    } else {
      moved += flattenSegmentFiles(dir);
    }
  }
  return moved;
}

// `node scripts/flatten-segment-files.mjs [out]` で直接実行されたとき（npm run build の最後）
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const target = process.argv[2] ?? "out";
  const n = flattenSegmentFiles(target);
  console.log(`先読みファイルの名前を直した: ${n} 件（${target}）`);
}
