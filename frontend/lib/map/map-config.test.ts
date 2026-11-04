import { describe, expect, it } from 'vitest';
import { OPENFREEMAP_STYLE_URL, resolveMapStyleUrl } from './map-config';

// 地図スタイルの URL は1か所（map-config.ts）。環境変数で上書きでき、おかしな値は既定に戻す
describe('resolveMapStyleUrl', () => {
  it('指定が無ければ開発用の既定（OpenFreeMap）', () => {
    expect(resolveMapStyleUrl(undefined)).toBe(OPENFREEMAP_STYLE_URL);
    expect(OPENFREEMAP_STYLE_URL).toMatch(/^https:\/\/tiles\.openfreemap\.org\/styles\//);
  });

  it.each([[''], ['   ']])('空（%j）は既定', (value) => {
    expect(resolveMapStyleUrl(value)).toBe(OPENFREEMAP_STYLE_URL);
  });

  it('https の URL はそのまま使う（前後の空白は除く）', () => {
    expect(resolveMapStyleUrl(' https://example.com/map/style.json ')).toBe('https://example.com/map/style.json');
  });

  it('同じサイトの相対パス（自前配信。CloudFront の下）もそのまま使う', () => {
    expect(resolveMapStyleUrl('/map/style.json')).toBe('/map/style.json');
  });

  it.each([['http://example.com/style.json'], ['javascript:alert(1)'], ['style.json'], ['//evil.example/style.json']])(
    '安全でない・読めない値（%j）は既定に戻す',
    (value) => {
      expect(resolveMapStyleUrl(value)).toBe(OPENFREEMAP_STYLE_URL);
    },
  );
});
