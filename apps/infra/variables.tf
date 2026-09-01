variable "aws_region" {
  description = "Região AWS onde os recursos da aplicação serão criados."
  type        = string
  default     = "sa-east-1"
}

variable "environment" {
  description = "Nome do stage exposto na URL WebSocket."
  type        = string
  default     = "dev"

  validation {
    condition     = can(regex("^[a-z0-9-]+$", var.environment))
    error_message = "environment deve conter apenas letras minúsculas, números e hífens."
  }
}

variable "project_name" {
  description = "Prefixo usado nos nomes dos recursos AWS."
  type        = string
  default     = "rock-paper-scissors"

  validation {
    condition     = can(regex("^[a-z0-9-]+$", var.project_name))
    error_message = "project_name deve conter apenas letras minúsculas, números e hífens."
  }
}

variable "log_retention_days" {
  description = "Por quantos dias CloudWatch deve manter os logs da aplicação."
  type        = number
  default     = 7
}
