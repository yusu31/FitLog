# 画面用の S3（docs/infrastructure.md 2.2・4.3章の「S3A」）。パブリックアクセスはすべてブロックし、CloudFront（OAC）だけが読める。
# 動画・GPX 用の S3（S3B）は、公開の第2段で足す（判断ログ 2026-11-05 fitlog-02-3-deploy-approach）。
data "aws_caller_identity" "current" {}

resource "aws_s3_bucket" "site" {
  # バケット名は世界で1つだけ。アカウント ID を付けて重ならないようにする
  bucket = "${var.name_prefix}-site-${data.aws_caller_identity.current.account_id}"
  # 中身は npm run build で作り直せる画面のファイルだけ。destroy のとき、中のファイルごと消してよい
  force_destroy = true
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

# 動画用の S3（docs/infrastructure.md の「S3B」。公開の第2段）。
# パブリックアクセスはすべてブロック。ブラウザは API が発行する署名付き URL（POST/GET）でだけ触れる。
resource "aws_s3_bucket" "videos" {
  bucket = "${var.name_prefix}-videos-${data.aws_caller_identity.current.account_id}"
  # 利用者の動画が入る。destroy で中身ごと消えないよう、空でなければ消せない既定のままにする
  force_destroy = false
}

resource "aws_s3_bucket_public_access_block" "videos" {
  bucket                  = aws_s3_bucket.videos.id
  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

# 保存時の暗号化は S3 管理の鍵（SSE-S3）。SSE-KMS は鍵の呼び出しごとに課金され、署名付き URL の運用も増えるので採らない
resource "aws_s3_bucket_server_side_encryption_configuration" "videos" {
  bucket = aws_s3_bucket.videos.id
  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
  }
}

# ブラウザから S3 へ直接アップロード（POST）・再生（GET）するための許可。送信元は CloudFront のドメインだけ
resource "aws_s3_bucket_cors_configuration" "videos" {
  bucket = aws_s3_bucket.videos.id
  cors_rule {
    allowed_origins = ["https://${aws_cloudfront_distribution.main.domain_name}"]
    allowed_methods = ["POST", "GET", "HEAD"]
    allowed_headers = ["*"]
    max_age_seconds = 3000
  }
}
