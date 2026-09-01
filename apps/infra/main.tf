locals {
  name_prefix = "${var.project_name}-${var.environment}"

  common_tags = {
    Project     = var.project_name
    Environment = var.environment
    ManagedBy   = "Terraform"
    Service     = "websocket"
  }
}

# O ZIP contém o JavaScript compilado. O build do backend deve rodar antes do
# terraform apply, pois a Lambda executa dist/handlers/<route>.js, nunca src/.
data "archive_file" "backend" {
  type        = "zip"
  source_dir  = "${path.module}/../backend/dist"
  output_path = "${path.module}/backend.zip"
}

resource "aws_apigatewayv2_api" "websocket" {
  name                       = local.name_prefix
  protocol_type              = "WEBSOCKET"
  route_selection_expression = "$request.body.action"

  tags = local.common_tags
}

resource "aws_cloudwatch_log_group" "api_access" {
  name              = "/aws/apigateway/${local.name_prefix}"
  retention_in_days = var.log_retention_days
  tags              = local.common_tags
}

# Logs de execução são separados dos access logs para facilitar a correlação
# entre a route selecionada pelo API Gateway e o log da Lambda correspondente.
resource "aws_cloudwatch_log_group" "api_execution" {
  name              = "API-Gateway-Execution-Logs_${aws_apigatewayv2_api.websocket.id}/${var.environment}"
  retention_in_days = var.log_retention_days
  tags              = local.common_tags
}

resource "aws_cloudwatch_log_group" "connect" {
  name              = "/aws/lambda/${local.name_prefix}-connect"
  retention_in_days = var.log_retention_days
  tags              = local.common_tags
}

resource "aws_cloudwatch_log_group" "disconnect" {
  name              = "/aws/lambda/${local.name_prefix}-disconnect"
  retention_in_days = var.log_retention_days
  tags              = local.common_tags
}

resource "aws_cloudwatch_log_group" "default" {
  name              = "/aws/lambda/${local.name_prefix}-default"
  retention_in_days = var.log_retention_days
  tags              = local.common_tags
}

resource "aws_lambda_function" "connect" {
  function_name    = "${local.name_prefix}-connect"
  description      = "Handles API Gateway WebSocket $connect events."
  role             = aws_iam_role.lambda_execution.arn
  runtime          = "nodejs22.x"
  handler          = "handlers/connect.handler"
  filename         = data.archive_file.backend.output_path
  source_code_hash = data.archive_file.backend.output_base64sha256

  tags = local.common_tags

  depends_on = [aws_cloudwatch_log_group.connect]
}

resource "aws_lambda_function" "disconnect" {
  function_name    = "${local.name_prefix}-disconnect"
  description      = "Handles API Gateway WebSocket $disconnect events."
  role             = aws_iam_role.lambda_execution.arn
  runtime          = "nodejs22.x"
  handler          = "handlers/disconnect.handler"
  filename         = data.archive_file.backend.output_path
  source_code_hash = data.archive_file.backend.output_base64sha256

  tags = local.common_tags

  depends_on = [aws_cloudwatch_log_group.disconnect]
}

resource "aws_lambda_function" "default" {
  function_name    = "${local.name_prefix}-default"
  description      = "Handles unmatched API Gateway WebSocket messages."
  role             = aws_iam_role.lambda_execution.arn
  runtime          = "nodejs22.x"
  handler          = "handlers/default.handler"
  filename         = data.archive_file.backend.output_path
  source_code_hash = data.archive_file.backend.output_base64sha256

  tags = local.common_tags

  depends_on = [aws_cloudwatch_log_group.default]
}

resource "aws_apigatewayv2_integration" "connect" {
  api_id                    = aws_apigatewayv2_api.websocket.id
  integration_type          = "AWS_PROXY"
  integration_uri           = aws_lambda_function.connect.invoke_arn
  integration_method        = "POST"
  content_handling_strategy = "CONVERT_TO_TEXT"
}

resource "aws_apigatewayv2_integration" "disconnect" {
  api_id                    = aws_apigatewayv2_api.websocket.id
  integration_type          = "AWS_PROXY"
  integration_uri           = aws_lambda_function.disconnect.invoke_arn
  integration_method        = "POST"
  content_handling_strategy = "CONVERT_TO_TEXT"
}

resource "aws_apigatewayv2_integration" "default" {
  api_id                    = aws_apigatewayv2_api.websocket.id
  integration_type          = "AWS_PROXY"
  integration_uri           = aws_lambda_function.default.invoke_arn
  integration_method        = "POST"
  content_handling_strategy = "CONVERT_TO_TEXT"
}

resource "aws_apigatewayv2_route" "connect" {
  api_id    = aws_apigatewayv2_api.websocket.id
  route_key = "$connect"
  target    = "integrations/${aws_apigatewayv2_integration.connect.id}"
}

resource "aws_apigatewayv2_route" "disconnect" {
  api_id    = aws_apigatewayv2_api.websocket.id
  route_key = "$disconnect"
  target    = "integrations/${aws_apigatewayv2_integration.disconnect.id}"
}

resource "aws_apigatewayv2_route" "default" {
  api_id    = aws_apigatewayv2_api.websocket.id
  route_key = "$default"
  target    = "integrations/${aws_apigatewayv2_integration.default.id}"
}

# Uma deployment é o retrato das routes e integrações que o stage irá expor.
resource "aws_apigatewayv2_deployment" "websocket" {
  api_id = aws_apigatewayv2_api.websocket.id

  triggers = {
    routes_and_integrations = sha1(jsonencode([
      aws_apigatewayv2_route.connect.target,
      aws_apigatewayv2_route.disconnect.target,
      aws_apigatewayv2_route.default.target,
    ]))
  }

  lifecycle {
    create_before_destroy = true
  }

  depends_on = [
    aws_apigatewayv2_route.connect,
    aws_apigatewayv2_route.disconnect,
    aws_apigatewayv2_route.default,
  ]
}

resource "aws_apigatewayv2_stage" "websocket" {
  api_id        = aws_apigatewayv2_api.websocket.id
  name          = var.environment
  deployment_id = aws_apigatewayv2_deployment.websocket.id

  access_log_settings {
    destination_arn = aws_cloudwatch_log_group.api_access.arn
    format = jsonencode({
      requestId    = "$context.requestId"
      connectionId = "$context.connectionId"
      routeKey     = "$context.routeKey"
      status       = "$context.status"
      eventType    = "$context.eventType"
      errorMessage = "$context.error.message"
    })
  }

  default_route_settings {
    logging_level      = "INFO"
    data_trace_enabled = false
  }

  tags = local.common_tags

  depends_on = [aws_api_gateway_account.websocket]
}
