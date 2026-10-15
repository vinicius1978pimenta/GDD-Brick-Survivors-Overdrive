import type {
  DamageEventSnapshot,
  MatchStateSnapshot,
  PlayerSnapshot,
  ProjectileSnapshot,
  VehicleSnapshot,
} from '../interfaces/index.js';

export type {
  DamageEventSnapshot,
  MatchStateSnapshot,
  PlayerSnapshot,
  ProjectileSnapshot,
  VehicleSnapshot,
};

export class WorldStateSnapshotDto {
  readonly tick: number;
  readonly timestamp: number;
  readonly players: PlayerSnapshot[];
  readonly vehicles: VehicleSnapshot[];
  readonly ackInputs: Record<string, number>;
  readonly projectiles: ProjectileSnapshot[];
  readonly damageEvents: DamageEventSnapshot[];
  readonly match?: MatchStateSnapshot;
}
