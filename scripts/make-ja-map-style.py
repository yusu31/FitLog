"""OpenFreeMap の positron スタイルから、日本語ラベルを優先するスタイル（style-ja.json）を作る（U17）。

使い方:  python -I -X utf8 scripts/make-ja-map-style.py
出力:    frontend/public/map/style-ja.json（静的書き出しで out/map/style-ja.json になり、同じ CloudFront から配られる）

やること: 地名ラベル（symbol レイヤーの text-field）を「name:ja → name」の順に読む式へ置き換える。
タイルと文字データ（glyphs）・アイコン（sprite）は OpenFreeMap のまま使う（日本語の文字データが配られていることは確認済み）。
外部（OpenFreeMap）が止まったときの備えにはならない。それは公開の後の課題（Protomaps の PMTiles を自前配信）。
"""
import json
import sys
import urllib.request
from pathlib import Path

SRC = "https://tiles.openfreemap.org/styles/positron"
OUT = Path(__file__).resolve().parent.parent / "frontend" / "public" / "map" / "style-ja.json"
JA_FIELD = ["coalesce", ["get", "name:ja"], ["get", "name"]]


def build(style: dict) -> tuple[dict, int]:
    replaced = 0
    for layer in style["layers"]:
        layout = layer.get("layout", {})
        if "text-field" in layout:
            layout["text-field"] = JA_FIELD
            replaced += 1
    return style, replaced


def main() -> int:
    # Python 既定の User-Agent は 403 で弾かれる。汎用のクライアント名を付ける
    req = urllib.request.Request(SRC, headers={"User-Agent": "style-ja-generator"})
    with urllib.request.urlopen(req, timeout=30) as res:  # noqa: S310 固定の https URL
        style = json.load(res)
    style, replaced = build(style)
    if replaced == 0:
        print("text-field が見つかりません。元のスタイルの形が変わった可能性があります", file=sys.stderr)
        return 1
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps(style, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
    print(f"{replaced} 個のラベルを日本語優先にしました → {OUT}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
