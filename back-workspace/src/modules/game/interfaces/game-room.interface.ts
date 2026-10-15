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
  readonly roofHeight?: number;
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
  { id: 'building_center_north', minX: -10, maxX: 10, minZ: -55, maxZ: -38, roofHeight: 7.2 },
  // Centro Logístico Sul
  { id: 'building_center_south', minX: -10, maxX: 10, minZ: 38, maxZ: 55, roofHeight: 5.6 },
  // Complexo Residencial Oeste
  { id: 'building_west', minX: -55, maxX: -38, minZ: -12, maxZ: 12, roofHeight: 8.8 },
  // Complexo Comercial Leste
  { id: 'building_east', minX: 38, maxX: 55, minZ: -12, maxZ: 12, roofHeight: 8.8 },
  // Galpão Industrial Noroeste
  { id: 'warehouse_nw', minX: -50, maxX: -34, minZ: -45, maxZ: -30, roofHeight: 5.4 },
  // Depósito de Carga Nordeste
  { id: 'cargo_ne', minX: 34, maxX: 50, minZ: -45, maxZ: -30, roofHeight: 5.4 },
  // Instalação de Armazenamento Sudoeste
  { id: 'storage_sw', minX: -50, maxX: -34, minZ: 35, maxZ: 50, roofHeight: 5.4 },
  // Subestação de Energia Sudeste
  { id: 'power_se', minX: 34, maxX: 50, minZ: 35, maxZ: 50, roofHeight: 4.8 },
  // Monumento Central da Praça
  { id: 'monument_center', minX: -3.5, maxX: 3.5, minZ: -18, maxZ: -11, roofHeight: 3.2 },
  // Posto Urbano de Combustível
  { id: 'gas_station', minX: 12, maxX: 20, minZ: -8, maxZ: 2, roofHeight: 4.2 },
  // Oficina Mecânica
  { id: 'repair_garage', minX: -20, maxX: -12, minZ: -8, maxZ: 2, roofHeight: 4.5 },
];

export const COOP_OUTPOST_OBSTACLES: WorldObstacleAABB[] = [
  // 4 Casas do Outpost Rural (com rampas aos telhados)
  { id: 'coop_house_nw', minX: -41, maxX: -29, minZ: -40, maxZ: -30, roofHeight: 5.4 },
  { id: 'coop_house_ne', minX: 29, maxX: 41, minZ: -40, maxZ: -30, roofHeight: 5.4 },
  { id: 'coop_house_sw', minX: -42, maxX: -28, minZ: 28, maxZ: 42, roofHeight: 5.8 },
  { id: 'coop_house_se', minX: 28, maxX: 42, minZ: 28, maxZ: 42, roofHeight: 5.8 },

  // Contêineres Industriais de Carga
  { id: 'coop_container_1', minX: -18, maxX: -14, minZ: -21, maxZ: -15, roofHeight: 2.2 },
  { id: 'coop_container_2', minX: 14, maxX: 18, minZ: -21, maxZ: -15, roofHeight: 2.2 },
  { id: 'coop_container_3', minX: -18, maxX: -14, minZ: 15, maxZ: 21, roofHeight: 2.2 },
  { id: 'coop_container_4', minX: 14, maxX: 18, minZ: 15, maxZ: 21, roofHeight: 2.2 },
  { id: 'coop_container_5', minX: -3, maxX: 3, minZ: 26, maxZ: 30, roofHeight: 2.2 },

  // Barricadas de Concreto Reforçado
  { id: 'coop_barricade_1', minX: -12.5, maxX: -7.5, minZ: -9, maxZ: -7, roofHeight: 1.2 },
  { id: 'coop_barricade_2', minX: 7.5, maxX: 12.5, minZ: -9, maxZ: -7, roofHeight: 1.2 },
  { id: 'coop_barricade_3', minX: -12.5, maxX: -7.5, minZ: 7, maxZ: 9, roofHeight: 1.2 },
  { id: 'coop_barricade_4', minX: 7.5, maxX: 12.5, minZ: 7, maxZ: 9, roofHeight: 1.2 },
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
