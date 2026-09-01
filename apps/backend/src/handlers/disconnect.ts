import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, UpdateCommand } from '@aws-sdk/lib-dynamodb';
import type { APIGatewayProxyResultV2, APIGatewayProxyWebsocketEventV2 } from 'aws-lambda';
import { broadcastRoom, deleteConnection, getConnection, getRoom, roomKey } from '../shared/game.js';

const tableName = process.env.GAME_TABLE_NAME!;
const documentClient = DynamoDBDocumentClient.from(new DynamoDBClient({}));

export async function handler(event: APIGatewayProxyWebsocketEventV2): Promise<APIGatewayProxyResultV2> {
  const { connectionId, requestId } = event.requestContext;
  const connection = await getConnection(connectionId);
  console.info('WebSocket connection closed', { connectionId, requestId, roomCode: connection?.roomCode });
  if (!connection) return { statusCode: 200 };
  await deleteConnection(connectionId);
  const room = await getRoom(connection.roomCode);
  if (!room) return { statusCode: 200 };
  await documentClient.send(new UpdateCommand({
    TableName: tableName, Key: roomKey(room.code),
    UpdateExpression: 'SET #status = :abandoned, updatedAt = :updatedAt',
    ExpressionAttributeNames: { '#status': 'status' },
    ExpressionAttributeValues: { ':abandoned': 'abandoned', ':updatedAt': new Date().toISOString() },
  }));
  const updatedRoom = await getRoom(room.code);
  if (updatedRoom) await broadcastRoom(event, updatedRoom);
  return { statusCode: 200 };
}
