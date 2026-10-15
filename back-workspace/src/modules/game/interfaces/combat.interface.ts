export interface Vector3D {
  readonly x: number;
  readonly y: number;
  readonly z: number;
}

export type WeaponType = 'stud_blaster' | 'scatter_shot' | 'spring_mine';

export interface WeaponConfig {
  readonly type: WeaponType;
  readonly name: string;
  readonly damage: number;
  readonly cooldownMs: number;
  readonly projectileSpeed: number;
  readonly lifespan: number;
  readonly radius: number;
  readonly projectileCount: number;
  readonly spreadAngle?: number;
  readonly isMine?: boolean;
  readonly triggerRadius?: number;
  readonly explosionRadius?: number;
  readonly knockbackForce?: number;
}

export interface ActiveProjectile {
  readonly id: string;
  readonly ownerId: string;
  readonly weaponType: WeaponType;
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  readonly radius: number;
  readonly damage: number;
  remainingLife: number;
  readonly isMine: boolean;
  readonly triggerRadius?: number;
  readonly explosionRadius?: number;
  readonly knockbackForce?: number;
}

export interface DamageEvent {
  readonly targetId: string;
  readonly amount: number;
  readonly isVehicle: boolean;
  readonly x: number;
  readonly y: number;
  readonly z: number;
  readonly attackerId: string;
  readonly weaponType: WeaponType;
  readonly timestamp: number;
  readonly knockbackX?: number;
  readonly knockbackZ?: number;
}

export interface ProjectileSnapshot {
  readonly id: string;
  readonly weaponType: WeaponType;
  readonly x: number;
  readonly y: number;
  readonly z: number;
  readonly vx: number;
  readonly vy: number;
  readonly vz: number;
}

export interface DamageEventSnapshot {
  readonly targetId: string;
  readonly amount: number;
  readonly isVehicle: boolean;
  readonly x: number;
  readonly y: number;
  readonly z: number;
}

export interface PlayerShootPayload {
  readonly weaponType: WeaponType;
  readonly origin: Vector3D;
  readonly direction: Vector3D;
  readonly clientTimestamp: number;
}

export interface ShootResult {
  readonly success: boolean;
  readonly reason?: string;
  readonly projectilesSpawned: number;
}

export const WEAPON_CATALOG: Record<WeaponType, WeaponConfig> = {
  stud_blaster: {
    type: 'stud_blaster',
    name: 'Stud Blaster',
    damage: 15,
    cooldownMs: 150,
    projectileSpeed: 32.0,
    lifespan: 1.5,
    radius: 0.25,
    projectileCount: 1,
  },
  scatter_shot: {
    type: 'scatter_shot',
    name: 'Block Scatter Shot',
    damage: 8,
    cooldownMs: 600,
    projectileSpeed: 24.0,
    lifespan: 0.8,
    radius: 0.2,
    projectileCount: 5,
    spreadAngle: 0.35, // ~20 graus de abertura
  },
  spring_mine: {
    type: 'spring_mine',
    name: 'Spring Mine',
    damage: 50,
    cooldownMs: 1500,
    projectileSpeed: 0,
    lifespan: 30.0,
    radius: 0.5,
    projectileCount: 1,
    isMine: true,
    triggerRadius: 1.8,
    explosionRadius: 3.5,
    knockbackForce: 14.0,
  },
} as const;
