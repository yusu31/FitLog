#!/usr/bin/env bash
# 3形式のテスト動画(3秒・720p)を作る。ffmpeg が必要。
set -euo pipefail
cd "$(dirname "$0")"
SRC="testsrc=duration=3:size=1280x720:rate=30"
ffmpeg -loglevel error -y -f lavfi -i "$SRC" -c:v libx264 -pix_fmt yuv420p -movflags +faststart h264.mp4
ffmpeg -loglevel error -y -f lavfi -i "$SRC" -c:v libx265 -tag:v hvc1 -pix_fmt yuv420p hevc.mov
ffmpeg -loglevel error -y -f lavfi -i "$SRC" -c:v libvpx-vp9 -pix_fmt yuv420p vp9.webm
ls -l h264.mp4 hevc.mov vp9.webm
