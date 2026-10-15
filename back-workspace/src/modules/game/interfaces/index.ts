export type {
  JoinGameResponse,
  PingPayload,
  PongResponse,
} from './game-gateway.interface.js';

export {
  ARENA_BOUNDS,
  HERO_COLLISION_CONFIG,
  PLAYER_CONFIG,
  SIMULATION_CONFIG,
  VEHICLE_COLLISION_CONFIG,
  VEHICLE_CONFIG,
} from './game-room.interface.js';

export type {
  ConnectedPlayer,
  RoomVehicle,
} from './game-room.interface.js';

export type {
  DamageEventSnapshot,
  PlayerSnapshot,
  ProjectileSnapshot,
  VehicleSnapshot,
} from './snapshot.interface.js';

export {
  WEAPON_CATALOG,
} from './combat.interface.js';

export type {
  ActiveProjectile,
  DamageEvent,
  PlayerShootPayload,
  ShootResult,
  Vector3D,
  WeaponConfig,
  WeaponType,
} from './combat.interface.js';

export {
  COOP_CONFIG,
  ENEMY_CONFIGS,
  PVP_CONFIG,
  UPGRADE_CATALOG,
} from './match.interface.js';

export type {
  EnemyConfig,
  EnemyEntity,
  EnemySnapshot,
  EnemyType,
  GameModeType,
  MatchState,
  MatchStateSnapshot,
  PlayerMatchScore,
  UpgradeOption,
  UpgradeStat,
  WaveConfig,
} from './match.interface.js';

