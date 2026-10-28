import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // 静的書き出し: 画面は HTML・CSS・JavaScript のファイルの束（out/）になり、S3 + CloudFront から配る。
  output: "export",
  // S3 を OAC で読むと /records/ が index.html に読み替わらないため、/records/index.html の形で書き出し、
  // CloudFront Function で index.html を付ける（docs/infrastructure.md 2.1章）。
  trailingSlash: true,
  // 画像の最適化はサーバーが要る。静的書き出しでは使えないので切る。
  images: { unoptimized: true },
  // 雛形の cacheComponents・partialPrefetching は output: "export" と併用できない
  // （Invariant: PPR cannot be enabled in export mode）ので外した。
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
