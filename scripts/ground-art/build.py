# 運動場の背景4種（160x90・自作のドット絵）。frontend/public/ground/{yard,gym,park,city}.png を作る。
# 使い方: python scripts/ground-art/build.py（Pillow と pixel-art-studio スキルの pixelstudio.py が要る。下の sys.path は作者の環境の場所）
import sys, random
sys.path.insert(0, "C:/Users/3fort/.claude/skills/pixel-art-studio/scripts")
from pixelstudio import Sprite

W, H = 160, 90
import os
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "..", "frontend", "public", "ground") + os.sep


def sky(s, h, top, mid, low):
    b = h // 3
    s.rect(0, 0, W, b, top)
    s.rect(0, b, W, 2 * b, mid)
    s.rect(0, 2 * b, W, h, low)
    s.dither(0, b - 3, W, b + 2, top, mid, 0.5, pattern="bayer2") if False else None
    s.dither(0, b - 2, W, b + 1, "keep", mid, 0.5)
    s.dither(0, 2 * b - 2, W, 2 * b + 1, "keep", low, 0.5)


def cloud(s, x, y, c1="#ffffff", c2="#dcecf7"):
    s.ellipse(x, y + 3, x + 22, y + 9, c1)
    s.ellipse(x + 5, y, x + 16, y + 8, c1)
    s.ellipse(x + 12, y + 2, x + 28, y + 9, c1)
    s.rect(x + 2, y + 8, x + 26, y + 9, c2)


def tree(s, x, base, r, dark, mid, light, trunk="#6b4426"):
    s.rect(x - 1, base - r, x + 1, base, trunk)
    s.circle(x, base - r - 3, r, dark, fill=True)
    s.circle(x - 1, base - r - 4, r - 2, mid, fill=True)
    s.circle(x - 3, base - r - 6, max(r - 5, 2), light, fill=True)


# ---------------------------------------------------------------- 運動場
def yard():
    s = Sprite(W, H)
    sky(s, 46, "#6cc3ee", "#9bdaf5", "#cdeefa")
    s.circle(128, 14, 7, "#fff3b0", fill=True)
    s.circle(128, 14, 5, "#ffe46e", fill=True)
    cloud(s, 14, 10)
    cloud(s, 70, 20, c2="#cfe3f0")
    # 遠い林
    rng = random.Random(3)
    x = -4
    while x < W + 6:
        r = rng.randint(7, 11)
        s.circle(x, 44, r, "#4f9a52", fill=True)
        s.circle(x - 2, 42, r - 3, "#6cb55f", fill=True)
        x += rng.randint(9, 13)
    s.rect(0, 44, W, 52, "#4f9a52")
    s.dither(0, 44, W, 47, "keep", "#3d7e44", 0.4)
    # フェンス
    s.rect(0, 48, W, 56, "#cfd6dc")
    s.rect(0, 48, W, 48, "#eef2f5")
    s.rect(0, 56, W, 56, "#8d98a2")
    for fx in range(0, W, 6):
        s.line(fx, 49, fx, 55, "#9aa6b0")
    s.rect(0, 53, W, 53, "#aab5be")
    # 観客席のベンチ
    # 土のトラック
    s.rect(0, 57, W, H, "#d9925a")
    s.gradient_dither(0, 57, W, H, ["#c27a47", "#d58a52", "#e3a06a"], axis="v")
    s.noise(0, 57, W, H, "#b8703f", density=0.025, seed=5)
    s.noise(0, 57, W, H, "#efb782", density=0.015, seed=9)
    # 白線（奥ほど細い）
    s.rect(0, 66, W, 66, "#fbf4e6")
    s.rect(0, 77, W, 78, "#fbf4e6")
    s.rect(0, 87, W, 89, "#fbf4e6")
    for y in (66, 77, 87):
        s.dither(0, y + 1, W, y + 1, "keep", "#c27a47", 0.3)
    # スタートの白い縦線
    s.line(24, 67, 18, 89, "#fbf4e6")
    s.line(25, 67, 19, 89, "#fbf4e6")
    # コーン・ハードル
    for cx, cy in ((100, 72), (118, 72), (136, 72)):
        s.polygon([(cx, cy - 6), (cx + 3, cy), (cx - 3, cy)], "#ff7a2f")
        s.rect(cx - 4, cy, cx + 4, cy + 1, "#c9501a")
        s.rect(cx - 1, cy - 3, cx + 1, cy - 3, "#ffffff")
    for hx in (60, 86):
        s.rect(hx, 70, hx + 10, 71, "#ffffff")
        s.rect(hx, 70, hx, 77, "#c43d3d")
        s.rect(hx + 10, 70, hx + 10, 77, "#c43d3d")
    # ゴールのポール旗
    s.rect(148, 50, 148, 66, "#7a828c")
    s.polygon([(149, 50), (158, 53), (149, 56)], "#e8554e")
    return s


