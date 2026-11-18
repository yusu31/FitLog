'use client';

import 'maplibre-gl/dist/maplibre-gl.css';
import { useEffect, useRef, useState } from 'react';
import { JAPAN_ROUTE, type RoutePosition } from '@/lib/japan-route';
import { loadMapLibre } from '@/lib/map/load-maplibre';
import { MAP_STYLE_URL } from '@/lib/map/map-config';
import { trekGeo } from '@/lib/map/trek-geo';

// 色は app/globals.css のトークンと同じ値（地図の描画は CSS の変数を読めないため、値で持つ）
const TEAL_DARK = '#0e7f83';
const LINE_GRAY = '#b8c4c8';
const GOLD = '#f5b301';
const WHITE = '#ffffff';

// 日本縦断（F-28）の地図。走る画面（RouteMap）と同じ本物の地図の上に、ルートと今いる地点を描く。
// MapLibre は大きく WebGL が要るので、画面に出るときに読み込む。出せない環境では、地図の代わりに理由を一言出す（文章と数字は上に出ている）
export function JapanMap({ pos }: { pos: RoutePosition }) {
  const container = useRef<HTMLDivElement>(null);
  const [failed, setFailed] = useState(false);

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
          cooperativeGestures: true,
          attributionControl: { compact: true },
        });
        map = m;
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
        });
      } catch {
        if (!cancelled) setFailed(true);
      }
    })();

    return () => {
      cancelled = true;
      map?.remove();
    };
  }, [pos]);

  if (failed) {
    return (
      <p role="status" className="mt-2 rounded-fl bg-face px-4 py-3 text-sm font-bold text-sub-strong">
        地図は この端末では出せませんでした。距離と次の町は上に出ています
      </p>
    );
  }
  return (
    <div
      ref={container}
      role="img"
      aria-label={`走った距離ぶん、鹿児島から北へ進んだ位置。いまは${pos.name}のあたり`}
      className="mt-2 h-96 overflow-hidden rounded-fl"
    />
  );
}
