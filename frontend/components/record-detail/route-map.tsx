'use client';

import 'maplibre-gl/dist/maplibre-gl.css';
import { useEffect, useRef, useState } from 'react';
import { loadMapLibre } from '@/lib/map/load-maplibre';
import { MAP_STYLE_URL } from '@/lib/map/map-config';
import { mergeBounds, routeBounds, routeEnds, routeLine, type RouteLike } from '@/lib/map/route-geo';
import { DETAIL_MESSAGES } from '@/lib/messages';

// 色は app/globals.css のトークンと同じ値（地図の描画は CSS の変数を読めないため、値で持つ）
const TEAL_DARK = '#0e7f83';
const TEAL = '#17a2a6';
const CORAL = '#ff6b5b';
const GHOST_GRAY = '#8a9aa0'; // 前回のルート（点線）。今回の線より控えめな色
const WHITE = '#ffffff';

// S-21 のランに出すルートの地図（F-15・docs/features.md 2.10）。ルートの線とスタート・ゴールの点を描き、全体が入るよう範囲を合わせる。
// MapLibre は大きく、WebGL が要るので、画面に出るときに読み込む（動的 import。静的書き出しの最初の読み込みを重くしない）。
// 地図を出せない環境では、地図の代わりに理由を一言出す（距離・ペースの数字は上に出ている。削る順④の形）
export function RouteMap({ route, ghost }: { route: RouteLike; ghost?: RouteLike }) {
  const container = useRef<HTMLDivElement>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    let map: { remove: () => void } | undefined;

    (async () => {
      try {
        const { Map, NavigationControl } = await loadMapLibre();
        if (cancelled || !container.current) return;
        const m = new Map({
          container: container.current,
          style: MAP_STYLE_URL,
          // 縦に長いページの中の地図が、指のスクロールを奪わないよう、二本指で動かす
          cooperativeGestures: true,
          attributionControl: { compact: true },
        });
        map = m;
        m.addControl(new NavigationControl({ showCompass: false }), 'top-right');
        m.on('load', () => {
          // 前回のルート（F-17）は今回の線より先に足す＝下に描く。点線の灰色で、スタート・ゴールの点は付けない
          if (ghost) {
            m.addSource('ghost', { type: 'geojson', data: routeLine(ghost) });
            m.addLayer({
              id: 'ghost-line',
              type: 'line',
              source: 'ghost',
              layout: { 'line-cap': 'butt', 'line-join': 'round' },
              paint: { 'line-color': GHOST_GRAY, 'line-width': 4, 'line-dasharray': [2, 2] },
            });
          }
          m.addSource('route', { type: 'geojson', data: routeLine(route) });
          m.addLayer({
            id: 'route-line',
            type: 'line',
            source: 'route',
            layout: { 'line-cap': 'round', 'line-join': 'round' },
            paint: { 'line-color': TEAL_DARK, 'line-width': 5 },
          });
          m.addSource('route-ends', { type: 'geojson', data: routeEnds(route) });
          m.addLayer({
            id: 'route-ends',
            type: 'circle',
            source: 'route-ends',
            paint: {
              'circle-radius': 7,
              'circle-color': ['match', ['get', 'kind'], 'start', TEAL, CORAL],
              'circle-stroke-color': WHITE,
              'circle-stroke-width': 3,
            },
          });
          // 点が少ない・短いルートで寄りすぎないよう maxZoom を決める
          m.fitBounds(ghost ? mergeBounds(routeBounds(route), routeBounds(ghost)) : routeBounds(route), { padding: 32, maxZoom: 16, animate: false });
        });
      } catch {
        if (!cancelled) setFailed(true);
      }
    })();

    return () => {
      cancelled = true;
      map?.remove();
    };
  }, [route, ghost]);

  if (failed) {
    return (
      <p role="status" className="fl-slab px-4 py-3 text-sm font-bold text-sub-strong">
        {DETAIL_MESSAGES.mapUnavailable}
      </p>
    );
  }
  return <div ref={container} role="img" aria-label={ghost ? DETAIL_MESSAGES.mapLabelWithGhost : DETAIL_MESSAGES.mapLabel} className="fl-slab h-56 overflow-hidden" />;
}
