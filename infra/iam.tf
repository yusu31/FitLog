# Lambda の実行ロール（docs/infrastructure.md 4.2章。最小権限）
# 許すこと: ①ログを書く ②秘密情報（上の3つだけ）を読む。S3 への書き込み・s3:*・* への許可はしない。
# 動画・GPX 用の S3 の権限は、その S3 を作る 02-4 で足す。
data "aws_iam_policy_document" "lambda_assume" {
  statement {
    actions = ["sts:AssumeRole"]
    principals {
      type        = "Service"
      identifiers = ["lambda.amazonaws.com"]
    }
  }
}

resource "aws_iam_role" "lambda" {
  name               = "${var.name_prefix}-lambda"
  assume_role_policy = data.aws_iam_policy_document.lambda_assume.json
}

# ログを書く標準の基本ポリシー（CloudWatch Logs への書き込みだけ）
resource "aws_iam_role_policy_attachment" "lambda_logs" {
  role       = aws_iam_role.lambda.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole"
}

data "aws_iam_policy_document" "lambda_secrets" {
  statement {
    sid       = "ReadOwnParameters"
    actions   = ["ssm:GetParameter"]
    resources = [for p in aws_ssm_parameter.secret : p.arn]
  }
}

resource "aws_iam_role_policy" "lambda_secrets" {
  name   = "read-own-parameters"
  role   = aws_iam_role.lambda.id
  policy = data.aws_iam_policy_document.lambda_secrets.json
}
