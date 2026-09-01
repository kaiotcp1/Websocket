import type { APIGatewayProxyWebsocketEventV2 } from 'aws-lambda';
import { type Choice } from '../models/game.js';
import { GameService } from '../services/game-service.js';

type ClientCommand =
  | { action: 'createRoom' }
  | { action: 'joinRoom'; roomCode: string }
  | { action: 'play'; choice: Choice };

const validChoices = new Set<Choice>(['rock', 'paper', 'scissors']);

/** Controller translates the WebSocket message into a use-case call. */
export class WebSocketController {
  constructor(private readonly gameService = new GameService()) {}

  async handleMessage(event: APIGatewayProxyWebsocketEventV2): Promise<number> {
    const command = parseCommand(event.body);
    if (!command) {
      await this.gameService.sendError(event, 'Mensagem inválida. Use createRoom, joinRoom ou play.');
      return 400;
    }

    if (command.action === 'createRoom') await this.gameService.createRoom(event);
    if (command.action === 'joinRoom') await this.gameService.joinRoom(event, command.roomCode);
    if (command.action === 'play') await this.gameService.play(event, command.choice);
    return 200;
  }

  async handleDisconnect(event: APIGatewayProxyWebsocketEventV2): Promise<void> {
    await this.gameService.disconnect(event);
  }

  async handleFailure(event: APIGatewayProxyWebsocketEventV2): Promise<void> {
    await this.gameService.sendError(event, 'Não foi possível processar a sua jogada. Tente novamente.');
  }
}

function parseCommand(body: string | null | undefined): ClientCommand | undefined {
  if (!body) return undefined;
  try {
    const value: unknown = JSON.parse(body);
    if (!value || typeof value !== 'object' || !('action' in value)) return undefined;
    const message = value as { action?: string; roomCode?: unknown; choice?: unknown };
    if (message.action === 'createRoom') return { action: 'createRoom' };
    if (message.action === 'joinRoom' && typeof message.roomCode === 'string') {
      return { action: 'joinRoom', roomCode: message.roomCode.trim().toUpperCase() };
    }
    if (message.action === 'play' && typeof message.choice === 'string' && validChoices.has(message.choice as Choice)) {
      return { action: 'play', choice: message.choice as Choice };
    }
  } catch {
    return undefined;
  }
  return undefined;
}
