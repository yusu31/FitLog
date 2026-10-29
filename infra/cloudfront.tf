# 入口（CloudFront）。docs/infrastructure.md 2.1章。/api/* は Lambda へ、それ以外は S3 へ振り分ける。
# 入口が1つなので、画面と API は「同じサイト」になり、Cookie がそのまま送られる。

# AWS が用意している設定（名前で引く）
data "aws_cloudfront_cache_policy" "disabled" {
  # API はログインした本人ごとに答えが違うので、キャッシュしない
  name = "Managed-CachingDisabled"
}

data "aws_cloudfront_cache_policy" "optimized" {
  name = "Managed-CachingOptimized"
}

data "aws_cloudfront_origin_request_policy" "all_viewer_except_host" {
  # Cookie・Origin・クエリ文字列などを Lambda へ渡し、Host は渡さない（Lambda 側の署名の検証と食い違うため。infrastructure.md 2.1・3.1章）
  name = "Managed-AllViewerExceptHostHeader"
}

# OAC（Origin Access Control）: CloudFront が、自分が誰かを証明する署名を付けて、S3 と Lambda を呼ぶ仕組み
resource "aws_cloudfront_origin_access_control" "s3" {
  name                              = "${var.name_prefix}-s3"
  origin_access_control_origin_type = "s3"
  signing_behavior                  = "always"
  signing_protocol                  = "sigv4"
}

resource "aws_cloudfront_origin_access_control" "lambda" {
  name                              = "${var.name_prefix}-lambda"
  origin_access_control_origin_type = "lambda"
  signing_behavior                  = "always"
  signing_protocol                  = "sigv4"
}

# /records/ のように末尾が / のパスに index.html を付ける（S3 を OAC で読むと自動では読み替わらないため。infrastructure.md 2.1章）
resource "aws_cloudfront_function" "index_html" {
  name    = "${var.name_prefix}-index-html"
  runtime = "cloudfront-js-2.0"
  publish = true
  code    = <<-JS
    function handler(event) {
      var request = event.request;
      if (request.uri.endsWith('/')) {
        request.uri += 'index.html';
      }
      return request;
    }
  JS
}

locals {
  # Function URL は https://xxxx.lambda-url.<region>.on.aws/ の形。CloudFront の origin には、https:// と末尾の / を除いたホスト名を渡す
  lambda_url_host = replace(replace(aws_lambda_function_url.api.function_url, "https://", ""), "/", "")
}

resource "aws_cloudfront_distribution" "main" {
  enabled             = true
  comment             = "${var.name_prefix}: 画面は S3、/api/* は Lambda"
  default_root_object = "index.html"
  is_ipv6_enabled     = true
  http_version        = "http2and3"

  origin {
    origin_id                = "site"
    domain_name              = aws_s3_bucket.site.bucket_regional_domain_name
    origin_access_control_id = aws_cloudfront_origin_access_control.s3.id
  }

  origin {
    origin_id                = "api"
    domain_name              = local.lambda_url_host
    origin_access_control_id = aws_cloudfront_origin_access_control.lambda.id

    custom_origin_config {
      http_port              = 80
      https_port             = 443
      origin_protocol_policy = "https-only"
      origin_ssl_protocols   = ["TLSv1.2"]
    }
  }

  # 画面・地図: キャッシュする（ファイル名にハッシュが付く静的ファイルが中心）
  default_cache_behavior {
    target_origin_id       = "site"
    viewer_protocol_policy = "redirect-to-https"
    allowed_methods        = ["GET", "HEAD", "OPTIONS"]
    cached_methods         = ["GET", "HEAD"]
    cache_policy_id        = data.aws_cloudfront_cache_policy.optimized.id
    compress               = true

    function_association {
      event_type   = "viewer-request"
      function_arn = aws_cloudfront_function.index_html.arn
    }
  }

  # API: キャッシュしない。GET/POST/PATCH/DELETE をすべて通す（スパイクで PATCH・DELETE が通るか確かめる。infrastructure.md 3.2章）
  ordered_cache_behavior {
    path_pattern             = "/api/*"
    target_origin_id         = "api"
    viewer_protocol_policy   = "redirect-to-https"
    allowed_methods          = ["GET", "HEAD", "OPTIONS", "PUT", "POST", "PATCH", "DELETE"]
    cached_methods           = ["GET", "HEAD"]
    cache_policy_id          = data.aws_cloudfront_cache_policy.disabled.id
    origin_request_policy_id = data.aws_cloudfront_origin_request_policy.all_viewer_except_host.id
    compress                 = true
  }

  restrictions {
    geo_restriction {
      restriction_type = "none"
    }
  }

  # 証明書は既定の *.cloudfront.net（独自ドメインは持たない）
  viewer_certificate {
    cloudfront_default_certificate = true
  }

  # 料金プラン（Free）は、この設定では選べるか未確認。スパイクで画面から確かめる（infrastructure.md 6章）
}
