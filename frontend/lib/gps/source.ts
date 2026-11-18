// 位置の取得元を切り替える。ブラウザ（Web 版）は navigator.geolocation、Android アプリ（Capacitor）は
// バックグラウンドでも動く @capacitor-community/background-geolocation（通知を出して画面を消しても記録を続ける）。
// どちらも「位置が届いたら GpsFix を渡す」形にそろえ、計算（track.ts）と画面は取得元を知らなくてよい。
import { Capacitor, registerPlugin } from '@capacitor/core';
import type { BackgroundGeolocationPlugin } from '@capacitor-community/background-geolocation';
import type { GpsFix } from './track';

export type WatchProblem = 'denied' | 'unavailable' | 'unsupported';
export type StopWatch = () => void;

export const isNativeApp = (): boolean => Capacitor.isNativePlatform();

// この端末で位置を取れる仕組みがあるか（許可の有無は見ない）
export const canWatchLocation = (): boolean => isNativeApp() || (typeof navigator !== 'undefined' && 'geolocation' in navigator);

const NATIVE_NOTICE = {
  backgroundTitle: 'FitLog がランを記録しています',
  backgroundMessage: '止めるには FitLog を開いて「一時停止」か「終了」を押してね',
};

// 取得を始める。返す関数で止める（一時停止・終了・画面を離れるとき）
export function startLocationWatch(onFix: (fix: GpsFix) => void, onProblem: (problem: WatchProblem) => void): StopWatch {
  return isNativeApp() ? startNative(onFix, onProblem) : startWeb(onFix, onProblem);
}

function startWeb(onFix: (fix: GpsFix) => void, onProblem: (problem: WatchProblem) => void): StopWatch {
  const id = navigator.geolocation.watchPosition(
    (p) => onFix({ lon: p.coords.longitude, lat: p.coords.latitude, accuracyM: p.coords.accuracy, t: p.timestamp }),
    // 一時的な取れなさ（TIMEOUT・POSITION_UNAVAILABLE）と、許可が無いときを分ける
    (err) => onProblem(err.code === err.PERMISSION_DENIED ? 'denied' : 'unavailable'),
    { enableHighAccuracy: true, maximumAge: 0, timeout: 20_000 },
  );
  return () => navigator.geolocation.clearWatch(id);
}

function startNative(onFix: (fix: GpsFix) => void, onProblem: (problem: WatchProblem) => void): StopWatch {
  const plugin = registerPlugin<BackgroundGeolocationPlugin>('BackgroundGeolocation');
  let stopped = false;
  let watcherId: string | null = null;
  void plugin
    .addWatcher(
      { ...NATIVE_NOTICE, requestPermissions: true, stale: false, distanceFilter: 0 },
      (location, error) => {
        if (stopped) return;
        if (error) {
          onProblem(error.code === 'NOT_AUTHORIZED' ? 'denied' : 'unavailable');
          return;
        }
        if (location) onFix({ lon: location.longitude, lat: location.latitude, accuracyM: location.accuracy, t: location.time ?? Date.now() });
      },
    )
    .then((id) => {
      // 登録が終わる前に止められていたら、すぐ外す
      if (stopped) void plugin.removeWatcher({ id });
      else watcherId = id;
    })
    .catch(() => onProblem('unavailable'));
  return () => {
    stopped = true;
    if (watcherId !== null) void plugin.removeWatcher({ id: watcherId });
    watcherId = null;
  };
}
