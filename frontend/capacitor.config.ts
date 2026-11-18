import type { CapacitorConfig } from '@capacitor/cli';

// Android アプリ（Capacitor）。アプリの画面（WebView）は、公開しているサイトをそのまま開く。
// 画面と API が同じサイトのまま Cookie 認証が動くので、バックエンド（CORS・Cookie の設定）を変えなくてよい。
// capacitor-www は、Capacitor が要求する同梱ファイルの置き場（つながらないときの案内だけ）。
const config: CapacitorConfig = {
  appId: 'com.yusu31.fitlog',
  appName: 'FitLog',
  webDir: 'capacitor-www',
  server: { url: 'https://d1f16oojhm6den.cloudfront.net', cleartext: false },
  android: { allowMixedContent: false },
};

export default config;