# ---------------------------------------------------------------- ジム
def gym():
    s = Sprite(W, H)
    # 壁
    s.rect(0, 0, W, 60, "#4b5563")
    s.gradient_dither(0, 0, W, 60, ["#3b4352", "#4b5563", "#576273"], axis="v")
    for px in range(0, W, 20):
        s.rect(px, 0, px, 60, "#39414f")
    s.rect(0, 52, W, 60, "#2f3642")  # 巾木
    s.rect(0, 52, W, 52, "#6d7889")
    # 鏡
    s.rect(8, 8, 76, 48, "#2a303b")
    s.rect(10, 10, 74, 46, "#a9dff0")
    s.gradient_dither(10, 10, 74, 46, ["#86c8dc", "#a9dff0", "#d4f3fb"], axis="v")
    for i in range(6):
        s.line(20 + i * 12, 46, 36 + i * 12, 10, "#e9fbff", only="#a9dff0") if i % 2 == 0 else None
    s.line(14, 14, 24, 14, "#ffffff")
    s.line(14, 14, 14, 24, "#ffffff")
    # 時計
    s.circle(100, 16, 8, "#2a303b", fill=True)
    s.circle(100, 16, 6, "#f4f1e8", fill=True)
    s.line(100, 16, 100, 11, "#2a303b")
    s.line(100, 16, 104, 17, "#2a303b")
    s.px(100, 16, "#e8554e")
    # ポスター
    s.rect(118, 6, 138, 30, "#f2e6c9")
    s.rect(120, 8, 136, 20, "#e8554e")
    s.rect(122, 22, 134, 23, "#6b4426")
    s.rect(122, 26, 130, 27, "#6b4426")
    s.rect(124, 11, 126, 17, "#f2e6c9")
    s.rect(130, 11, 132, 17, "#f2e6c9")
    s.rect(124, 14, 132, 14, "#f2e6c9")
    # ダンベルラック（右）
    s.rect(120, 36, 156, 52, "#2a303b")
    s.rect(121, 37, 155, 38, "#6b7482")
    s.rect(121, 44, 155, 45, "#6b7482")
    s.rect(121, 51, 155, 52, "#6b7482")
    for i, dx in enumerate(range(123, 154, 6)):
        for ry in (39, 46):
            c = ("#e8554e", "#3a6fd8", "#e0b03a", "#47a86b", "#a35fd0")[(i + ry) % 5]
            s.rect(dx, ry, dx + 4, ry + 4, "#171a20")
            s.rect(dx + 1, ry + 1, dx + 3, ry + 3, c)
    # 床（フローリング）
    s.rect(0, 61, W, H, "#b07a4a")
    s.rect(0, 61, W, 74, "#b47e4d")
    s.rect(0, 75, W, H, "#c08655")
    # 板目
    for y in range(61, H, 7):
        s.rect(0, y, W, y, "#8a5530")
    off = 0
    for y in range(61, H, 7):
        for x in range(off, W, 24):
            s.rect(x, y, x, y + 6, "#8a5530")
        off = (off + 11) % 24
    s.noise(0, 61, W, H, "#d6a06a", density=0.012, seed=2)
    # ヨガマット
    s.polygon([(12, 82), (60, 82), (64, 88), (8, 88)], "#47a86b")
    s.line(8, 88, 64, 88, "#2f7d4c")
    s.line(12, 82, 60, 82, "#7fd9a0")
    # ベンチ（横から）
    s.rect(84, 72, 112, 76, "#2a303b")
    s.rect(85, 72, 111, 73, "#e8554e")
    s.rect(88, 77, 90, 84, "#6b7482")
    s.rect(106, 77, 108, 84, "#6b7482")
    s.rect(86, 84, 92, 85, "#2a303b")
    s.rect(104, 84, 110, 85, "#2a303b")
    # 床のダンベル・プレート
    s.circle(126, 82, 4, "#2a303b", fill=True)
    s.circle(126, 82, 2, "#6b7482", fill=True)
    s.circle(138, 84, 3, "#2a303b", fill=True)
    s.circle(138, 84, 1, "#6b7482", fill=True)
    return s


