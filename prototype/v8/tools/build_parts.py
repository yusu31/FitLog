"""キャラ編集（F-32）用に、v8 のキャラを「部品ごとの横長シート」に分けて書き出す。

build_frames.py は「1つの見た目」を28コマの完成画像にした。ここでは同じ28コマを、部品ごとに分けて出す。
画面（frontend/components/fitlog/chara.tsx）が、部品のシートを重ねて好きな組み合わせを描く（実行時の色替えはしない）。

出力: ../../../frontend/public/characters/parts/{部品}.png
  - 各シートは 64px のコマを横に28枚並べたもの（1792×64）。コマの並びは POSE_ORDER（下）
  - skin-{A|B} / shoes-{A|B} / pants-{A|B}-{色} / shirt-{A|B}-{色} / hair-{1..5}-{色} / acc-{小物}-{A|B}
  - outline-{A|B}-{髪型}-{小物}: 紺の1マスの輪郭（体型・髪型・小物で形が変わるので、その組み合わせごと）
  - extras-back / extras-front: 全員共通の足元の影・後光・クッション（back）、ダンベル・星・マグ・湯気など（front）

体型 A=male・B=female。素材は assets/lpc（作者とライセンスは assets/lpc/CREDITS.md。帰属表示だけが条件のものだけを使う）。
使い方（Python 3 と Pillow が要る）: python -I -X utf8 build_parts.py
"""
import sys
from pathlib import Path

from PIL import Image, ImageDraw, ImageOps

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
import build_frames as bf  # noqa: E402  部品の染め・輪郭・小物の描き方を使い回す

SRC = bf.SRC
OUT = HERE.parent.parent.parent / "frontend" / "public" / "characters" / "parts"

SEX = {"A": "male", "B": "female"}
THIN = {"A": "male", "B": "thin"}

HAIR_STYLES = {1: "buzzcut", 2: "natural", 3: "parted_side_bangs", 4: "plain", 5: "spiked"}
HAIR_COLORS = {"brown": (60, 42, 32), "black": (34, 32, 40), "blonde": (214, 170, 72),
               "red": (168, 64, 40), "gray": (150, 152, 160), "blue": (52, 86, 150)}
SHIRT_COLORS = {"teal": (23, 162, 166), "navy": (40, 60, 92), "coral": (224, 86, 70),
                "purple": (120, 100, 220), "gold": (238, 178, 30), "green": (60, 160, 90)}
PANTS_COLORS = {"navy": (30, 42, 58), "black": (36, 36, 42), "gray": (120, 126, 136),
                "khaki": (176, 150, 100), "teal": (23, 130, 134), "maroon": (120, 40, 50)}

# 小物（OGA-BY のものだけ）。パスは体型ごと。tint=染める色（None なら元の色のまま）
ACCESSORIES = {
    "band1": {"A": "hat/headband/thick/adult", "B": "hat/headband/thick/adult", "tint": (220, 64, 64)},
    "band2": {"A": "hat/headband/tied/adult", "B": "hat/headband/tied/adult", "tint": (245, 245, 245)},
    "bandana": {"A": "hat/cloth/bandana/adult", "B": "hat/cloth/bandana/adult", "tint": (60, 120, 220)},
    "bandana2": {"A": "hat/cloth/bandana2/adult", "B": "hat/cloth/bandana2/adult", "tint": (200, 60, 60)},
    "glasses": {"A": "facial/glasses/halfmoon/adult", "B": "facial/glasses/halfmoon/adult", "tint": (60, 66, 80)},
    "wrist": {"A": "arms/wrists/cuffs/male", "B": "arms/wrists/cuffs/thin", "tint": (230, 230, 236)},
}
ACC_IDS = ["none"] + list(ACCESSORIES)

FRONT, SIDE = bf.FRONT_ROW, bf.SIDE_ROW
ANIMS = ("idle", "emote", "sit", "jump", "run")


