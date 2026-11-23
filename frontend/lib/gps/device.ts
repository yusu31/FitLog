// 走る端末の種類（D4）。画面を消したときの動きが違うので、START のあとに出す案内を端末ごとに変える（判断ログ 計画 D4）。
// app＝Android アプリ（画面を消しても記録が続く）／android-web＝ブラウザ（画面を消すと止まる・アプリなら続く）／ios-web＝iPhone のブラウザ（画面を消すと止まる・アプリは無い）
export type GpsDevice = 'app' | 'android-web' | 'ios-web';

// iPadOS 13 以降は「Macintosh」と名乗るので、タッチの点が複数あるものは iPad とみなす
export function gpsDeviceOf(userAgent: string, native: boolean, maxTouchPoints = 0): GpsDevice {
  if (native) return 'app';
  if (/iPhone|iPad|iPod/.test(userAgent) || (/Macintosh/.test(userAgent) && maxTouchPoints > 1)) return 'ios-web';
  return 'android-web';
}

export const GPS_NOTICE_SEEN_KEY = 'fitlog-gps-notice-seen';

// 案内を出したことがあるか。端末に覚える。保存できない環境（プライベートモードなど）では「出したことがない」にして毎回出す（案内が無いより安全）
export function readNoticeSeen(): boolean {
  try {
    return localStorage.getItem(GPS_NOTICE_SEEN_KEY) === '1';
  } catch {
    return false;
  }
}

export function markNoticeSeen(): void {
  try {
    localStorage.setItem(GPS_NOTICE_SEEN_KEY, '1');
  } catch {
    // 覚えられないときは、次も出るだけ
  }
}
