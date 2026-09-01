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
  name               = "${local.name_prefix}-lambda-execution"
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
