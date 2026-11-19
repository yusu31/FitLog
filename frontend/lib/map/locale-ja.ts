// MapLibre の操作案内は英語が既定（「Use Ctrl + scroll to zoom the map」など）。Map の locale オプションで日本語にする。
// キーは MapLibre の既定の locale のキー（maplibre-gl の src/ui/default_locale.ts）
export const MAP_LOCALE_JA = {
  'CooperativeGesturesHandler.WindowsHelpText': 'Ctrl を押しながらスクロールすると、地図を拡大・縮小できます',
  'CooperativeGesturesHandler.MacHelpText': '⌘ を押しながらスクロールすると、地図を拡大・縮小できます',
  'CooperativeGesturesHandler.MobileHelpText': '2本指で地図を動かせます',
  'NavigationControl.ZoomIn': '拡大',
  'NavigationControl.ZoomOut': '縮小',
  'AttributionControl.ToggleAttribution': '出典を表示・非表示',
  'AttributionControl.MapFeedback': '地図の誤りを知らせる',
} as const;