# ---------------------------------------------------------------- 外
def outdoor():
    s = Sprite(W, H)
    sky(s, 50, "#5fb8ee", "#94d3f4", "#d3f0fb")
    cloud(s, 8, 8)
    cloud(s, 96, 14, c2="#cfe3f0")
    cloud(s, 130, 4, c2="#cfe3f0")
    # 遠い山
    s.polygon([(0, 46), (24, 26), (52, 46)], "#7fb4c8")
    s.polygon([(36, 46), (72, 22), (112, 46)], "#6aa3ba")
    s.polygon([(96, 46), (130, 30), (160, 46)], "#7fb4c8")
        # 丘
    s.ellipse(-30, 42, 90, 80, "#78c26a")
    s.ellipse(50, 46, 200, 84, "#69b45e")
    s.gradient_dither(0, 52, W, H, ["#4f9a4a", "#66b35c", "#7fcb6e"], axis="v", only="empty")
    # 草地
    s.rect(0, 58, W, H, "#6cbb62")
    s.gradient_dither(0, 58, W, H, ["#58a653", "#6cbb62", "#82cf73"], axis="v")
    s.noise(0, 58, W, H, "#4f9a4a", density=0.05, seed=4)
    s.noise(0, 58, W, H, "#9be08a", density=0.03, seed=8)
    # 木
    tree(s, 18, 62, 10, "#2f7d3b", "#47a24d", "#74c96a")
    tree(s, 140, 60, 9, "#2f7d3b", "#47a24d", "#74c96a")
    tree(s, 154, 64, 7, "#2f7d3b", "#47a24d", "#74c96a")
    # 道（ゆるいカーブ）
    s.polygon([(40, 62), (120, 62), (160, 76), (160, 90), (0, 90), (0, 78)], "#d9b988")
    s.rect(0, 80, W, H, "#e2c595", only="#d9b988")
    s.noise(0, 62, W, H, "#b8935f", density=0.05, seed=6, only="#dcbd8c")
    s.line(0, 78, 40, 62, "#a98457")
    s.line(160, 76, 120, 62, "#a98457")
    # 花
    rng = random.Random(11)
    for _ in range(16):
        fx, fy = rng.randint(2, 156), rng.randint(64, 88)
        if s.get(fx, fy)[:3] == (0xd9, 0xb9, 0x88):
            continue
        c = rng.choice(["#ffffff", "#ffd54a", "#ff8fb0"])
        s.px(fx, fy, c)
    # 遊具: ブランコ
    RED, RED_D = "#e8554e", "#a8332e"
    s.line(40, 46, 36, 60, RED_D); s.line(41, 46, 37, 60, RED)
    s.line(60, 46, 64, 60, RED_D); s.line(59, 46, 63, 60, RED)
    s.rect(40, 45, 60, 46, RED); s.rect(40, 47, 60, 47, RED_D)
    for cx in (46, 54):
        s.line(cx, 47, cx, 55, "#cfd6dc"); s.line(cx + 3, 47, cx + 3, 55, "#cfd6dc")
        s.rect(cx - 1, 56, cx + 4, 57, "#3a6fd8"); s.rect(cx - 1, 58, cx + 4, 58, "#27489a")
    # 遊具: 滑り台
    Y, Y_D = "#e0b03a", "#a97f1c"
    s.rect(70, 49, 76, 50, "#3a6fd8")
    s.rect(70, 50, 71, 61, "#7b808c"); s.rect(76, 50, 77, 61, "#7b808c")
    for ly in (53, 56, 59):
        s.rect(70, ly, 77, ly, "#aab1bc")
    s.polygon([(77, 49), (80, 49), (92, 61), (88, 61)], Y)
    s.line(77, 49, 88, 61, "#f6d98a"); s.line(80, 49, 92, 61, Y_D)
    s.rect(70, 46, 76, 48, "#e8554e"); s.rect(70, 46, 76, 46, RED_D)
    # ベンチと街灯
    s.rect(112, 58, 134, 59, "#6b4426")
    s.rect(112, 54, 134, 56, "#a9763a")
    s.rect(112, 54, 134, 54, "#c98f4d")
    s.rect(114, 59, 115, 63, "#3a3f47")
    s.rect(131, 59, 132, 63, "#3a3f47")
    s.rect(106, 38, 107, 62, "#3a3f47")
    s.rect(102, 34, 111, 38, "#3a3f47")
    s.rect(103, 35, 110, 37, "#ffe9a3")
    return s


