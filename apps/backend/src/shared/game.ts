import { ApiGatewayManagementApiClient, GoneException, PostToConnectionCommand } from '@aws-sdk/client-apigatewaymanagementapi';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DeleteCommand, DynamoDBDocumentClient, GetCommand, PutCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';
import type { APIGatewayProxyWebsocketEventV2 } from 'aws-lambda';

export type Choice = 'rock' | 'paper' | 'scissors';
export type RoomStatus = 'waiting' | 'active' | 'finished' | 'abandoned';

export interface Room {
  PK: string;
  SK: 'ROOM';
  code: string;
  status: RoomStatus;
  playerOne: string;
  playerTwo?: string;
  choices: Record<string, Choice>;
  winnerConnectionId?: string | null;
  createdAt: string;
  updatedAt: string;
  expiresAt: number;
}

export interface Connection { PK: string; SK: 'CONNECTION'; roomCode: string; createdAt: string; expiresAt: number; }

const tableName = process.env.GAME_TABLE_NAME;
if (!tableName) throw new Error('GAME_TABLE_NAME must be configured for the Lambda function.');
const documentClient = DynamoDBDocumentClient.from(new DynamoDBClient({}));

export function roomKey(code: string): { PK: string; SK: 'ROOM' } { return { PK: `ROOM#${code}`, SK: 'ROOM' }; }
function connectionKey(connectionId: string): { PK: string; SK: 'CONNECTION' } { return { PK: `CONNECTION#${connectionId}`, SK: 'CONNECTION' }; }

export async function getRoom(code: string): Promise<Room | undefined> {
  const result = await documentClient.send(new GetCommand({ TableName: tableName, Key: roomKey(code), ConsistentRead: true }));
  return result.Item as Room | undefined;
}

export async function getConnection(connectionId: string): Promise<Connection | undefined> {
  const result = await documentClient.send(new GetCommand({ TableName: tableName, Key: connectionKey(connectionId), ConsistentRead: true }));
  return result.Item as Connection | undefined;
}

export async function saveConnection(connectionId: string, roomCode: string): Promise<void> {
  await documentClient.send(new PutCommand({
    TableName: tableName,
    // DynamoDB TTL uses epoch seconds. Cleanup is asynchronous, so application
    // behavior never depends on the exact instant an expired record disappears.
    Item: { ...connectionKey(connectionId), roomCode, createdAt: new Date().toISOString(), expiresAt: expiresTomorrow() } satisfies Connection,
  }));
}

export async function deleteConnection(connectionId: string): Promise<void> {
  await documentClient.send(new DeleteCommand({ TableName: tableName, Key: connectionKey(connectionId) }));
}

/** API Gateway exposes a callback endpoint that lets the backend send a message to an open socket. */
export async function sendToConnection(event: APIGatewayProxyWebsocketEventV2, connectionId: string, payload: unknown): Promise<void> {
  const { domainName, stage } = event.requestContext;
  const client = new ApiGatewayManagementApiClient({ endpoint: `https://${domainName}/${stage}` });
  try {
    await client.send(new PostToConnectionCommand({ ConnectionId: connectionId, Data: Buffer.from(JSON.stringify(payload)) }));
  } catch (error) {
    // The client may close after DynamoDB is read. A 410 is normal in this race.
    if (error instanceof GoneException || (error as { name?: string }).name === 'GoneException') return;
    throw error;
  }
}

export async function sendError(event: APIGatewayProxyWebsocketEventV2, message: string): Promise<void> {
  await sendToConnection(event, event.requestContext.connectionId, { type: 'error', message });
}

function playerLabel(room: Room, connectionId: string): 'playerOne' | 'playerTwo' | undefined {
  if (room.playerOne === connectionId) return 'playerOne';
  if (room.playerTwo === connectionId) return 'playerTwo';
  return undefined;
}

function messageFor(room: Room, connectionId: string) {
  const opponentId = room.playerOne === connectionId ? room.playerTwo : room.playerOne;
  const winner = room.winnerConnectionId ? playerLabel(room, room.winnerConnectionId) ?? 'draw' : undefined;
  return {
    type: 'roomState',
    room: {
      code: room.code, status: room.status,
      players: { playerOne: Boolean(room.playerOne), playerTwo: Boolean(room.playerTwo) },
      // Choices remain private until both players have made theirs.
      yourChoice: room.status === 'finished' ? room.choices[connectionId] : undefined,
      opponentChoice: room.status === 'finished' && opponentId ? room.choices[opponentId] : undefined,
      winner, youAre: playerLabel(room, connectionId),
      youHavePlayed: Boolean(room.choices[connectionId]),
      opponentHasPlayed: opponentId ? Boolean(room.choices[opponentId]) : false,
    },
  };
}

export async function broadcastRoom(event: APIGatewayProxyWebsocketEventV2, room: Room): Promise<void> {
  await Promise.all([room.playerOne, room.playerTwo]
    .filter((connectionId): connectionId is string => Boolean(connectionId))
    .map((connectionId) => sendToConnection(event, connectionId, messageFor(room, connectionId))));
}

export function decideWinner(first: Choice, second: Choice): 'playerOne' | 'playerTwo' | 'draw' {
  if (first === second) return 'draw';
  return (first === 'rock' && second === 'scissors') || (first === 'paper' && second === 'rock') || (first === 'scissors' && second === 'paper') ? 'playerOne' : 'playerTwo';
}

export function expiresTomorrow(): number { return Math.floor(Date.now() / 1000) + 86_400; }
