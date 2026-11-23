import { gpsDeviceOf, GPS_NOTICE_SEEN_KEY, markNoticeSeen, readNoticeSeen } from './device';

const ANDROID = 'Mozilla/5.0 (Linux; Android 15; SM-S931B) AppleWebKit/537.36 Chrome/130 Mobile Safari/537.36';
const IPHONE = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Version/18.0 Mobile/15E148 Safari/604.1';
const IPAD_AS_MAC = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 Version/18.0 Safari/605.1.15';

describe('gpsDeviceOf（端末の3種類）', () => {
  it('アプリ（Capacitor）なら、ブラウザの名乗りに関わらず app', () => {
    expect(gpsDeviceOf(ANDROID, true)).toBe('app');
    expect(gpsDeviceOf(IPHONE, true)).toBe('app');
  });
  it('iPhone のブラウザは ios-web', () => {
    expect(gpsDeviceOf(IPHONE, false)).toBe('ios-web');
  });
  it('iPad（Macintosh と名乗りタッチが複数）も ios-web。タッチの無い Mac は android-web 側（PC）', () => {
    expect(gpsDeviceOf(IPAD_AS_MAC, false, 5)).toBe('ios-web');
    expect(gpsDeviceOf(IPAD_AS_MAC, false, 0)).toBe('android-web');
  });
  it('Android のブラウザ・その他は android-web', () => {
    expect(gpsDeviceOf(ANDROID, false)).toBe('android-web');
  });
});

describe('案内を出したことの記憶', () => {
  beforeEach(() => localStorage.clear());
  it('はじめは出したことがない。覚えたら出したことになる', () => {
    expect(readNoticeSeen()).toBe(false);
    markNoticeSeen();
    expect(localStorage.getItem(GPS_NOTICE_SEEN_KEY)).toBe('1');
    expect(readNoticeSeen()).toBe(true);
  });
});
