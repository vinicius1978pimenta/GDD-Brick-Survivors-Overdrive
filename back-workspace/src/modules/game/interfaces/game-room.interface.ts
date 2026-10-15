import { PlayerInputDto } from '../dto/player-input.dto.js';
import type { WeaponType } from './combat.interface.js';

export type CharacterType =
  | 'hobo_lego'
  | 'hillbilly_girl'
  | 'funny_indigenous'
  | 'black_shorts';

export const DEFAULT_CHARACTER_TYPE: CharacterType = 'hobo_lego';

export interface ConnectedPlayer {
  id: string;
  name: string;
  characterType: CharacterType;
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  rotationY: number;
  speed: number;
  isDriving: boolean;
  isGrounded: boolean;
  vehicleId: string | null;
  lastProcessedSeq: number;
  pendingInputs: PlayerInputDto[];
  health: number;
  maxHealth: number;
  weapon: WeaponType;
}

export interface RoomVehicle {
  id: string;
  x: number;
  y: number;
  z: number;
  rotationY: number;
  currentSpeed: number;
  durability: number;
  driverId: string | null;
  driftVelocityX: number;
  driftVelocityZ: number;
  isDrifting: boolean;
}

export interface WorldObstacleAABB {
  readonly id: string;
  readonly minX: number;
  readonly maxX: number;
  readonly minZ: number;
  readonly maxZ: number;
}

export type KillReason = 'combat' | 'atropelamento';

export interface KillEvent {
  readonly killerId: string;
  readonly killerName: string;
  readonly victimId: string;
  readonly victimName: string;
  readonly reason: KillReason;
  readonly timestamp: number;
}

export const ARENA_BOUNDS = {
  minX: -68,
  maxX: 68,
  minZ: -68,
  maxZ: 68,
} as const;

export const CITY_OBSTACLES: WorldObstacleAABB[] = [
  // Prédio Central Norte (Edifício Comercial de Blocos)
  { id: 'building_center_north', minX: -10, maxX: 10, minZ: -55, maxZ: -38 },
  // Centro Logístico Sul
  { id: 'building_center_south', minX: -10, maxX: 10, minZ: 38, maxZ: 55 },
  // Complexo Residencial Oeste
  { id: 'building_west', minX: -55, maxX: -38, minZ: -12, maxZ: 12 },
  // Complexo Comercial Leste
  { id: 'building_east', minX: 38, maxX: 55, minZ: -12, maxZ: 12 },
  // Galpão Industrial Noroeste
  { id: 'warehouse_nw', minX: -50, maxX: -34, minZ: -45, maxZ: -30 },
  // Depósito de Carga Nordeste
  { id: 'cargo_ne', minX: 34, maxX: 50, minZ: -45, maxZ: -30 },
  // Instalação de Armazenamento Sudoeste
  { id: 'storage_sw', minX: -50, maxX: -34, minZ: 35, maxZ: 50 },
  // Subestação de Energia Sudeste
  { id: 'power_se', minX: 34, maxX: 50, minZ: 35, maxZ: 50 },
  // Monumento Central da Praça
  { id: 'monument_center', minX: -3.5, maxX: 3.5, minZ: -18, maxZ: -11 },
  // Posto Urbano de Combustível
  { id: 'gas_station', minX: 12, maxX: 20, minZ: -8, maxZ: 2 },
  // Oficina Mecânica
  { id: 'repair_garage', minX: -20, maxX: -12, minZ: -8, maxZ: 2 },
];

export const SIMULATION_CONFIG = {
  tickRateHz: 20,
  dt: 0.05, // 1 / 20 = 50ms
  intervalMs: 50,
  maxPendingInputsPerTick: 30,
} as const;

export const VEHICLE_CONFIG = {
  maxSpeed: 22.0,
  reverseMaxSpeed: -8.0,
  acceleration: 16.0,
  brakeForce: 26.0,
  friction: 7.0,
  turnSpeed: 2.85,
  interactionRadius: 2.8,
} as const;

export const PLAYER_CONFIG = {
  maxSpeed: 8.0,
  reverseMaxSpeed: 4.5,
  acceleration: 22.0,
  deceleration: 26.0,
  turnSpeed: 3.8,
  jumpForce: 7.2,
  gravity: 18.0,
  maxHealth: 100,
} as const;

export const VEHICLE_COLLISION_CONFIG = {
  halfWidth: 0.9,
  halfLength: 1.6,
  radius: 1.6,
} as const;

export const HERO_COLLISION_CONFIG = {
  radius: 0.5,
} as const;
