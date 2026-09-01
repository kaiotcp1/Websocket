import type {
  APIGatewayProxyResultV2,
  APIGatewayProxyWebsocketEventV2,
} from 'aws-lambda';

/**
 * O API Gateway mantém o socket aberto; esta Lambda apenas reage ao evento de
 * conexão e termina sua execução. O connectionId identifica este socket, não
 * a identidade persistente de um jogador.
 */
export async function handler(
  event: APIGatewayProxyWebsocketEventV2,
): Promise<APIGatewayProxyResultV2> {
  const { connectionId, requestId, routeKey } = event.requestContext;

  console.info('WebSocket connection established', {
    connectionId,
    requestId,
    routeKey,
  });

  return { statusCode: 200 };
}
