import { readFileSync } from 'node:fs';
import { join } from 'node:path';

// V-07: 地図のズームボタン・出典ボタンは、既定だと 29px。指で押せる 44px にそろえる（CSS は見た目なので、書いてある値で確かめる）
const css = readFileSync(join(__dirname, 'map-controls.css'), 'utf-8');

describe('map-controls.css（地図の操作ボタンの大きさ）', () => {
  it('ズームボタンは幅・高さとも 44px', () => {
    expect(css).toMatch(/\.maplibregl-ctrl-group\s+button[^{]*\{[^}]*width:\s*44px/);
    expect(css).toMatch(/\.maplibregl-ctrl-group\s+button[^{]*\{[^}]*height:\s*44px/);
  });
  it('出典（クレジット）のボタンと、出典のリンクの押せる高さも 44px', () => {
    expect(css).toMatch(/\.maplibregl-ctrl-attrib-button[^{]*\{[^}]*width:\s*44px[^}]*height:\s*44px|\.maplibregl-ctrl-attrib-button[^{]*\{[^}]*height:\s*44px[^}]*width:\s*44px/);
    expect(css).toMatch(/\.maplibregl-ctrl-attrib[^{]*\ba\s*\{[^}]*min-height:\s*44px/);
  });
});
