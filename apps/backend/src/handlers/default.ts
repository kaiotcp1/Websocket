import { ConditionalCheckFailedException, DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, PutCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';
import type { APIGatewayProxyResultV2, APIGatewayProxyWebsocketEventV2 } from 'aws-lambda';
import { broadcastRoom, decideWinner, expiresTomorrow, getConnection, getRoom, roomKey, saveConnection, sendError, type Choice, type Room } from '../shared/game.js';

const tableName = process.env.GAME_TABLE_NAME!;
const documentClient = DynamoDBDocumentClient.from(new DynamoDBClient({}));
const validChoices = new Set<Choice>(['rock', 'paper', 'scissors']);
type ClientMessage = { action: 'createRoom' } | { action: 'joinRoom'; roomCode: string } | { action: 'play'; choice: Choice };

export async function handler(event: APIGatewayProxyWebsocketEventV2): Promise<APIGatewayProxyResultV2> {
  const connectionId = event.requestContext.connectionId;
  try {
    const message = parseMessage(event.body);
    if (!message) { await sendError(event, 'Mensagem inválida. Use createRoom, joinRoom ou play.'); return { statusCode: 400 }; }
    if (message.action === 'createRoom') await createRoom(event, connectionId);
    if (message.action === 'joinRoom') await joinRoom(event, connectionId, message.roomCode);
    if (message.action === 'play') await play(event, connectionId, message.choice);
    return { statusCode: 200 };
  } catch (error) {
    console.error('Unable to process game message', { connectionId, error });
    await sendError(event, 'Não foi possível processar a sua jogada. Tente novamente.');
    return { statusCode: 500 };
  }
}

function parseMessage(body: string | null | undefined): ClientMessage | undefined {
  if (!body) return undefined;
  try {
    const value: unknown = JSON.parse(body);
    if (!value || typeof value !== 'object' || !('action' in value)) return undefined;
    const message = value as { action?: string; roomCode?: unknown; choice?: unknown };
    if (message.action === 'createRoom') return { action: 'createRoom' };
    if (message.action === 'joinRoom' && typeof message.roomCode === 'string') return { action: 'joinRoom', roomCode: message.roomCode.trim().toUpperCase() };
    if (message.action === 'play' && typeof message.choice === 'string' && validChoices.has(message.choice as Choice)) return { action: 'play', choice: message.choice as Choice };
  } catch { return undefined; }
  return undefined;
}

async function createRoom(event: APIGatewayProxyWebsocketEventV2, connectionId: string): Promise<void> {
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const code = crypto.randomUUID().replace(/-/g, '').slice(0, 6).toUpperCase();
    const now = new Date().toISOString();
    const room: Room = { ...roomKey(code), code, status: 'waiting', playerOne: connectionId, choices: {}, createdAt: now, updatedAt: now, expiresAt: expiresTomorrow() };
    try {
      // The condition prevents a random-code collision from replacing a live room.
      await documentClient.send(new PutCommand({ TableName: tableName, Item: room, ConditionExpression: 'attribute_not_exists(PK)' }));
      await saveConnection(connectionId, code);
      await broadcastRoom(event, room);
      return;
    } catch (error) { if (!(error instanceof ConditionalCheckFailedException)) throw error; }
  }
  await sendError(event, 'Não foi possível reservar uma sala. Tente novamente.');
}

async function joinRoom(event: APIGatewayProxyWebsocketEventV2, connectionId: string, code: string): Promise<void> {
  if (!/^[A-Z0-9]{6}$/.test(code)) { await sendError(event, 'O código da sala deve ter seis caracteres.'); return; }
  try {
    // This atomic condition lets only one second player join a waiting room.
    await documentClient.send(new UpdateCommand({
      TableName: tableName, Key: roomKey(code),
      UpdateExpression: 'SET playerTwo = :connectionId, #status = :active, updatedAt = :updatedAt',
      ConditionExpression: '#status = :waiting AND attribute_not_exists(playerTwo)',
      ExpressionAttributeNames: { '#status': 'status' },
      ExpressionAttributeValues: { ':connectionId': connectionId, ':active': 'active', ':waiting': 'waiting', ':updatedAt': new Date().toISOString() },
    }));
  } catch (error) {
    if (error instanceof ConditionalCheckFailedException) { await sendError(event, 'Sala inexistente, cheia ou já encerrada.'); return; }
    throw error;
  }
  await saveConnection(connectionId, code);
  const room = await getRoom(code);
  if (room) await broadcastRoom(event, room);
}

async function play(event: APIGatewayProxyWebsocketEventV2, connectionId: string, choice: Choice): Promise<void> {
  const connection = await getConnection(connectionId);
  if (!connection) { await sendError(event, 'Crie ou entre em uma sala antes de jogar.'); return; }
  const room = await getRoom(connection.roomCode);
  if (!room || room.status !== 'active' || (room.playerOne !== connectionId && room.playerTwo !== connectionId)) { await sendError(event, 'Esta sala não está disponível para jogar.'); return; }
  if (room.choices[connectionId]) { await sendError(event, 'Você já escolheu nesta rodada.'); return; }
  await documentClient.send(new UpdateCommand({
    TableName: tableName, Key: roomKey(room.code),
    UpdateExpression: 'SET choices.#connectionId = :choice, updatedAt = :updatedAt',
    ConditionExpression: 'attribute_not_exists(choices.#connectionId) AND #status = :active',
    ExpressionAttributeNames: { '#connectionId': connectionId, '#status': 'status' },
    ExpressionAttributeValues: { ':choice': choice, ':active': 'active', ':updatedAt': new Date().toISOString() },
  }));
  const updatedRoom = await getRoom(room.code);
  if (!updatedRoom) return;
  if (updatedRoom.playerTwo && updatedRoom.choices[updatedRoom.playerOne] && updatedRoom.choices[updatedRoom.playerTwo]) {
    const result = decideWinner(updatedRoom.choices[updatedRoom.playerOne], updatedRoom.choices[updatedRoom.playerTwo]);
    const winnerConnectionId = result === 'draw' ? null : updatedRoom[result];
    await documentClient.send(new UpdateCommand({
      TableName: tableName, Key: roomKey(updatedRoom.code),
      UpdateExpression: 'SET #status = :finished, winnerConnectionId = :winner, updatedAt = :updatedAt',
      ExpressionAttributeNames: { '#status': 'status' },
      ExpressionAttributeValues: { ':finished': 'finished', ':winner': winnerConnectionId, ':updatedAt': new Date().toISOString() },
    }));
  }
  const finalRoom = await getRoom(room.code);
  if (finalRoom) await broadcastRoom(event, finalRoom);
}
