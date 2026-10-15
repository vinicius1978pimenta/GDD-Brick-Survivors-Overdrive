import { GameModeType, MatchStateSnapshot } from '../../engine/types/match.types';

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
  readonly health?: number;
  readonly maxHealth?: number;
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

export interface ProjectileSnapshot {
  readonly id: string;
  readonly weaponType: 'stud_blaster' | 'scatter_shot' | 'spring_mine';
  readonly x: number;
  readonly y: number;
  readonly z: number;
  readonly vx: number;
  readonly vy: number;
  readonly vz: number;
}

export interface DamageEventSnapshot {
  readonly targetId: string;
  readonly amount: number;
  readonly isVehicle: boolean;
  readonly x: number;
  readonly y: number;
  readonly z: number;
}

export interface WorldStateSnapshot {
  readonly tick: number;
  readonly timestamp: number;
  readonly players: PlayerSnapshot[];
  readonly vehicles: VehicleSnapshot[];
  readonly ackInputs: Record<string, number>;
  readonly projectiles?: ProjectileSnapshot[];
  readonly damageEvents?: DamageEventSnapshot[];
  readonly match?: MatchStateSnapshot;
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
  readonly rotationY?: number;
  readonly dt: number;
  readonly timestamp: number;
}

export interface PlayerShootPayload {
  readonly weaponType: 'stud_blaster' | 'scatter_shot' | 'spring_mine';
  readonly origin: { readonly x: number; readonly y: number; readonly z: number };
  readonly direction: { readonly x: number; readonly y: number; readonly z: number };
  readonly clientTimestamp: number;
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
    readonly rotationY?: number;
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

export type SnapshotCallback = (snapshot: WorldStateSnapshot) => void;
export type MatchSnapshotCallback = (match: MatchStateSnapshot) => void;
