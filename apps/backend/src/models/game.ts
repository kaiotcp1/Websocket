export type Choice = 'rock' | 'paper' | 'scissors';
export type RoomStatus = 'waiting' | 'active' | 'finished' | 'abandoned';
export type PlayerPosition = 'playerOne' | 'playerTwo';
export type HandLandmark = readonly [number, number, number];
export type Handedness = 'Left' | 'Right';

export interface Room {
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

export interface Connection {
  roomCode: string;
  createdAt: string;
  expiresAt: number;
}

export function createRoom(code: string, connectionId: string, now: Date): Room {
  return {
    code,
    status: 'waiting',
    playerOne: connectionId,
    choices: {},
    createdAt: now.toISOString(),
    updatedAt: now.toISOString(),
    // TTL is cleanup only. The application never depends on its exact execution time.
    expiresAt: Math.floor(now.getTime() / 1000) + 86_400,
  };
}

export function playerPosition(room: Room, connectionId: string): PlayerPosition | undefined {
  if (room.playerOne === connectionId) return 'playerOne';
  if (room.playerTwo === connectionId) return 'playerTwo';
  return undefined;
}

export function hasBothChoices(room: Room): room is Room & { playerTwo: string } {
  return Boolean(room.playerTwo && room.choices[room.playerOne] && room.choices[room.playerTwo]);
}

export function decideWinner(first: Choice, second: Choice): PlayerPosition | 'draw' {
  if (first === second) return 'draw';
  const firstWins =
    (first === 'rock' && second === 'scissors') ||
    (first === 'paper' && second === 'rock') ||
    (first === 'scissors' && second === 'paper');
  return firstWins ? 'playerOne' : 'playerTwo';
}
