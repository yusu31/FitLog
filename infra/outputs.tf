output "site_url" {
  description = "画面の入口（これが better-auth-url に入れる値。https://xxxx.cloudfront.net）"
  value       = "https://${aws_cloudfront_distribution.main.domain_name}"
}

output "distribution_id" {
  description = "CloudFront の ID（キャッシュを消すときに使う）"
  value       = aws_cloudfront_distribution.main.id
}

output "site_bucket" {
  description = "画面用 S3 のバケット名（out/ を置く場所）"
  value       = aws_s3_bucket.site.id
}

output "lambda_function_name" {
  description = "API の Lambda の名前（zip を更新するときに使う）"
  value       = aws_lambda_function.api.function_name
}

output "ssm_prefix" {
  description = "秘密情報を手で入れるときの名前の頭"
  value       = local.ssm_prefix
}
