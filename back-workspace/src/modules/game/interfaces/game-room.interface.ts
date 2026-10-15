import { PlayerInputDto } from '../dto/player-input.dto.js';
import type { WeaponType } from './combat.interface.js';

export interface ConnectedPlayer {
  id: string;
  name: string;
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

export const ARENA_BOUNDS = {
  minX: -49,
  maxX: 49,
  minZ: -49,
  maxZ: 49,
} as const;

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
