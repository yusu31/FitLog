"""v8 のキャラ（10ポーズ・28コマ）の画像を、LPC の部品から作り直す。

素材: ../../assets/lpc/{部品}/{動き}.png（LPC。帰属表示だけが条件のライセンスを選んで使用。作者は assets/lpc/CREDITS.md）
出力: ../../assets/lpc-frames/{ポーズ}_{コマ番号}.png（64x64・背景透明・足元に紺20%の楕円の影つき）

やっていること:
  1. 部品（体・頭・靴・ズボン・Tシャツ・髪）を、輝度を保ったまま指定色に染めて重ねる（パレット置換）
  2. 正面向きの行（3行目）から、動きごとのコマを切り出す
  3. 足りない動き・小物（ダンベル・マグ・クッション・星・ハート・太陽・後光・メダル）を、1マスずつ点で描き足す

使い方（Python 3 と Pillow が要る）: python -I -X utf8 build_frames.py
"""
import math
import os
from pathlib import Path
from PIL import Image, ImageDraw

HERE = Path(__file__).resolve().parent
SRC = HERE.parent.parent / "assets" / "lpc"
OUT = HERE.parent.parent / "assets" / "lpc-frames"

TEAL = (23, 162, 166); NAVY = (30, 42, 58); HAIR = (60, 42, 32); SHOE = (235, 235, 235)
GOLD = (255, 194, 26); GOLD2 = (196, 140, 10); PINK = (255, 122, 154); WHITE = (255, 255, 255)
GRAY1 = (112, 120, 132); GRAY2 = (168, 176, 188)
LAV = (150, 138, 230); LAVL = (190, 180, 246); LAVD = (120, 106, 205)
MUG = (247, 236, 216); STEAM = (232, 236, 242)
FRONT_ROW = 2  # 4方向のうち正面向きの行


def tint(im, rgb, lo=0.35):
    """グレーの元絵を、明るさ（輝度）を保ったまま rgb に染める。"""
    im = im.convert("RGBA"); px = im.load()
    for y in range(im.height):
        for x in range(im.width):
            r, g, b, a = px[x, y]
            if a == 0:
                continue
            k = lo + (1 - lo) * (r * 299 + g * 587 + b * 114) / 255000
            px[x, y] = tuple(min(255, int(c * k * 1.15)) for c in rgb) + (a,)
    return im


def build(sex, hair, anim):
    """体・頭・靴・ズボン・Tシャツ・髪を重ねた1枚のシート（染め済み）。"""
    s = "male" if sex == "male" else "thin"
    layers = [(f"body/bodies/{sex}", None), (f"head/heads/human/{sex}", None), (f"feet/shoes/basic/{s}", SHOE),
              (f"legs/shorts/shorts/{s}", NAVY), (f"torso/clothes/shortsleeve/tshirt/{sex}", TEAL), (f"hair/{hair}/adult", HAIR)]
    base = Image.open(SRC / layers[0][0] / f"{anim}.png").convert("RGBA")
    out = Image.new("RGBA", base.size)
    for part, color in layers:
        im = Image.open(SRC / part / f"{anim}.png").convert("RGBA")
        out.alpha_composite(tint(im, color) if color else im)
    return out


def cell(sheet, k):
    return sheet.crop((k * 64, FRONT_ROW * 64, k * 64 + 64, FRONT_ROW * 64 + 64))


SHEETS = {a: build("male", "buzzcut", a) for a in ("idle", "emote", "sit", "jump", "run")}
GROUND = cell(SHEETS["idle"], 0).getbbox()[3] - 1  # 足元の高さ（影の位置）


def pose(anim, k, back=None, front=None):
    """1コマ: （後光など）→ 足元の影 → キャラ → （小物）。"""
    out = Image.new("RGBA", (64, 64))
    if back:
        out.alpha_composite(back)
    ImageDraw.Draw(out).ellipse((32 - 13, GROUND - 2, 32 + 13, GROUND + 3), fill=NAVY + (51,))
    out.alpha_composite(cell(SHEETS[anim], k))
    if front:
        front(ImageDraw.Draw(out))
    return out


# ---- 描き足す小物 ----
def dumbbell(d, cx, cy):
    """横向きのダンベル: 両端の重り 3x5 とバー 5x1。紺の1マスの縁取り。"""
    d.rectangle((cx - 6, cy - 3, cx - 2, cy + 3), fill=NAVY); d.rectangle((cx + 2, cy - 3, cx + 6, cy + 3), fill=NAVY)
    d.rectangle((cx - 2, cy - 1, cx + 2, cy + 1), fill=NAVY)
    d.rectangle((cx - 5, cy - 2, cx - 3, cy + 2), fill=GRAY1); d.rectangle((cx + 3, cy - 2, cx + 5, cy + 2), fill=GRAY1)
    d.rectangle((cx - 2, cy, cx + 2, cy), fill=GRAY2)
    d.point((cx - 5, cy - 2), fill=GRAY2); d.point((cx + 3, cy - 2), fill=GRAY2)


