import type { APIGatewayProxyResultV2, APIGatewayProxyWebsocketEventV2 } from 'aws-lambda';
import { WebSocketController } from '../controllers/websocket-controller.js';

const controller = new WebSocketController();

export async function handler(event: APIGatewayProxyWebsocketEventV2): Promise<APIGatewayProxyResultV2> {
  const { connectionId, requestId } = event.requestContext;
  console.info('WebSocket connection closed', { connectionId, requestId });
  await controller.handleDisconnect(event);
  return { statusCode: 200 };
}
