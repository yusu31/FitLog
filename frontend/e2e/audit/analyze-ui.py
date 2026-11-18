"""1b UI 一貫性の判定（実施要領 7章 P1-1b の基準）。ui.audit.ts が撮った JSON を読み、基準どおりに判定する。
使い方: python -X utf8 e2e/audit/analyze-ui.py [出力JSONのパス]   （P5 でそのまま再実行して前後を比べる）
基準（実施前に固定）:
  色    : globals.css のパレット（白・黒含む）の外の色。不透明度違いは許す（RGB が近ければ同色）
  字    : 同じ役割（タグ×操作可否）で画面間の大きさがばらつく／全体の種類数
  位置  : 同じ部品（nav・main）の位置が画面間で 2px を超えてずれる
  タップ: 操作できる要素の短辺 < 24px は違反、< 44px は推奨未満
  対比  : 文字 4.5:1（大きい文字 3:1）。背景は DOM 順で直前の「rect を含む不透明背景」で近似
  リフロー: overflowX > 0、または要素が画面幅の外へはみ出す（195 幅=200%・320 幅）
"""
import glob, json, math, os, re, sys, collections

ROOT = os.path.join(os.path.dirname(__file__), 'out', 'ui')
PALETTE_HEX = ['17a2a6', '0e7f83', '0a5f62', 'd5f0f1', 'ffc21a', 'd99a00', 'fff3cc', 'ff6b5b', 'd94a3b', 'c23b2d', 'ffe4e0',
               '8e7cf0', '6a57cf', '1e2a3a', '6b7280', '4b5563', 'f4f6f8', 'e5e7eb', 'c9cdd3', 'ffffff', '000000']
PALETTE = [tuple(int(h[i:i + 2], 16) for i in (0, 2, 4)) for h in PALETTE_HEX]


def lin(c):
    c /= 255
    return c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4


def srgb(v):
    v = max(0, min(1, v))
    return 255 * (12.92 * v if v <= 0.0031308 else 1.055 * v ** (1 / 2.4) - 0.055)


def parse(s):
    """色文字列 → (r,g,b,a)。rgb/rgba/oklab/oklch に対応。"""
    s = s.strip()
    m = re.match(r'rgba?\(([^)]+)\)', s)
    if m:
        p = [x for x in re.split(r'[ ,/]+', m.group(1)) if x]
        a = float(p[3]) if len(p) > 3 else 1.0
        return (float(p[0]), float(p[1]), float(p[2]), a)
    m = re.match(r'ok(lab|lch)\(([^)]+)\)', s)
    if m:
        p = [x for x in re.split(r'[ /]+', m.group(2).strip()) if x]
        L, A, B = float(p[0]), float(p[1]), float(p[2])
        if m.group(1) == 'lch':
            A, B = A * math.cos(math.radians(B)), A * math.sin(math.radians(B))
            # oklch は (L C h)。上で A=C, B=h として扱ったので入れ替え済み
        a = float(p[3]) if len(p) > 3 else 1.0
        l_ = L + 0.3963377774 * A + 0.2158037573 * B
        m_ = L - 0.1055613458 * A - 0.0638541728 * B
        s_ = L - 0.0894841775 * A - 1.2914855480 * B
        l3, m3, s3 = l_ ** 3, m_ ** 3, s_ ** 3
        r = 4.0767416621 * l3 - 3.3077115913 * m3 + 0.2309699292 * s3
        g = -1.2684380046 * l3 + 2.6097574011 * m3 - 0.3413193965 * s3
        b = -0.0041960863 * l3 - 0.7034186147 * m3 + 1.7076147010 * s3
        return (srgb(r), srgb(g), srgb(b), a)
    return None


def blend(fg, bg):
    a = fg[3]
    return tuple(fg[i] * a + bg[i] * (1 - a) for i in range(3)) + (1.0,)


def lum(c):
    return 0.2126 * lin(c[0]) + 0.7152 * lin(c[1]) + 0.0722 * lin(c[2])


def ratio(a, b):
    x, y = lum(a), lum(b)
    if x < y:
        x, y = y, x
    return (x + 0.05) / (y + 0.05)


def near_palette(c, tol=6):
    return any(max(abs(c[i] - p[i]) for i in range(3)) <= tol for p in PALETTE)


def px(s):
    try:
        return float(s.replace('px', ''))
    except ValueError:
        return 0.0


def contains(outer, inner):
    return outer[0] - 1 <= inner[0] and outer[1] - 1 <= inner[1] and outer[0] + outer[2] + 1 >= inner[0] + inner[2] and outer[1] + outer[3] + 1 >= inner[1] + inner[3]


def load():
    for path in sorted(glob.glob(os.path.join(ROOT, '*', '*', '*.json'))):
        parts = path.replace('\\', '/').split('/')
        state, vp, screen = parts[-3], parts[-2], os.path.splitext(parts[-1])[0]
        with open(path, encoding='utf-8') as f:
            yield state, vp, screen, json.load(f)


