import { ConditionalCheckFailedException } from '@aws-sdk/client-dynamodb';
import type { APIGatewayProxyWebsocketEventV2 } from 'aws-lambda';
import { createRoom, decideWinner, hasBothChoices, playerPosition, type Choice, type Connection, type Handedness, type HandLandmark } from '../models/game.js';
import { GameRepository } from '../repositories/game-repository.js';
import { WebSocketMessenger } from './websocket-messenger.js';

/** Application service: coordinates the domain model, persistence and WebSocket output. */
export class GameService {
  constructor(
    private readonly repository = new GameRepository(),
    private readonly messenger = new WebSocketMessenger(),
  ) {}

  async createRoom(event: APIGatewayProxyWebsocketEventV2): Promise<void> {
    const connectionId = event.requestContext.connectionId;
    for (let attempt = 0; attempt < 5; attempt += 1) {
      const code = crypto.randomUUID().replace(/-/g, '').slice(0, 6).toUpperCase();
      const now = new Date();
      const room = createRoom(code, connectionId, now);
      try {
        await this.repository.createRoom(room);
        await this.repository.saveConnection(connectionId, connectionFor(code, now));
        await this.messenger.broadcastRoom(event, room);
        return;
      } catch (error) {
        if (!(error instanceof ConditionalCheckFailedException)) throw error;
      }
    }
    await this.messenger.sendError(event, 'Não foi possível reservar uma sala. Tente novamente.');
  }

  async joinRoom(event: APIGatewayProxyWebsocketEventV2, roomCode: string): Promise<void> {
    if (!/^[A-Z0-9]{6}$/.test(roomCode)) {
      await this.messenger.sendError(event, 'O código da sala deve ter seis caracteres.');
      return;
    }
    const connectionId = event.requestContext.connectionId;
    const now = new Date();
    try {
      await this.repository.claimSecondPlayer(roomCode, connectionId, now.toISOString());
    } catch (error) {
      if (error instanceof ConditionalCheckFailedException) {
        await this.messenger.sendError(event, 'Sala inexistente, cheia ou já encerrada.');
        return;
      }
      throw error;
    }
    await this.repository.saveConnection(connectionId, connectionFor(roomCode, now));
    const room = await this.repository.findRoom(roomCode);
    if (room) await this.messenger.broadcastRoom(event, room);
  }

  async play(event: APIGatewayProxyWebsocketEventV2, choice: Choice): Promise<void> {
    const connectionId = event.requestContext.connectionId;
    const connection = await this.repository.findConnection(connectionId);
    if (!connection) {
      await this.messenger.sendError(event, 'Crie ou entre em uma sala antes de jogar.');
      return;
    }
    const room = await this.repository.findRoom(connection.roomCode);
    if (!room || room.status !== 'active' || !playerPosition(room, connectionId)) {
      await this.messenger.sendError(event, 'Esta sala não está disponível para jogar.');
      return;
    }
    if (room.choices[connectionId]) {
      await this.messenger.sendError(event, 'Você já escolheu nesta rodada.');
      return;
    }

    try {
      await this.repository.saveChoice(room.code, connectionId, choice, new Date().toISOString());
    } catch (error) {
      if (error instanceof ConditionalCheckFailedException) {
        await this.messenger.sendError(event, 'Esta rodada já foi encerrada.');
        return;
      }
      throw error;
    }

    const updatedRoom = await this.repository.findRoom(room.code);
    if (!updatedRoom) return;
    if (hasBothChoices(updatedRoom)) {
      const result = decideWinner(updatedRoom.choices[updatedRoom.playerOne], updatedRoom.choices[updatedRoom.playerTwo]);
      const winnerConnectionId = result === 'draw' ? null : updatedRoom[result];
      await this.repository.finishRoom(updatedRoom.code, winnerConnectionId, new Date().toISOString());
    }
    const roomToBroadcast = await this.repository.findRoom(room.code);
    if (roomToBroadcast) await this.messenger.broadcastRoom(event, roomToBroadcast);
  }

  async disconnect(event: APIGatewayProxyWebsocketEventV2): Promise<void> {
    const connectionId = event.requestContext.connectionId;
    const connection = await this.repository.findConnection(connectionId);
    if (!connection) return;

    await this.repository.deleteConnection(connectionId);
    const room = await this.repository.findRoom(connection.roomCode);
    if (!room) return;

    await this.repository.abandonRoom(room.code, new Date().toISOString());
    const updatedRoom = await this.repository.findRoom(room.code);
    if (updatedRoom) await this.messenger.broadcastRoom(event, updatedRoom);
  }

  async shareHandMotion(
    event: APIGatewayProxyWebsocketEventV2,
    landmarks: HandLandmark[],
    worldLandmarks?: HandLandmark[],
    handedness?: Handedness,
  ): Promise<void> {
    const connectionId = event.requestContext.connectionId;
    const connection = await this.repository.findConnection(connectionId);
    if (!connection) return;

    const room = await this.repository.findRoom(connection.roomCode);
    if (!room || room.status !== 'active') return;

    const opponentId = room.playerOne === connectionId ? room.playerTwo : room.playerOne;
    if (opponentId) await this.messenger.sendHandMotion(event, opponentId, landmarks, worldLandmarks, handedness);
  }

  async sendError(event: APIGatewayProxyWebsocketEventV2, message: string): Promise<void> {
    await this.messenger.sendError(event, message);
  }
}

function connectionFor(roomCode: string, now: Date): Connection {
  return {
    roomCode,
    createdAt: now.toISOString(),
    expiresAt: Math.floor(now.getTime() / 1000) + 86_400,
  };
}
