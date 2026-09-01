output "websocket_url" {
  description = "URL WSS para conectar um cliente ao stage criado."
  value       = aws_apigatewayv2_stage.websocket.invoke_url
}

output "websocket_api_id" {
  description = "ID da API WebSocket, útil para localizar o recurso no console AWS."
  value       = aws_apigatewayv2_api.websocket.id
}

output "stage_name" {
  description = "Stage incluído na URL WebSocket."
  value       = aws_apigatewayv2_stage.websocket.name
}

output "lambda_function_names" {
  description = "Nomes das três Lambdas"
  value = {
    connect    = aws_lambda_function.connect.function_name
    disconnect = aws_lambda_function.disconnect.function_name
    default    = aws_lambda_function.default.function_name
  }
}

output "game_table_name" {
  description = "Tabela DynamoDB que armazena salas e conexões ativas."
  value       = aws_dynamodb_table.game.name
}