def main():
    res = collections.defaultdict(list)
    off_colors = collections.defaultdict(set)
    sizes_by_role = collections.defaultdict(lambda: collections.defaultdict(set))
    all_sizes = collections.Counter()
    fonts = collections.Counter()
    nav = collections.defaultdict(set)
    n_screens = 0
    for state, vp, screen, d in load():
        n_screens += 1
        key = f'{state}/{vp}/{screen}'
        vw = int(vp.split('x')[0])
        els = d['elements']
        # リフロー
        if d['overflowX'] > 0:
            res['reflow-overflow'].append((key, d['overflowX']))
        if vp in ('195x422-x2', '320x568'):
            outs = [e for e in els if e['rect'][0] + e['rect'][2] > vw + 1 or e['rect'][0] < -1]
            for e in outs[:5]:
                res['reflow-element'].append((key, f"{e['tag']}「{e['text']}」 x={e['rect'][0]} w={e['rect'][2]}"))
        # 位置（390 幅縦・active のみで比べる）
        if vp == '390x844' and state == 'active' and screen not in ('login', 'signup', 'invite-invalid', 'record', 'record-result-sheet', 'record-detail'):
            for a in ('nav', 'main'):
                r = d['anchors'].get(a)
                if r:
                    nav[a].add((screen, tuple(r[:3]) if a == 'nav' else (r[0], r[2])))
        bgstack = []  # (rect, rgb)
        for e in els:
            fg = parse(e['color'])
            bg = parse(e['background'])
            r = e['rect']
            if bg and bg[3] > 0.01:
                base = bgstack[-1][1] if bgstack else (255, 255, 255, 1.0)
                bgstack.append((r, blend(bg, base)))
                if not near_palette(bg):
                    off_colors[('bg', tuple(round(x) for x in bg[:3]))].add(key)
            # 直前の「rect を含む」背景
            eff = (255, 255, 255, 1.0)
            for br, bc in reversed(bgstack):
                if contains(br, r):
                    eff = bc
                    break
            if e['text'] and fg:
                if not near_palette(fg):
                    off_colors[('text', tuple(round(x) for x in fg[:3]))].add(key)
                fs = px(e['fontSize'])
                bold = int(e['fontWeight']) >= 700
                large = fs >= 24 or (fs >= 18.66 and bold)
                cr = ratio(blend(fg, eff), eff)
                need = 3.0 if large else 4.5
                if cr < 1.05:
                    res['contrast-unknown-bg'].append((key, f"{e['tag']}「{e['text']}」"))  # 背景が画像・グラデーションで色を拾えない（目視で確認する）
                elif cr < need:
                    hx = lambda c: '#%02x%02x%02x' % tuple(round(x) for x in c[:3])
                    res['contrast'].append((key, f"{e['tag']}「{e['text']}」 {cr:.2f}:1 (必要 {need}) {fs:g}px 字{hx(blend(fg, eff))} 背景{hx(eff)}"))
                role = f"{e['tag']}{'*' if e['interactive'] else ''}"
                sizes_by_role[role][e['fontSize']].add(screen)
                all_sizes[e['fontSize']] += 1
                fonts[e['fontFamily']] += 1
            if e['interactive'] and r[2] > 2 and r[3] > 2:
                short = min(r[2], r[3])
                if short < 24:
                    res['tap-under24'].append((key, f"{e['tag']}「{e['text']}」 {r[2]}x{r[3]}"))
                elif short < 44 and vp == '390x844':
                    res['tap-under44'].append((key, f"{e['tag']}「{e['text']}」 {r[2]}x{r[3]}"))
    # 位置のずれ
    for a, vals in nav.items():
        distinct = collections.defaultdict(list)
        for screen, v in vals:
            distinct[v].append(screen)
        if len(distinct) > 1:
            res['position-shift'].append((a, '; '.join(f'{v}: {",".join(s)}' for v, s in distinct.items())))
    # 出力
    out = {
        'screens': n_screens,
        'colors_off_palette': [{'kind': k[0], 'rgb': k[1], 'screens': sorted(v)[:6], 'count': len(v)} for k, v in sorted(off_colors.items())],
        'font_sizes_total': len(all_sizes),
        'font_sizes': dict(all_sizes.most_common()),
        'fonts': dict(fonts),
        'sizes_by_role': {r: {s: sorted(v)[:4] for s, v in sz.items()} for r, sz in sizes_by_role.items()},
        'violations': {k: [list(x) for x in v] for k, v in res.items()},
    }
    dest = sys.argv[1] if len(sys.argv) > 1 else os.path.join(ROOT, '..', 'ui-result.json')
    with open(dest, 'w', encoding='utf-8') as f:
        json.dump(out, f, ensure_ascii=False, indent=1)
    print(f'画面数: {n_screens}  文字の大きさの種類: {len(all_sizes)}  フォント: {dict(fonts)}')
    print('パレット外の色:', len(off_colors))
    for k, v in sorted(off_colors.items()):
        print('  ', k, f'{len(v)}画面', sorted(v)[:2])
    for k, v in res.items():
        print(f'{k}: {len(v)}件')
        seen = set()
        for x in v:
            sig = x[1] if k not in ('contrast', 'tap-under24', 'tap-under44') else re.sub(r'^\S+/\S+/', '', x[0]) + x[1]
            if sig in seen:
                continue
            seen.add(sig)
            if len(seen) <= 8:
                print('   ', x)


if __name__ == '__main__':
    main()
