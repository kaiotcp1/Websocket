import type {
  APIGatewayProxyResultV2,
  APIGatewayProxyWebsocketEventV2,
} from 'aws-lambda';

/**
 * $default recebe mensagens cuja ação não possui uma rota própria. Ele é útil
 * para inspecionar o contrato inicial antes de criarmos rotas de jogo, como
 * createRoom ou makeMove.
 */
export async function handler(
  event: APIGatewayProxyWebsocketEventV2,
): Promise<APIGatewayProxyResultV2> {
  const { connectionId, requestId, routeKey } = event.requestContext;

  console.info('WebSocket message received by default route', {
    connectionId,
    requestId,
    routeKey,
    body: event.body,
  });

  return { statusCode: 200 };
}
