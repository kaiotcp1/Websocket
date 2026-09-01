locals {
  # Estes gates são lidos exclusivamente pelos workflows. Eles não condicionam
  # recursos Terraform, então um plano local continua representando a infra.
  # Para criar/atualizar: provision=true e destroy=false.
  # Para remover: provision=false e destroy=true.
  provision_infrastructure = false
  destroy_infrastructure   = true
}
