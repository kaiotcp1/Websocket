data "aws_iam_policy_document" "lambda_assume_role" {
  statement {
    effect  = "Allow"
    actions = ["sts:AssumeRole"]

    principals {
      type        = "Service"
      identifiers = ["lambda.amazonaws.com"]
    }
  }
}

resource "aws_iam_role" "lambda_execution" {
  name = "${local.name_prefix}-lambda-execution"
  # O path é o contrato com a role OIDC de CI/CD: somente roles de runtime
  # aprovadas neste namespace podem ser passadas para serviços AWS.
  path               = "/github-actions-passable/"
  assume_role_policy = data.aws_iam_policy_document.lambda_assume_role.json
  tags               = local.common_tags
}

# As log groups são criadas pelo Terraform; portanto a Lambda só precisa criar
# streams e publicar eventos dentro dos quatro grupos que realmente utiliza.
data "aws_iam_policy_document" "lambda_logs" {
  statement {
    effect = "Allow"
    actions = [
      "logs:CreateLogStream",
      "logs:PutLogEvents",
    ]
    resources = [
      "${aws_cloudwatch_log_group.connect.arn}:*",
      "${aws_cloudwatch_log_group.disconnect.arn}:*",
      "${aws_cloudwatch_log_group.default.arn}:*",
    ]
  }
}

resource "aws_iam_role_policy" "lambda_logs" {
  name   = "${local.name_prefix}-lambda-logs"
  role   = aws_iam_role.lambda_execution.id
  policy = data.aws_iam_policy_document.lambda_logs.json
}

# The game only reads and changes its own table and can post messages only to
# connections created by this API Gateway stage. No broad AWS permissions are needed.
data "aws_iam_policy_document" "lambda_game" {
  statement {
    effect = "Allow"
    actions = [
      "dynamodb:DeleteItem",
      "dynamodb:GetItem",
      "dynamodb:PutItem",
      "dynamodb:UpdateItem",
    ]
    resources = [aws_dynamodb_table.game.arn]
  }

  statement {
    effect    = "Allow"
    actions   = ["execute-api:ManageConnections"]
    resources = ["${aws_apigatewayv2_api.websocket.execution_arn}/${var.environment}/POST/@connections/*"]
  }
}

resource "aws_iam_role_policy" "lambda_game" {
  name   = "${local.name_prefix}-game"
  role   = aws_iam_role.lambda_execution.id
  policy = data.aws_iam_policy_document.lambda_game.json
}

data "aws_iam_policy_document" "api_gateway_assume_role" {
  statement {
    effect  = "Allow"
    actions = ["sts:AssumeRole"]

    principals {
      type        = "Service"
      identifiers = ["apigateway.amazonaws.com"]
    }
  }
}

# Esta role é usada pelo API Gateway para publicar execution logs no CloudWatch.
# Ela é diferente da role de execução das Lambdas, pois são serviços distintos.
resource "aws_iam_role" "api_gateway_cloudwatch" {
  name               = "${local.name_prefix}-api-gateway-cloudwatch"
  path               = "/github-actions-passable/"
  assume_role_policy = data.aws_iam_policy_document.api_gateway_assume_role.json
  tags               = local.common_tags
}

resource "aws_iam_role_policy_attachment" "api_gateway_cloudwatch_logs" {
  # O API Gateway valida esta policy de serviço ao configurar uma CloudWatch
  # role em nível de conta. Ela é a policy gerenciada oficial da AWS para isso.
  role       = aws_iam_role.api_gateway_cloudwatch.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AmazonAPIGatewayPushToCloudWatchLogs"
}

# API Gateway WebSocket usa esta configuração em nível de conta/região para
# habilitar logs de execution em stages com logging_level definido.
resource "aws_api_gateway_account" "websocket" {
  cloudwatch_role_arn = aws_iam_role.api_gateway_cloudwatch.arn

  depends_on = [aws_iam_role_policy_attachment.api_gateway_cloudwatch_logs]
}

# A execution role diz o que a Lambda pode fazer. Estas permissões, por outro
# lado, dizem quem pode invocar cada função: somente esta API, stage e route.
resource "aws_lambda_permission" "connect" {
  statement_id  = "AllowApiGatewayConnect"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.connect.function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_apigatewayv2_api.websocket.execution_arn}/${var.environment}/$connect"
}

resource "aws_lambda_permission" "disconnect" {
  statement_id  = "AllowApiGatewayDisconnect"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.disconnect.function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_apigatewayv2_api.websocket.execution_arn}/${var.environment}/$disconnect"
}

resource "aws_lambda_permission" "default" {
  statement_id  = "AllowApiGatewayDefault"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.default.function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_apigatewayv2_api.websocket.execution_arn}/${var.environment}/$default"
}
