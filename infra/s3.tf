# 画面用の S3（docs/infrastructure.md 2.2・4.3章の「S3A」）。パブリックアクセスはすべてブロックし、CloudFront（OAC）だけが読める。
# 動画・GPX 用の S3（S3B）は、使う 02-4 で足す。
data "aws_caller_identity" "current" {}

resource "aws_s3_bucket" "site" {
  # バケット名は世界で1つだけ。アカウント ID を付けて重ならないようにする
  bucket = "${var.name_prefix}-site-${data.aws_caller_identity.current.account_id}"
  # スパイクは使い捨て。destroy のとき、中のファイルごと消してよい
  force_destroy = var.stage == "spike"
}

resource "aws_s3_bucket_public_access_block" "site" {
  bucket                  = aws_s3_bucket.site.id
  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

data "aws_iam_policy_document" "site" {
  statement {
    sid       = "AllowCloudFrontRead"
    actions   = ["s3:GetObject"]
    resources = ["${aws_s3_bucket.site.arn}/*"]
    principals {
      type        = "Service"
      identifiers = ["cloudfront.amazonaws.com"]
    }
    # この CloudFront のディストリビューションだけに許す（ほかの CloudFront からは読めない）
    condition {
      test     = "StringEquals"
      variable = "AWS:SourceArn"
      values   = [aws_cloudfront_distribution.main.arn]
    }
  }
}

resource "aws_s3_bucket_policy" "site" {
  bucket = aws_s3_bucket.site.id
  policy = data.aws_iam_policy_document.site.json
  # 公開ブロックの設定が先に済んでいないと、ポリシーの登録が競合することがある
  depends_on = [aws_s3_bucket_public_access_block.site]
}

# スパイク用の確認ページ（使い捨て）。ブラウザから /api/* を呼んで、確認項目を画面に出す
resource "aws_s3_object" "spike_page" {
  count        = var.stage == "spike" ? 1 : 0
  bucket       = aws_s3_bucket.site.id
  key          = "index.html"
  source       = "${path.module}/spike-site/index.html"
  etag         = filemd5("${path.module}/spike-site/index.html")
  content_type = "text/html; charset=utf-8"
}