def frame_specs():
    """28コマの設計図。(ポーズ名, 動き, コマ番号, 行, 足元へ下ろす, 縦ずらし, 左右反転, 後ろの描き足し, 前の描き足し, 目)"""
    P = bf
    s = []
    add = lambda name, anim, k, **kw: s.append(dict(name=name, anim=anim, k=k, row=kw.get("row", FRONT), ground=kw.get("ground", False),
                                                      dy=kw.get("dy", 0), flip=kw.get("flip", False), back=kw.get("back"), front=kw.get("front"),
                                                      eye=kw.get("eye"), shadow=kw.get("shadow", True)))
    add("idle", "idle", 0); add("idle", "idle", 1)
    add("ready", "idle", 0, front=lambda d: P.dumbbell(d, 43, 45)); add("ready", "idle", 1, front=lambda d: P.dumbbell(d, 43, 44))
    add("train", "idle", 0, front=lambda d: [P.dumbbell(d, 20, 45), P.dumbbell(d, 43, 45)])
    add("train", "jump", 1, front=lambda d: [P.dumbbell(d, 20, 47), P.dumbbell(d, 43, 47)])
    stars = lambda big: (lambda d: (P.plus(d, 15, 8, big), P.plus(d, 49, 6, not big)))
    add("cheer", "emote", 2, front=stars(True)); add("cheer", "jump", 2, ground=True, front=stars(False))
    for k in (0, 1, 2):
        add("stretch", "emote", k)
    # くつろぎ: 体育座り＋クッション（影の代わり）＋マグ・湯気。目は半目・半目・閉じ
    for steam, eye in ((0, 1), (1, 1), (0, 2)):
        add("relax", "sit", 2, eye=eye, shadow=False, back="cushion", front=("mug", steam))
    add("welcome", "emote", 2, front=lambda d: P.sun(d, 53, 7)); add("welcome", "idle", 1, front=lambda d: P.sun(d, 53, 7))
    add("react", "jump", 2, ground=True, flip=True, front=lambda d: P.heart(d, 40, 6))
    add("react", "jump", 2, ground=True, flip=True, dy=-1, front=lambda d: P.heart(d, 40, 3))
    for k in range(8):
        add("run", "run", k, row=SIDE)

    def pb_front(big):
        def f(d):
            d.rectangle((30, 36, 32, 38), fill=P.GOLD2); d.rectangle((31, 37, 31, 37), fill=P.GOLD)
            P.plus(d, 13, 10, big); P.plus(d, 51, 9, not big); P.plus(d, 32, 4, big)
        return f
    add("pb", "emote", 2, back=("rays", 0), front=pb_front(True)); add("pb", "emote", 2, back=("rays", 18), front=pb_front(False))
    return s


SPECS = frame_specs()
assert len(SPECS) == 28, len(SPECS)
POSE_ORDER = []
for sp in SPECS:
    if not POSE_ORDER or POSE_ORDER[-1][0] != sp["name"]:
        POSE_ORDER.append([sp["name"], 0])
    POSE_ORDER[-1][1] += 1


def load_sheets(path, color=None, skin=False):
    """部品1つの、動きごとのシート。color を渡すとその色に染める。skin=True は肌の白飛びを直す。"""
    out = {}
    for a in ANIMS:
        im = Image.open(SRC / path / f"{a}.png").convert("RGBA")
        out[a] = bf.warm_skin(im) if skin else (bf.tint(im, color) if color else im)
    return out


def final_dy(sp):
    """足元へ下ろす量は、元の1つの見た目（build_frames の SHEETS）を基準にする（部品が変わっても足元の高さを揃えるため）。"""
    ref = bf.cell(bf.SHEETS[sp["anim"]], sp["k"], sp["row"])
    dy = sp["dy"]
    if sp["ground"]:
        dy += bf.IDLE_BOTTOM - ref.getbbox()[3]
    return dy


DYS = [final_dy(sp) for sp in SPECS]


def place(sheets, sp, dy, eye_fix=None):
    im = bf.cell(sheets[sp["anim"]], sp["k"], sp["row"]).copy()
    if eye_fix:
        eye_fix(im)
    if sp["flip"]:
        im = ImageOps.mirror(im)
    if dy:
        moved = Image.new("RGBA", im.size); moved.paste(im, (0, dy), im); im = moved
    return im


def eye_fixer(level):
    """くつろぎの目。半目: 瞳の上の行を肌色で塗る／閉じ: 2行を肌色にして、下まぶたの線だけ残す（build_frames.relax と同じ）。"""
    def fix(im):
        p = im.load()
        skin = p[31, 27] if p[31, 27][3] else (245, 207, 166, 255)
        if level >= 1:
            for x in (26, 29, 34, 37):
                p[x, 27] = skin
        if level >= 2:
            for x in list(range(25, 31)) + list(range(33, 39)):
                p[x, 28] = skin
            for x in (26, 27, 28, 29, 34, 35, 36, 37):
                p[x, 28] = (60, 42, 32, 255)
    return fix


def strip(frames):
    sheet = Image.new("RGBA", (64 * len(frames), 64))
    for i, im in enumerate(frames):
        sheet.paste(im, (64 * i, 0))
    return sheet


def layer_strip(sheets, skin_eye=False):
    return strip([place(sheets, sp, DYS[i], eye_fixer(sp["eye"]) if (skin_eye and sp["eye"]) else None) for i, sp in enumerate(SPECS)])


def outline_only(im, color=bf.NAVY):
    src = im.load(); out = Image.new("RGBA", im.size); o = out.load()
    for y in range(im.height):
        for x in range(im.width):
            if src[x, y][3]:
                continue
            for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                nx, ny = x + dx, y + dy
                if 0 <= nx < im.width and 0 <= ny < im.height and src[nx, ny][3]:
                    o[x, y] = color + (255,)
                    break
    return out


