import { FORBIDDEN_WORDS } from '@/lib/forbidden-words';
import { MAP_LOCALE_JA } from './locale-ja';

// A07-9: MapLibre の操作案内（Use Ctrl + scroll to zoom the map など）は英語が既定。日本語にそろえる
describe('MAP_LOCALE_JA（地図の操作案内）', () => {
  it('二本指・Ctrl+スクロール・⌘+スクロールの案内と、ズームボタンの名前が日本語になっている', () => {
    expect(MAP_LOCALE_JA['CooperativeGesturesHandler.WindowsHelpText']).toContain('Ctrl');
    expect(MAP_LOCALE_JA['CooperativeGesturesHandler.MacHelpText']).toContain('⌘');
    expect(MAP_LOCALE_JA['CooperativeGesturesHandler.MobileHelpText']).toContain('2本指');
    expect(MAP_LOCALE_JA['NavigationControl.ZoomIn']).toBe('拡大');
    expect(MAP_LOCALE_JA['NavigationControl.ZoomOut']).toBe('縮小');
  });
  it('英語の既定文が残っていない（Use / zoom / map を含まない）', () => {
    for (const v of Object.values(MAP_LOCALE_JA)) expect(v).not.toMatch(/\b(Use|zoom|map|Zoom)\b/);
  });
  it('責める言葉を使わない', () => {
    const all = Object.values(MAP_LOCALE_JA).join('\n');
    for (const w of FORBIDDEN_WORDS) expect(all).not.toContain(w);
  });
});
