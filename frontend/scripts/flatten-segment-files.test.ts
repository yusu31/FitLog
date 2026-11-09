// @vitest-environment node
import { mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { flattenSegmentFiles } from "./flatten-segment-files.mjs";

// Windows でビルドすると、先読みファイルが __next.signup/__PAGE__.txt（入れ子）で出る。
// 画面は __next.signup.__PAGE__.txt（ドットでつなぐ）を取りに行くので、ビルド後に名前を直す（Issue #169）。
let out: string;

function put(rel: string, body = "x") {
  const p = join(out, rel);
  mkdirSync(dirname(p), { recursive: true });
  writeFileSync(p, body);
}

function listAll(dir: string, base = dir): string[] {
  return walk(dir, base).sort();
}

function walk(dir: string, base: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory() ? walk(join(dir, e.name), base) : [join(dir, e.name).slice(base.length + 1).replace(/\\/g, "/")],
  );
}

beforeEach(() => {
  out = mkdtempSync(join(tmpdir(), "flatten-"));
});
afterEach(() => {
  rmSync(out, { recursive: true, force: true });
});

describe("flattenSegmentFiles", () => {
  it("入れ子の先読みファイルをドットでつなぐ名前にする（1段）", () => {
    put("signup/index.html");
    put("signup/__next.signup/__PAGE__.txt", "page");

    const n = flattenSegmentFiles(out);

    expect(n).toBe(1);
    expect(readFileSync(join(out, "signup/__next.signup.__PAGE__.txt"), "utf8")).toBe("page");
    expect(listAll(out)).toEqual(["signup/__next.signup.__PAGE__.txt", "signup/index.html"]);
  });

  it("深い入れ子（/settings/group）も全部ドットでつなぐ", () => {
    put("settings/group/__next.settings/group/__PAGE__.txt");
    put("settings/group/__next.settings/group.txt");

    expect(flattenSegmentFiles(out)).toBe(2);
    expect(listAll(out)).toEqual([
      "settings/group/__next.settings.group.__PAGE__.txt",
      "settings/group/__next.settings.group.txt",
    ]);
  });

  it("すでにドット名のファイル（Linux でのビルド）には何もしない", () => {
    put("signup/__next.signup.__PAGE__.txt");
    put("signup/__next._tree.txt");

    expect(flattenSegmentFiles(out)).toBe(0);
    expect(listAll(out)).toEqual(["signup/__next._tree.txt", "signup/__next.signup.__PAGE__.txt"]);
  });

  it("_next/ の中や、__next. で始まらないフォルダは触らない", () => {
    put("_next/static/__next.fake/a.txt");
    put("friends/list/a.txt");

    expect(flattenSegmentFiles(out)).toBe(0);
    expect(listAll(out)).toEqual(["_next/static/__next.fake/a.txt", "friends/list/a.txt"]);
  });
});
