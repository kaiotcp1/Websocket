import { ApiGatewayManagementApiClient, GoneException, PostToConnectionCommand } from '@aws-sdk/client-apigatewaymanagementapi';
import type { APIGatewayProxyWebsocketEventV2 } from 'aws-lambda';
import { playerPosition, type Room } from '../models/game.js';

/** Sends view models back to clients through API Gateway's @connections API. */
export class WebSocketMessenger {
  async send(event: APIGatewayProxyWebsocketEventV2, connectionId: string, payload: unknown): Promise<void> {
    const { domainName, stage } = event.requestContext;
    const client = new ApiGatewayManagementApiClient({ endpoint: `https://${domainName}/${stage}` });
    try {
      await client.send(new PostToConnectionCommand({
        ConnectionId: connectionId,
        // API Gateway expects binary data. TextEncoder returns Uint8Array,
        // exactly the type declared by the AWS SDK, without relying on Buffer.
        Data: new TextEncoder().encode(JSON.stringify(payload)),
      }));
    } catch (error) {
      // A socket can close after DynamoDB has been read. A 410 is expected here.
      if (error instanceof GoneException || (error as { name?: string }).name === 'GoneException') return;
      throw error;
    }
  }

  async sendError(event: APIGatewayProxyWebsocketEventV2, message: string): Promise<void> {
    await this.send(event, event.requestContext.connectionId, { type: 'error', message });
  }

  async broadcastRoom(event: APIGatewayProxyWebsocketEventV2, room: Room): Promise<void> {
    const connectionIds = [room.playerOne, room.playerTwo].filter((id): id is string => Boolean(id));
    await Promise.all(connectionIds.map((connectionId) => this.send(event, connectionId, roomView(room, connectionId))));
  }
}

function roomView(room: Room, connectionId: string) {
  const opponentId = room.playerOne === connectionId ? room.playerTwo : room.playerOne;
  const winner = room.status !== 'finished'
    ? undefined
    : room.winnerConnectionId
      ? playerPosition(room, room.winnerConnectionId)
      : 'draw';
  return {
    type: 'roomState',
    room: {
      code: room.code,
      status: room.status,
      players: { playerOne: Boolean(room.playerOne), playerTwo: Boolean(room.playerTwo) },
      // Choices are private until the round ends.
      yourChoice: room.status === 'finished' ? room.choices[connectionId] : undefined,
      opponentChoice: room.status === 'finished' && opponentId ? room.choices[opponentId] : undefined,
      winner,
      youAre: playerPosition(room, connectionId),
      youHavePlayed: Boolean(room.choices[connectionId]),
      opponentHasPlayed: opponentId ? Boolean(room.choices[opponentId]) : false,
    },
  };
}
