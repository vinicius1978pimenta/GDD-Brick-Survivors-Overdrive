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
  jump?: boolean;
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
  isDestroyed?: boolean;
}

export interface CharacterControllerComponent {
  speed: number;
  maxSpeed: number;
  reverseMaxSpeed?: number;
  acceleration: number;
  deceleration: number;
  turnSpeed?: number;
  jumpForce?: number;
  gravity?: number;
  isGrounded?: boolean;
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
  minX: -68.0,
  maxX: 68.0,
  minZ: -68.0,
  maxZ: 68.0,
};

export interface WorldObstacleAABB {
  readonly id: string;
  readonly minX: number;
  readonly maxX: number;
  readonly minZ: number;
  readonly maxZ: number;
  readonly roofHeight?: number;
}

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

/**
 * Calcula a elevação exata do piso (solo, rampa ou telhado) em coordenadas XZ para o modo ativo.
 */
export function getTerrainHeightAt(
  x: number,
  z: number,
  mode: 'coop_survival' | 'pvp_deathmatch',
): { height: number; isRamp: boolean; isRoof: boolean } {
  const obstacles = mode === 'coop_survival' ? COOP_OUTPOST_OBSTACLES : CITY_OBSTACLES;

  for (const obs of obstacles) {
    if (!obs.roofHeight || obs.roofHeight <= 1.5) {
      continue;
    }
    const roof = obs.roofHeight;
    const rampLength = roof * 1.8;
    const rampWidth = 2.4;
    const posZ = (obs.minZ + obs.maxZ) / 2;
    const rampCenterX = obs.maxX + rampWidth / 2 + 0.1;
    const rampMinX = rampCenterX - rampWidth / 2;
    const rampMaxX = rampCenterX + rampWidth / 2;
    const rampMinZ = posZ - rampLength / 2;
    const rampMaxZ = posZ + rampLength / 2;

    // 1. Está sobre a rampa de acesso
    if (x >= rampMinX - 0.4 && x <= rampMaxX + 0.4 && z >= rampMinZ - 0.4 && z <= rampMaxZ + 0.4) {
      const progress = Math.max(0, Math.min(1, (z - rampMinZ) / rampLength));
      return { height: progress * roof, isRamp: true, isRoof: false };
    }

    // 2. Está sobre o telhado da estrutura (com margem de transição contínua com a rampa)
    if (x >= obs.minX - 0.3 && x <= obs.maxX + 0.4 && z >= obs.minZ - 0.3 && z <= obs.maxZ + 0.3) {
      return { height: roof, isRamp: false, isRoof: true };
    }
  }

  return { height: 0, isRamp: false, isRoof: false };
}

export const FIXED_TIMESTEP = 1 / 60; // 60Hz (~0.0166667s)
export const MAX_FRAME_TIME = 0.25; // Proteção contra espiral da morte
export const VEHICLE_INTERACTION_RADIUS = 2.8; // Raio máximo de embarque em metros