def extras():
    """全員共通: back=後光・クッション・足元の影／front=ダンベル・星・マグ・湯気など。"""
    backs, fronts = [], []
    for sp in SPECS:
        b = Image.new("RGBA", (64, 64)); f = Image.new("RGBA", (64, 64))
        if sp["back"] == "cushion":
            d = ImageDraw.Draw(b)
            d.ellipse((13, 50, 51, 63), fill=bf.LAVD); d.ellipse((13, 48, 51, 61), fill=bf.LAV); d.ellipse((19, 50, 45, 57), fill=bf.LAVL)
        elif sp["back"]:
            b.alpha_composite(bf.rays(sp["back"][1]))
        if sp["shadow"]:
            ImageDraw.Draw(b).ellipse((32 - 13, bf.GROUND - 2, 32 + 13, bf.GROUND + 3), fill=bf.NAVY + (51,))
        d = ImageDraw.Draw(f)
        if isinstance(sp["front"], tuple):  # マグと湯気（くつろぎ）
            steam = sp["front"][1]
            d.rectangle((31, 41, 35, 45), fill=bf.MUG); d.rectangle((31, 41, 35, 41), fill=bf.NAVY); d.rectangle((31, 45, 35, 45), fill=bf.NAVY)
            d.point([(30, 42), (30, 43), (30, 44), (36, 42), (36, 44), (37, 43)], fill=bf.NAVY)
            for q in ([(33, 40), (34, 39), (33, 38), (34, 37)] if steam == 0 else [(34, 40), (33, 39), (34, 38), (33, 37)]):
                d.point(q, fill=bf.STEAM)
        elif sp["front"]:
            sp["front"](d)
        backs.append(b); fronts.append(f)
    return strip(backs), strip(fronts)


def save(im, name):
    im.save(OUT / f"{name}.png", optimize=True)


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    n = 0
    back, front = extras()
    save(back, "extras-back"); save(front, "extras-front"); n += 2

    parts = {}  # outline 用に、既定の色で重ねた各部品のコマ（体型ごと）
    for body in "AB":
        sex, thin = SEX[body], THIN[body]
        skin_body = load_sheets(f"body/bodies/{sex}", skin=True)
        skin_head = load_sheets(f"head/heads/human/{sex}", skin=True)
        skin = {a: Image.alpha_composite(skin_body[a], skin_head[a]) for a in ANIMS}
        # 肌の層は、体と頭を重ねたあとの絵に目の細工をする（くつろぎ）
        parts[(body, "skin")] = layer_strip(skin, skin_eye=True)
        parts[(body, "shoes")] = layer_strip(load_sheets(f"feet/shoes/basic/{thin}", bf.SHOE))
        pants0 = layer_strip(load_sheets(f"legs/shorts/shorts/{thin}", bf.NAVY))
        shirt0 = layer_strip(load_sheets(f"torso/clothes/shortsleeve/tshirt/{sex}", bf.TEAL))
        parts[(body, "pants")], parts[(body, "shirt")] = pants0, shirt0
        save(parts[(body, "skin")], f"skin-{body}"); save(parts[(body, "shoes")], f"shoes-{body}"); n += 2
        for c, rgb in PANTS_COLORS.items():
            save(layer_strip(load_sheets(f"legs/shorts/shorts/{thin}", rgb)), f"pants-{body}-{c}"); n += 1
        for c, rgb in SHIRT_COLORS.items():
            save(layer_strip(load_sheets(f"torso/clothes/shortsleeve/tshirt/{sex}", rgb)), f"shirt-{body}-{c}"); n += 1
        for a, spec in ACCESSORIES.items():
            st = layer_strip(load_sheets(spec[body], spec["tint"]))
            parts[(body, a)] = st
            save(st, f"acc-{a}-{body}"); n += 1

    for h, hname in HAIR_STYLES.items():
        hair0 = None
        for c, rgb in HAIR_COLORS.items():
            st = layer_strip(load_sheets(f"hair/{hname}/adult", rgb))
            save(st, f"hair-{h}-{c}"); n += 1
            if c == "brown":
                hair0 = st
        for body in "AB":
            for acc in ACC_IDS:
                # 輪郭は、その組み合わせの全部の層を重ねた影絵の外側
                sil = strip([Image.new("RGBA", (64, 64)) for _ in range(28)])
                layers = [parts[(body, "skin")], parts[(body, "shoes")], parts[(body, "pants")], parts[(body, "shirt")]]
                if acc == "wrist":
                    layers.append(parts[(body, acc)])
                layers.append(hair0)
                if acc not in ("none", "wrist"):
                    layers.append(parts[(body, acc)])
                for lyr in layers:
                    sil.alpha_composite(lyr)
                ol = strip([outline_only(sil.crop((64 * i, 0, 64 * i + 64, 64))) for i in range(28)])
                save(ol, f"outline-{body}-{h}-{acc}"); n += 1
    print(f"{n} 枚を {OUT} に書き出した（ポーズ順: {POSE_ORDER}）")


if __name__ == "__main__":
    main()
