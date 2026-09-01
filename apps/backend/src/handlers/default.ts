import type { APIGatewayProxyResultV2, APIGatewayProxyWebsocketEventV2 } from 'aws-lambda';
import { WebSocketController } from '../controllers/websocket-controller.js';

const controller = new WebSocketController();

// AWS adapter: the controller owns the command handling, not this entry point.
export async function handler(event: APIGatewayProxyWebsocketEventV2): Promise<APIGatewayProxyResultV2> {
  try {
    return { statusCode: await controller.handleMessage(event) };
  } catch (error) {
    console.error('Unable to process game message', { connectionId: event.requestContext.connectionId, error });
    await controller.handleFailure(event);
    return { statusCode: 500 };
  }
}
