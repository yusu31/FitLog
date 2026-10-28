#!/usr/bin/env bash
# FitLog の現在地を1画面で表示する。
# 使い方: bash .claude/scripts/status.sh
#
# フェーズの表は下の PHASES を節目ごとに手で更新する（番号の正本はこの表）。
# ブランチ・Issue/PR の件数・テストの実行件数は毎回その場で取得する。

set -u
cd "$(dirname "$0")/../.." || exit 1

# 番号|状態(done/doing/todo)|名前
PHASES="
01-1|done|要件・スコープ確定
01-2|done|技術スタック選定
01-3|doing|技術検証（PC分は済・スマホ実機が残り）
01-4|done|プロトタイプ（v8 まで）
01-5|done|基本設計書
01-6|doing|開発の仕組み（hooks・status.sh・見積もり台帳）
01-7|todo|ゲートレビュー・実装の承認
02-1|todo|土台（リポジトリ・CI・スケルトン）
02-2|todo|必須の機能（認証・記録・ゴースト・仲間）
02-3|todo|必須の重い機能（動画・GPX・地図・オフライン）
02-4|todo|インフラ（AWS に公開）
02-5|todo|品質（E2E・a11y）
02-6|todo|README・提出
"

echo "=== FitLog 現在地 ==="
echo "$PHASES" | while IFS='|' read -r no st name; do
  [ -z "$no" ] && continue
  case "$st" in
    done)  mark="[済]" ;;
    doing) mark="[>>]" ;;
    *)     mark="[  ]" ;;
  esac
  echo "$mark $no $name"
done

echo
echo "--- Git ---"
echo "ブランチ: $(git branch --show-current)"
git status -sb | head -1
echo "未コミット: $(git status --porcelain | wc -l) ファイル"

echo
echo "--- GitHub ---"
if command -v gh >/dev/null 2>&1; then
  echo "開いている Issue: $(gh issue list --state open --json number --jq 'length' 2>/dev/null || echo '?')"
  echo "開いている PR:    $(gh pr list --state open --json number --jq 'length' 2>/dev/null || echo '?')"
else
  echo "gh が無いので省略"
fi

echo
echo "--- テスト ---"
if [ -f .claude/hooks/test_guard.py ] && command -v python >/dev/null 2>&1; then
  echo "hook: $(python -I -X utf8 .claude/hooks/test_guard.py 2>/dev/null | tail -1)"
fi
echo "アプリのテスト: 02-1 でコードができてから表示する"

echo
echo "期限 2026-11-20（金）／目標 2026-11-15（日）。確かめる日: 11/1・11/8・11/15（docs/schedule.md）"
