/**
 * Tipos e componentes puros da simulação ECS de Brick Survivors: Overdrive.
 * Camada isomórfica e 100% desacoplada de qualquer biblioteca de renderização (Three.js).
 */

export interface TransformComponent {
  x: number;
  y: number;
  z: number;
  rotationY: number;
}

export interface VelocityComponent {
  vx: number;
  vy: number;
  vz: number;
  angularVelocityY: number;
}

export interface InputState {
  forward: boolean;
  backward: boolean;
  left: boolean;
  right: boolean;
  handbrake: boolean;
  interact: boolean;
}

export interface VehicleComponent {
  currentSpeed: number;
  maxSpeed: number;
  reverseMaxSpeed: number;
  acceleration: number;
  brakeForce: number;
  friction: number;
  turnSpeed: number;
  isDrifting: boolean;
  driverEntityId: number | null;
  driftVelocityX: number;
  driftVelocityZ: number;
}

export interface CharacterControllerComponent {
  speed: number;
  maxSpeed: number;
  acceleration: number;
  deceleration: number;
  isMoving: boolean;
  moveAngle: number;
}

export interface ArenaBounds {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
}

export const DEFAULT_ARENA_BOUNDS: ArenaBounds = {
  minX: -19,
  maxX: 19,
  minZ: -19,
  maxZ: 19,
};

export const FIXED_TIMESTEP = 1 / 60; // 60Hz (~0.0166667s)
export const MAX_FRAME_TIME = 0.25; // Proteção contra espiral da morte
export const VEHICLE_INTERACTION_RADIUS = 2.8; // Raio máximo de embarque em metros
