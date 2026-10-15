import type { PlayerSnapshot, VehicleSnapshot } from '../interfaces/index.js';

export type { PlayerSnapshot, VehicleSnapshot };

export class WorldStateSnapshotDto {
  readonly tick: number;
  readonly timestamp: number;
  readonly players: PlayerSnapshot[];
  readonly vehicles: VehicleSnapshot[];
  readonly ackInputs: Record<string, number>;
}
