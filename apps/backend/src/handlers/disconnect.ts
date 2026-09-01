import type {
  APIGatewayProxyResultV2,
  APIGatewayProxyWebsocketEventV2,
} from 'aws-lambda';

/**
 * O API Gateway dispara este evento quando a conexão é encerrada. O handler
 * mantém o ciclo de vida da conexão separado da identidade do jogador.
 */
export async function handler(
  event: APIGatewayProxyWebsocketEventV2,
): Promise<APIGatewayProxyResultV2> {
  const { connectionId, requestId, routeKey } = event.requestContext;

  console.info('WebSocket connection closed', {
    connectionId,
    requestId,
    routeKey,
  });

  return { statusCode: 200 };
}
