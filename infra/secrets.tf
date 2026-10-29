# 秘密情報の「入れ物」だけを作る（docs/infrastructure.md 8章）。値は Terraform に書かない。
# 値は、あなたが AWS の画面か CLI で手で入れる（docs/infra-spike-runbook.md）。そうしないと、値が状態ファイル（tfstate）に残る。
#
# 作る時は、仮の文字（CHANGE_ME）を入れる。aws_ssm_parameter は作成時に値が必須のため。
# 本物の値を入れたあとに terraform apply しても、ignore_changes で上書きされない。
locals {
  ssm_prefix = "/fitlog/${var.stage}"

  secret_parameters = {
    "database-url"       = "Neon の -pooler 付きの接続文字列（アプリ用）"
    "better-auth-secret" = "better-auth の署名鍵（32文字以上のランダムな文字列）"
    "better-auth-url"    = "外向きのアドレス（https://xxxx.cloudfront.net）。CloudFront を作ったあとに分かるので、手で入れる（infrastructure.md 2.1章）"
  }
}

resource "aws_ssm_parameter" "secret" {
  for_each = local.secret_parameters

  name        = "${local.ssm_prefix}/${each.key}"
  description = each.value
  # SecureString: 暗号化して保存する（標準パラメータ。追加料金なし。暗号化の鍵は AWS 管理の既定の鍵）
  type  = "SecureString"
  value = "CHANGE_ME"

  lifecycle {
    ignore_changes = [value]
  }
}
