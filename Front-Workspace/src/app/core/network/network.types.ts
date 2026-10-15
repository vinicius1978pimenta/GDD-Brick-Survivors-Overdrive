/**
 * Tipos e contratos de rede para comunicação em tempo real com o servidor NestJS (Socket.IO).
 */

export interface PlayerSnapshot {
  readonly id: string;
  readonly name: string;
  readonly x: number;
  readonly y: number;
  readonly z: number;
  readonly rotationY: number;
  readonly speed: number;
  readonly isDriving: boolean;
  readonly isGrounded: boolean;
  readonly vehicleId: string | null;
}

export interface VehicleSnapshot {
  readonly id: string;
  readonly x: number;
  readonly y: number;
  readonly z: number;
  readonly rotationY: number;
  readonly speed: number;
  readonly durability: number;
  readonly driverId: string | null;
}

export interface WorldStateSnapshot {
  readonly tick: number;
  readonly timestamp: number;
  readonly players: PlayerSnapshot[];
  readonly vehicles: VehicleSnapshot[];
  readonly ackInputs: Record<string, number>;
}

export interface PlayerInputPayload {
  readonly seq: number;
  readonly forward: boolean;
  readonly backward: boolean;
  readonly left: boolean;
  readonly right: boolean;
  readonly handbrake: boolean;
  readonly jump: boolean;
  readonly interact: boolean;
  readonly dt: number;
  readonly timestamp: number;
}

export interface PendingInput {
  readonly seq: number;
  readonly input: {
    readonly forward: boolean;
    readonly backward: boolean;
    readonly left: boolean;
    readonly right: boolean;
    readonly handbrake: boolean;
    readonly jump?: boolean;
    readonly interact: boolean;
  };
  readonly dt: number;
  predictedPosition: {
    x: number;
    y: number;
    z: number;
  };
}

export interface JoinGameResponse {
  readonly status: 'ok';
  readonly playerId: string;
  readonly name: string;
  readonly tick: number;
}

export interface PongResponse {
  readonly clientTimestamp: number;
  readonly serverTimestamp: number;
}