def plus(d, x, y, big, c=GOLD):
    """十字の星。大は腕が2マス、小は1マス。"""
    d.point((x, y), fill=c)
    for k in range(1, (2 if big else 1) + 1):
        for dx, dy in ((k, 0), (-k, 0), (0, k), (0, -k)):
            d.point((x + dx, y + dy), fill=c)


def heart(d, x, y):
    for j, row in enumerate(['.XX.XX.', 'XXXXXXX', 'XXXXXXX', '.XXXXX.', '..XXX..', '...X...']):
        for i, ch in enumerate(row):
            if ch == 'X':
                d.point((x + i, y + j), fill=PINK)
    d.point((x + 1, y + 1), fill=WHITE); d.point((x + 2, y + 1), fill=WHITE)


def sun(d, x, y):
    for dx in range(-1, 2):
        for dy in range(-1, 2):
            d.point((x + dx, y + dy), fill=GOLD)
    for dx, dy in ((0, -3), (0, 3), (-3, 0), (3, 0), (2, 2), (-2, -2), (2, -2), (-2, 2)):
        d.point((x + dx, y + dy), fill=GOLD)


def rays(rot):
    im = Image.new("RGBA", (64, 64)); d = ImageDraw.Draw(im)
    for i in range(10):
        a = math.radians(rot + i * 36)
        d.line((32 + 15 * math.cos(a), 34 + 15 * math.sin(a), 32 + 30 * math.cos(a), 34 + 30 * math.sin(a)), fill=GOLD + (95,), width=2)
    return im


def relax(steam, eye):
    """くつろぎ: 体育座り（正面）＋ラベンダーのクッション＋マグ＋湯気。eye 1=半目 2=閉じ。"""
    out = Image.new("RGBA", (64, 64)); d = ImageDraw.Draw(out)
    d.ellipse((13, 50, 51, 63), fill=LAVD); d.ellipse((13, 48, 51, 61), fill=LAV); d.ellipse((19, 50, 45, 57), fill=LAVL)
    g = cell(SHEETS["sit"], 2).copy(); p = g.load()
    skin = p[31, 27] if p[31, 27][3] else (245, 207, 166, 255)
    if eye >= 1:                                  # 半目: 瞳の上の行を肌色で塗る
        for x in (26, 29, 34, 37):
            p[x, 27] = skin
    if eye >= 2:                                  # 閉じ: 2行を肌色にして、下まぶたの線だけ残す
        for x in list(range(25, 31)) + list(range(33, 39)):
            p[x, 28] = skin
        for x in (26, 27, 28, 29, 34, 35, 36, 37):
            p[x, 28] = (60, 42, 32, 255)
    out.alpha_composite(g); d = ImageDraw.Draw(out)
    d.rectangle((31, 41, 35, 45), fill=MUG); d.rectangle((31, 41, 35, 41), fill=NAVY); d.rectangle((31, 45, 35, 45), fill=NAVY)
    d.point([(30, 42), (30, 43), (30, 44), (36, 42), (36, 44), (37, 43)], fill=NAVY)       # 縁とハンドル
    for q in ([(33, 40), (34, 39), (33, 38), (34, 37)] if steam == 0 else [(34, 40), (33, 39), (34, 38), (33, 37)]):
        d.point(q, fill=STEAM)
    return out


def with_stars(big_left):
    def f(d):
        plus(d, 15, 8, big_left); plus(d, 49, 6, not big_left)
    return f


def pb(rot, big):
    def f(d):
        d.rectangle((30, 36, 32, 38), fill=GOLD2); d.rectangle((31, 37, 31, 37), fill=GOLD)   # 胸の金メダル
        plus(d, 13, 10, big); plus(d, 51, 9, not big); plus(d, 32, 4, big)
    return pose("emote", 2, back=rays(rot), front=f)


POSES = {
    "idle":    [pose("idle", 0), pose("idle", 1)],
    "ready":   [pose("idle", 0, front=lambda d: dumbbell(d, 43, 45)), pose("idle", 1, front=lambda d: dumbbell(d, 43, 44))],
    "train":   [pose("idle", 0, front=lambda d: [dumbbell(d, 20, 45), dumbbell(d, 43, 45)]),
                pose("jump", 1, front=lambda d: [dumbbell(d, 20, 47), dumbbell(d, 43, 47)])],
    "cheer":   [pose("emote", 2, front=with_stars(True)), pose("jump", 2, front=with_stars(False))],
    "stretch": [pose("emote", k) for k in (0, 1, 2)],
    "relax":   [relax(0, 1), relax(1, 1), relax(0, 2)],
    "welcome": [pose("jump", 3, front=lambda d: sun(d, 52, 9)), pose("idle", 1, front=lambda d: sun(d, 52, 9))],
    "react":   [pose("emote", 1, front=lambda d: heart(d, 40, 6)), pose("emote", 0, front=lambda d: heart(d, 40, 3))],
    "run":     [pose("run", k) for k in range(8)],
    "pb":      [pb(0, True), pb(18, False)],
}

if __name__ == "__main__":
    OUT.mkdir(parents=True, exist_ok=True)
    n = 0
    for name, frames in POSES.items():
        for i, im in enumerate(frames):
            im.save(OUT / f"{name}_{i}.png"); n += 1
    print(f"{len(POSES)} ポーズ・{n} コマを {OUT} に書き出した")
