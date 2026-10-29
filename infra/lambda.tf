# API（NestJS）を動かす Lambda と、その玄関（Function URL）。docs/infrastructure.md 3章（案A: Function URL ＋ OAC）。
# 一式は backend で `npm run build && npm run package:lambda` を実行して作る（.lambda/）。zip にするのはここ（archive_file）。
data "archive_file" "lambda" {
  type        = "zip"
  source_dir  = var.lambda_package_dir
  output_path = "${path.module}/build/lambda.zip"
}

# ログの置き場。先に作って保存日数を決める（作らないと Lambda が無期限のログ置き場を勝手に作る）
resource "aws_cloudwatch_log_group" "lambda" {
  name              = "/aws/lambda/${var.name_prefix}-api"
  retention_in_days = var.log_retention_days
}

resource "aws_lambda_function" "api" {
  function_name    = "${var.name_prefix}-api"
  role             = aws_iam_role.lambda.arn
  filename         = data.archive_file.lambda.output_path
  source_code_hash = data.archive_file.lambda.output_base64sha256

  runtime = "nodejs24.x"
  handler = "dist/lambda.handler"
  # arm64: x86 より安い。一式にネイティブ（機種ごとの）部品は入っていない（--omit=optional で外している）
  architectures = ["arm64"]

  memory_size = var.lambda_memory_mb
  timeout     = var.lambda_timeout_seconds
  # 同時に動く数の上限。null なら設定しない（infrastructure.md 5.2章）
  reserved_concurrent_executions = var.lambda_reserved_concurrency

  environment {
    variables = {
      NODE_ENV  = "production"
      LOG_LEVEL = "INFO"
      # 秘密情報の置き場の名前の頭（値ではない）。読む実装は次の PR で入れる（secrets.tf・runbook）
      FITLOG_SSM_PREFIX = local.ssm_prefix
    }
  }

  depends_on = [
    aws_cloudwatch_log_group.lambda,
    aws_iam_role_policy_attachment.lambda_logs,
  ]
}

# 玄関。AWS_IAM: 署名のない呼び出しは拒否する。CloudFront が署名して呼ぶ（OAC）ので、URL を直接叩いても入れない
resource "aws_lambda_function_url" "api" {
  function_name      = aws_lambda_function.api.function_name
  authorization_type = "AWS_IAM"
}

# CloudFront（この1つのディストリビューションだけ）に、Function URL の呼び出しを許す（infrastructure.md 4.2章）。
# 2025年後半以降の新しい Function URL は、lambda:InvokeFunctionUrl と lambda:InvokeFunction の両方が要る（要確認: スパイクで 403 になったらここ）
resource "aws_lambda_permission" "cloudfront_url" {
  statement_id           = "AllowCloudFrontInvokeUrl"
  action                 = "lambda:InvokeFunctionUrl"
  function_name          = aws_lambda_function.api.function_name
  principal              = "cloudfront.amazonaws.com"
  source_arn             = aws_cloudfront_distribution.main.arn
  function_url_auth_type = "AWS_IAM"
}

resource "aws_lambda_permission" "cloudfront_invoke" {
  statement_id             = "AllowCloudFrontInvoke"
  action                   = "lambda:InvokeFunction"
  function_name            = aws_lambda_function.api.function_name
  principal                = "cloudfront.amazonaws.com"
  source_arn               = aws_cloudfront_distribution.main.arn
  invoked_via_function_url = true
}
