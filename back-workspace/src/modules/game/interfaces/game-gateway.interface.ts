export interface PingPayload {
  readonly clientTimestamp?: number;
  readonly timestamp?: number;
}

export interface PongResponse {
  readonly clientTimestamp: number;
  readonly serverTimestamp: number;
}

export interface JoinGameResponse {
  readonly status: 'ok';
  readonly playerId: string;
  readonly name: string;
  readonly tick: number;
}
