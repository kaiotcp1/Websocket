import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import {
  DeleteCommand,
  DynamoDBDocumentClient,
  GetCommand,
  PutCommand,
  UpdateCommand,
} from '@aws-sdk/lib-dynamodb';
import type { Choice, Connection, Room } from '../models/game.js';

type StoredRoom = Room & { PK: string; SK: 'ROOM' };
type StoredConnection = Connection & { PK: string; SK: 'CONNECTION' };

/**
 * Repository isolates DynamoDB keys and commands from the application layer.
 * Services work only with Room and Connection domain models.
 */
export class GameRepository {
  private readonly client = DynamoDBDocumentClient.from(new DynamoDBClient({}));
  private readonly tableName: string;

  constructor(tableName = process.env.GAME_TABLE_NAME) {
    if (!tableName) throw new Error('GAME_TABLE_NAME must be configured for the Lambda function.');
    this.tableName = tableName;
  }

  async createRoom(room: Room): Promise<void> {
    await this.client.send(new PutCommand({
      TableName: this.tableName,
      Item: { ...roomKey(room.code), ...room } satisfies StoredRoom,
      ConditionExpression: 'attribute_not_exists(PK)',
    }));
  }

  async findRoom(code: string): Promise<Room | undefined> {
    const result = await this.client.send(new GetCommand({
      TableName: this.tableName,
      Key: roomKey(code),
      ConsistentRead: true,
    }));
    return result.Item as Room | undefined;
  }

  async claimSecondPlayer(code: string, connectionId: string, updatedAt: string): Promise<void> {
    await this.client.send(new UpdateCommand({
      TableName: this.tableName,
      Key: roomKey(code),
      UpdateExpression: 'SET playerTwo = :connectionId, #status = :active, updatedAt = :updatedAt',
      ConditionExpression: '#status = :waiting AND attribute_not_exists(playerTwo)',
      ExpressionAttributeNames: { '#status': 'status' },
      ExpressionAttributeValues: {
        ':connectionId': connectionId,
        ':active': 'active',
        ':waiting': 'waiting',
        ':updatedAt': updatedAt,
      },
    }));
  }

  async saveChoice(roomCode: string, connectionId: string, choice: Choice, updatedAt: string): Promise<void> {
    await this.client.send(new UpdateCommand({
      TableName: this.tableName,
      Key: roomKey(roomCode),
      UpdateExpression: 'SET choices.#connectionId = :choice, updatedAt = :updatedAt',
      ConditionExpression: 'attribute_not_exists(choices.#connectionId) AND #status = :active',
      ExpressionAttributeNames: { '#connectionId': connectionId, '#status': 'status' },
      ExpressionAttributeValues: {
        ':choice': choice,
        ':active': 'active',
        ':updatedAt': updatedAt,
      },
    }));
  }

  async finishRoom(code: string, winnerConnectionId: string | null, updatedAt: string): Promise<void> {
    await this.client.send(new UpdateCommand({
      TableName: this.tableName,
      Key: roomKey(code),
      UpdateExpression: 'SET #status = :finished, winnerConnectionId = :winner, updatedAt = :updatedAt',
      ExpressionAttributeNames: { '#status': 'status' },
      ExpressionAttributeValues: { ':finished': 'finished', ':winner': winnerConnectionId, ':updatedAt': updatedAt },
    }));
  }

  async abandonRoom(code: string, updatedAt: string): Promise<void> {
    await this.client.send(new UpdateCommand({
      TableName: this.tableName,
      Key: roomKey(code),
      UpdateExpression: 'SET #status = :abandoned, updatedAt = :updatedAt',
      ExpressionAttributeNames: { '#status': 'status' },
      ExpressionAttributeValues: { ':abandoned': 'abandoned', ':updatedAt': updatedAt },
    }));
  }

  async findConnection(connectionId: string): Promise<Connection | undefined> {
    const result = await this.client.send(new GetCommand({
      TableName: this.tableName,
      Key: connectionKey(connectionId),
      ConsistentRead: true,
    }));
    return result.Item as Connection | undefined;
  }

  async saveConnection(connectionId: string, connection: Connection): Promise<void> {
    await this.client.send(new PutCommand({
      TableName: this.tableName,
      Item: { ...connectionKey(connectionId), ...connection } satisfies StoredConnection,
    }));
  }

  async deleteConnection(connectionId: string): Promise<void> {
    await this.client.send(new DeleteCommand({ TableName: this.tableName, Key: connectionKey(connectionId) }));
  }
}

function roomKey(code: string): { PK: string; SK: 'ROOM' } { return { PK: `ROOM#${code}`, SK: 'ROOM' }; }
function connectionKey(connectionId: string): { PK: string; SK: 'CONNECTION' } { return { PK: `CONNECTION#${connectionId}`, SK: 'CONNECTION' }; }
