#!/usr/bin/env bash
# 公開環境へ置く手元のスクリプト（docs/infrastructure.md 7.2章。判断ログ 2026-11-05 fitlog-02-3-deploy-approach 決定2）。
#
#   scripts/deploy.sh site   画面を作って S3 へ置き、CloudFront のキャッシュを消す
#   scripts/deploy.sh api    API を作って、Terraform で Lambda を更新する
#
# 課金・公開の範囲に触れるので、確認なしには何も変えない:
#   - site: 置く前に、置き先のバケット名を表示して y を待つ
#   - api : terraform apply が変更の予告を表示し、yes と入力するまで待つ
# 前提: AWS CLI と Terraform が使え、infra/ で terraform apply 済み（outputs が読める）こと。
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
TF=(terraform "-chdir=$ROOT/infra")

usage() {
  echo "使い方: scripts/deploy.sh site | api" >&2
  exit 2
}

confirm() {
  read -r -p "$1 [y/N] " answer
  [ "$answer" = "y" ] || { echo "中止しました（何も変えていません）"; exit 1; }
}

deploy_site() {
  local bucket dist_id
  bucket="$("${TF[@]}" output -raw site_bucket)"
  dist_id="$("${TF[@]}" output -raw distribution_id)"
  # 状態ファイルが無い（まだ apply していない）と、terraform output は空文字で成功してしまう。何も作る前に止める
  if [ -z "$bucket" ] || [ -z "$dist_id" ]; then
    echo "置き先が読めません。先に infra/ で terraform apply を済ませてください（何も変えていません）" >&2
    exit 1
  fi

  # 端末に保存した画面のファイルを入れ替える印。版（コミット）が同じなら同じ値にする
  SW_REVISION="$(git -C "$ROOT" rev-parse --short HEAD)"
  export SW_REVISION
  echo "== 画面を作る（SW_REVISION=$SW_REVISION）"
  (cd "$ROOT/frontend" && npm ci && npm run build)

  confirm "s3://$bucket へ out/ を置きます（--delete: out/ に無い古いファイルは消えます）。よいですか？"

  # ファイル名にハッシュが付いて中身が変わらないものは長く、名前が変わらないもの（HTML など）は毎回確かめさせる
  echo "== _next/static（長期キャッシュ）"
  aws s3 sync "$ROOT/frontend/out/_next/static" "s3://$bucket/_next/static" \
    --cache-control "public,max-age=31536000,immutable"
  echo "== それ以外（毎回確認）"
  aws s3 sync "$ROOT/frontend/out" "s3://$bucket" --delete --exclude "_next/static/*" \
    --cache-control "public,max-age=0,must-revalidate"

  echo "== CloudFront のキャッシュを消す"
  aws cloudfront create-invalidation --distribution-id "$dist_id" --paths "/*" --query "Invalidation.Id" --output text
  echo "完了: $("${TF[@]}" output -raw site_url)"
}

deploy_api() {
  echo "== API を作る"
  (cd "$ROOT/backend" && npm ci && npm run build && npm run package:lambda)
  echo "== terraform apply（予告を表示し、yes と入力するまで変更しません）"
  "${TF[@]}" init -input=false
  "${TF[@]}" apply
}

case "${1:-}" in
  site) deploy_site ;;
  api) deploy_api ;;
  *) usage ;;
esac
