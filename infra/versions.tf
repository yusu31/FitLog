terraform {
  required_version = ">= 1.9"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 6.0"
    }
    archive = {
      source  = "hashicorp/archive"
      version = "~> 2.7"
    }
  }

  # 状態ファイル（terraform.tfstate）は、まず手元に置く（仮置き。docs/infrastructure.md 7.1章）。
  # アカウント ID や設定値が入るので .gitignore 済み。S3 に置く方式は、1人で使う間は不要と見ている
}

provider "aws" {
  region = var.aws_region

  # 作ったものすべてに印を付ける（あとで「何のために作ったか」「消してよいか」を追えるように）
  default_tags {
    tags = {
      Project = "fitlog"
      Stage   = var.stage
    }
  }
}
