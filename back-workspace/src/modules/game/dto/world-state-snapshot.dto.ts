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

export class WorldStateSnapshotDto {
  readonly tick: number;
  readonly timestamp: number;
  readonly players: PlayerSnapshot[];
  readonly vehicles: VehicleSnapshot[];
  readonly ackInputs: Record<string, number>;
}
