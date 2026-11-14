import type { Metadata, Viewport } from "next";
import { THEME_COLOR } from "@/lib/pwa/manifest";
import "./globals.css";
import "@fontsource/barlow-condensed/800-italic.css";
import { Providers } from "./providers";
import { SwRegister } from "@/components/fitlog/sw-register";

export const metadata: Metadata = {
  title: "FitLog",
  description: "少人数で使う、筋トレとランの記録アプリ",
  // iPhone のホーム画面のアイコン（F-25）。manifest は app/manifest.ts が出す
  icons: { apple: "/icons/icon-192.png" },
  appleWebApp: { capable: true, title: "FitLog", statusBarStyle: "default" },
};

export const viewport: Viewport = { themeColor: THEME_COLOR };

// 外部のフォント配信（Google Fonts）は使わない: ビルドが通信に頼らず、利用者の端末が外部へ問い合わせない。
// 文字はシステムの標準フォント（日本語を含む）で表示する。数字・札だけ、同梱した Barlow Condensed（OFL）を使う。
export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="ja" className="h-full antialiased">
      <body className="min-h-full flex flex-col">
        <SwRegister>
          <Providers>{children}</Providers>
        </SwRegister>
      </body>
    </html>
  );
}
