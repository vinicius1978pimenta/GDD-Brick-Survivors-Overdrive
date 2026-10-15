import { PlayerInputDto } from '../dto/player-input.dto.js';

export interface ConnectedPlayer {
  id: string;
  name: string;
  x: number;
  y: number;
  z: number;
  vy: number;
  rotationY: number;
  speed: number;
  isDriving: boolean;
  isGrounded: boolean;
  vehicleId: string | null;
  lastProcessedSeq: number;
  pendingInputs: PlayerInputDto[];
  health: number;
  maxHealth: number;
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
  minX: -19,
  maxX: 19,
  minZ: -19,
  maxZ: 19,
} as const;

export const SIMULATION_CONFIG = {
  tickRateHz: 20,
  dt: 0.05, // 1 / 20 = 50ms
  intervalMs: 50,
  maxPendingInputsPerTick: 10,
} as const;

export const VEHICLE_CONFIG = {
  maxSpeed: 18.0,
  reverseMaxSpeed: -8.0,
  acceleration: 14.0,
  brakeForce: 22.0,
  friction: 6.0,
  turnSpeed: 2.8,
  interactionRadius: 2.8,
} as const;

export const PLAYER_CONFIG = {
  maxSpeed: 7.5,
  reverseMaxSpeed: 4.1,
  acceleration: 16.0,
  deceleration: 20.0,
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
