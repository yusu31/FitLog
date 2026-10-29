variable "aws_region" {
  description = "AWS のリージョン。東京。CloudFront は世界共通なのでここに影響されない"
  type        = string
  default     = "ap-northeast-1"
}

variable "stage" {
  description = "何の環境か。スパイクは使い捨て（spike）。本番（02-3）は別の値にする"
  type        = string
  default     = "spike"
}

variable "name_prefix" {
  description = "作るものの名前の頭に付ける文字"
  type        = string
  default     = "fitlog-spike"
}

variable "lambda_package_dir" {
  description = "Lambda に載せる一式のフォルダ。backend で npm run build && npm run package:lambda を実行すると .lambda/ ができる"
  type        = string
  default     = "../backend/.lambda"
}

variable "lambda_memory_mb" {
  description = "Lambda のメモリ。CPU はメモリに比例する。スパイクで 512 と 1024 の起動時間を比べる（infrastructure.md 3.2章）"
  type        = number
  default     = 512
}

variable "lambda_timeout_seconds" {
  description = "Lambda の最大の実行時間。コールドスタート＋Neon の起床を見込んだ余裕"
  type        = number
  default     = 15
}

variable "lambda_reserved_concurrency" {
  description = "同時に動く Lambda の上限（Neon の接続本数を守る。infrastructure.md 5.2章）。新しいアカウントでは設定できないことがある。null なら設定しない"
  type        = number
  default     = null
}

variable "log_retention_days" {
  description = "Lambda のログを残す日数。残しすぎると保存料金が増える"
  type        = number
  default     = 14
}
