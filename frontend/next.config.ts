import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // 静的書き出し: 画面は HTML・CSS・JavaScript のファイルの束（out/）になり、S3 + CloudFront から配る。
  output: "export",
  // S3 を OAC で読むと /records/ が index.html に読み替わらないため、/records/index.html の形で書き出し、
  // CloudFront Function で index.html を付ける（docs/infrastructure.md 2.1章）。
  trailingSlash: true,
  // 開発中の /api/* の転送で、末尾に / を足す 308 リダイレクトが挟まると API のパス（/api/auth/sign-in/email）に合わない
  skipTrailingSlashRedirect: process.env.NODE_ENV === "development",
  // 画像の最適化はサーバーが要る。静的書き出しでは使えないので切る。
  images: { unoptimized: true },
  // 雛形の cacheComponents・partialPrefetching は output: "export" と併用できない
  // （Invariant: PPR cannot be enabled in export mode）ので外した。
  // 開発中だけ /api/* を手元の API（Nest・3000番）へ転送し、本番（CloudFront の下の /api/*）と同じ「同じサイト」にする。
  // 静的書き出しの本番には rewrites は出ない（next build は書き出し時に無視する）。
  async rewrites() {
    if (process.env.NODE_ENV !== "development") return [];
    return [{ source: "/api/:path*", destination: "http://localhost:3000/api/:path*" }];
  },
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
