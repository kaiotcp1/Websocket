terraform {
  required_version = ">= 1.6.0"

  # Cada aplicação usa uma chave de state exclusiva para isolar seus recursos.
  backend "s3" {
    bucket       = "terraform-states-761018861028-us-east-1"
    key          = "websocket/dev/terraform.tfstate"
    region       = "us-east-1"
    encrypt      = true
    use_lockfile = true
  }

  required_providers {
    archive = {
      source  = "hashicorp/archive"
      version = ">= 2.4.0"
    }
    aws = {
      source  = "hashicorp/aws"
      version = ">= 5.0.0"
    }
  }
}

provider "aws" {
  region = var.aws_region
}