# ---------------------------------------------------------------- 街
def city():
    s = Sprite(W, H)
    sky(s, 40, "#7fbfe6", "#a9d8f0", "#d6eef8")
    cloud(s, 100, 6, c2="#cfe3f0")
    # 遠いビル
    for x0, x1, top in ((0, 20, 22), (18, 36, 30), (60, 80, 18), (78, 100, 28), (120, 142, 24), (140, 160, 32)):
        s.rect(x0, top, x1, 60, "#8fa3b8")
        s.dither(x0, top, x1, 60, "keep", "#a5b7c9", 0.3)
    # 手前の建物3棟
    def building(x0, x1, top, body, dark, win):
        s.rect(x0, top, x1, 60, body)
        s.rect(x0, top, x1, top + 1, dark)
        s.rect(x1, top, x1, 60, dark)
        for wy in range(top + 5, 48, 8):
            for wx in range(x0 + 4, x1 - 3, 7):
                s.rect(wx, wy, wx + 3, wy + 4, "#2f3a4a")
                s.rect(wx + 1, wy + 1, wx + 3, wy + 4, win)
    building(2, 44, 12, "#c97a5c", "#9c5640", "#bfe4f2")
    building(44, 90, 24, "#d9c7a0", "#b3a07a", "#bfe4f2")
    building(90, 132, 8, "#7f8fb5", "#5f6e92", "#f6e9b0")
    # お店（1階）
    s.rect(44, 46, 90, 60, "#d9c7a0")
    s.rect(48, 48, 86, 58, "#2f3a4a")
    s.rect(49, 49, 85, 57, "#bfe4f2")
    s.rect(46, 44, 88, 47, "#e8554e")
    for ax in range(46, 88, 6):
        s.rect(ax, 44, ax + 2, 47, "#fbf4e6")
    s.rect(60, 51, 74, 53, "#e0b03a")
    # 歩道
    s.rect(0, 61, W, 74, "#c9ccd2")
    s.rect(0, 61, W, 61, "#e4e6ea")
    for x in range(0, W, 16):
        s.rect(x, 62, x, 74, "#b3b7be")
    s.rect(0, 74, W, 75, "#8b9099")
    # 車道
    s.rect(0, 76, W, H, "#4a4f58")
    s.noise(0, 76, W, H, "#5a606a", density=0.04, seed=3)
    s.rect(0, 84, W, 84, "#e8d84a")
    for x in range(6, W, 20):
        s.rect(x, 84, x + 9, 84, "#4a4f58")
    # 横断歩道
    for x in range(110, 150, 6):
        s.rect(x, 76, x + 3, 89, "#f0f0f0")
    # 街灯
    s.rect(30, 38, 31, 64, "#3a3f47")
    s.rect(26, 34, 35, 38, "#3a3f47")
    s.rect(27, 36, 34, 37, "#ffe9a3")
    # 鉢植えの木
    s.rect(138, 60, 146, 66, "#7a5230")
    s.circle(142, 54, 7, "#2f7d3b", fill=True)
    s.circle(140, 52, 4, "#47a24d", fill=True)
    return s


for name, fn in (("yard", yard), ("gym", gym), ("park", outdoor), ("city", city)):
    sp = fn()
    sp.save_png(OUT + name + ".png")
    sp.stats()
