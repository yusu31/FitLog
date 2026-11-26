'use client';

import 'maplibre-gl/dist/maplibre-gl.css';
import '@/lib/map/map-controls.css';
import { useCallback, useEffect, useRef, useState } from 'react';
import { JAPAN_ROUTE, type RoutePosition } from '@/lib/japan-route';
import { RouteSketch } from '@/components/map/route-sketch';
import { loadMapLibre } from '@/lib/map/load-maplibre';
import { watchMapFailure } from '@/lib/map/map-failure';
import { mapGestureOptions } from '@/lib/map/map-gestures';
import { MAP_LOCALE_JA } from '@/lib/map/locale-ja';
import { MAP_STYLE_URL } from '@/lib/map/map-config';
import { trekGeo } from '@/lib/map/trek-geo';

// 色は app/globals.css のトークンと同じ値（地図の描画は CSS の変数を読めないため、値で持つ）
const TEAL_DARK = '#0e7f83';
const LINE_GRAY = '#b8c4c8';
const GOLD = '#f5b301';
const WHITE = '#ffffff';

// 日本縦断（F-28）の地図。走る画面（RouteMap）と同じ本物の地図の上に、ルートと今いる地点を描く。
// MapLibre は大きく WebGL が要るので、画面に出るときに読み込む。出せない環境では、地図の代わりに理由を一言出す（文章と数字は上に出ている）
export const TREK_ANCHOR_ID = 'japan-trek';
export const SCROLL_FALLBACK_MS = 4000;

export function JapanMap({ pos }: { pos: RoutePosition }) {
  const container = useRef<HTMLDivElement>(null);
  const [failed, setFailed] = useState(false);

  // URL が #japan-trek のとき（ラン画面の「日本地図で見る」から来たとき）は、振り返り画面の途中にあるこの地図まで自分で動く。
  // 画面のデータが届いてから地図が出るため、ブラウザ任せのハッシュ移動では間に合わない。
  // 地図を描き終えてから（描けなかったときは代替表示にして）動く。どちらも来ないときのために、一定時間で動く保険も置く（L6）
  const scrolled = useRef(false);
  const scrollToTrek = useCallback(() => {
    if (scrolled.current || window.location.hash !== `#${TREK_ANCHOR_ID}`) return;
    scrolled.current = true;
    document.getElementById(TREK_ANCHOR_ID)?.scrollIntoView({ block: 'start' });
  }, []);
  useEffect(() => {
    const t = setTimeout(scrollToTrek, SCROLL_FALLBACK_MS);
    return () => clearTimeout(t);
  }, [scrollToTrek]);
  useEffect(() => {
    if (failed) scrollToTrek();
  }, [failed, scrollToTrek]);

  useEffect(() => {
    let cancelled = false;
    let map: { remove: () => void } | undefined;

    (async () => {
      try {
        const { Map, NavigationControl } = await loadMapLibre();
        if (cancelled || !container.current) return;
        // 日本全体（鹿児島〜稚内）が入る範囲で始める。作ってから合わせると、画面の大きさが決まる前の値で合わせてしまうことがある
        const lngs = JAPAN_ROUTE.map((r) => r.lng);
        const lats = JAPAN_ROUTE.map((r) => r.lat);
        const m = new Map({
          container: container.current,
          style: MAP_STYLE_URL,
          bounds: [
            [Math.min(...lngs), Math.min(...lats)],
            [Math.max(...lngs), Math.max(...lats)],
          ],
          fitBoundsOptions: { padding: { top: 32, bottom: 72, left: 28, right: 28 } }, // 下は、右下の出典の表示に鹿児島が隠れないよう広く
          ...mapGestureOptions(), // PC は Ctrl+ホイール、触る端末は1本指がページのスクロール（L7）
          locale: MAP_LOCALE_JA, // 操作案内を日本語に（A07-9）
          attributionControl: { compact: true },
        });
        map = m;
        // スタイルやタイルが取れないとき（L13）は、代替表示（日本の線画）に切り替える
        watchMapFailure(m, () => {
          map?.remove();
          map = undefined;
          if (!cancelled) setFailed(true);
        });
        m.addControl(new NavigationControl({ showCompass: false }), 'top-right');
        m.on('load', () => {
          const geo = trekGeo(pos);
          m.addSource('all', { type: 'geojson', data: geo.all });
          m.addLayer({ id: 'all-line', type: 'line', source: 'all', layout: { 'line-cap': 'round', 'line-join': 'round' }, paint: { 'line-color': LINE_GRAY, 'line-width': 5 } });
          m.addSource('done', { type: 'geojson', data: geo.done });
          m.addLayer({ id: 'done-line', type: 'line', source: 'done', layout: { 'line-cap': 'round', 'line-join': 'round' }, paint: { 'line-color': TEAL_DARK, 'line-width': 6 } });
          m.addSource('cities', { type: 'geojson', data: geo.cities });
          m.addLayer({
            id: 'cities',
            type: 'circle',
            source: 'cities',
            paint: { 'circle-radius': 4.5, 'circle-color': WHITE, 'circle-stroke-color': TEAL_DARK, 'circle-stroke-width': 2 },
          });
          m.addSource('here', { type: 'geojson', data: geo.here });
          m.addLayer({ id: 'here', type: 'circle', source: 'here', paint: { 'circle-radius': 9, 'circle-color': GOLD, 'circle-stroke-color': WHITE, 'circle-stroke-width': 3 } });
          scrollToTrek(); // 線と今いる地点を描いてから、地図の位置へ動く（L6）
        });
      } catch {
        if (!cancelled) setFailed(true);
      }
    })();

    return () => {
      cancelled = true;
      map?.remove();
    };
  }, [pos, scrollToTrek]);

  // id は、ラン画面の「日本地図で見る」（/me#japan-trek）の着地先の印（A07-6）
  return (
    <div id={TREK_ANCHOR_ID} className="scroll-mt-4">
      {failed ? (
        <div role="status" className="mt-2 space-y-2 rounded-fl bg-canvas px-4 py-3">
          <p className="text-sm font-bold text-fg-muted">地図は この端末では出せませんでした。距離と次の町は上に出ています</p>
          <RouteSketch
            label="日本縦断の線画。鹿児島から北へ進んだぶんが濃い線"
            lines={[
              { coords: JAPAN_ROUTE.map((r) => [r.lng, r.lat]), color: LINE_GRAY, width: 4 },
              { coords: trekGeo(pos).done.geometry.coordinates, color: TEAL_DARK, width: 5 },
            ]}
            dots={[{ coord: [pos.lng, pos.lat], color: GOLD, r: 7 }]}
          />
        </div>
      ) : (
        <div
          ref={container}
          role="img"
          aria-label={`走った距離ぶん、鹿児島から北へ進んだ位置。いまは${pos.name}のあたり`}
          className="mt-2 h-96 overflow-hidden rounded-fl"
        />
      )}
    </div>
  );
}
