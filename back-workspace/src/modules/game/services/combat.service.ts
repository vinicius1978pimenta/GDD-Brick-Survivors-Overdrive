import { Injectable, Logger } from '@nestjs/common';
import { SpatialHashGrid } from '../utils/spatial-hash-grid.js';
import { ARENA_BOUNDS, WEAPON_CATALOG } from '../interfaces/index.js';
import type {
  ActiveProjectile,
  ConnectedPlayer,
  DamageEvent,
  PlayerShootPayload,
  RoomVehicle,
  ShootResult,
  Vector3D,
  WeaponConfig,
  WeaponType,
} from '../interfaces/index.js';

@Injectable()
export class CombatService {
  private readonly logger = new Logger(CombatService.name);
  private readonly targetGrid = new SpatialHashGrid(8.0);
  private readonly playerCooldowns = new Map<string, Map<WeaponType, number>>();
  private projectiles: ActiveProjectile[] = [];
  private projectileSeq = 0;

  public getActiveProjectiles(): ActiveProjectile[] {
    return [...this.projectiles];
  }

  public getTargetGrid(): SpatialHashGrid {
    return this.targetGrid;
  }

  public resetPlayerCooldowns(playerId: string): void {
    this.playerCooldowns.delete(playerId);
  }

  public clear(): void {
    this.projectiles = [];
    this.playerCooldowns.clear();
    this.targetGrid.clear();
    this.projectileSeq = 0;
  }

  public handleShoot(
    playerId: string,
    payload: PlayerShootPayload,
    now: number = Date.now(),
  ): ShootResult {
    const weaponConfig = WEAPON_CATALOG[payload.weaponType];
    if (!weaponConfig) {
      return {
        success: false,
        reason: `Unknown weapon type: ${String(payload.weaponType)}`,
        projectilesSpawned: 0,
      };
    }

    if (!this.canShoot(playerId, payload.weaponType, weaponConfig, now)) {
      return {
        success: false,
        reason: 'Weapon cooldown active',
        projectilesSpawned: 0,
      };
    }

    this.recordCooldown(playerId, payload.weaponType, now);
    const spawnedCount = this.spawnProjectiles(playerId, weaponConfig, payload);

    return {
      success: true,
      projectilesSpawned: spawnedCount,
    };
  }

  public update(
    dt: number,
    players: Map<string, ConnectedPlayer>,
    vehicles: Map<string, RoomVehicle>,
  ): { damageEvents: DamageEvent[]; activeProjectiles: ActiveProjectile[] } {
    this.syncTargetGrid(players, vehicles);

    const damageEvents: DamageEvent[] = [];
    const remainingProjectiles: ActiveProjectile[] = [];

    for (const proj of this.projectiles) {
      proj.remainingLife -= dt;
      if (proj.remainingLife <= 0) {
        continue;
      }

      if (proj.isMine) {
        const detonated = this.processMine(proj, dt, players, vehicles, damageEvents);
        if (!detonated) {
          remainingProjectiles.push(proj);
        }
      } else {
        const hit = this.processProjectile(proj, dt, players, vehicles, damageEvents);
        if (!hit) {
          remainingProjectiles.push(proj);
        }
      }
    }

    this.projectiles = remainingProjectiles;
    return {
      damageEvents,
      activeProjectiles: this.projectiles,
    };
  }

  private canShoot(
    playerId: string,
    weaponType: WeaponType,
    config: WeaponConfig,
    now: number,
  ): boolean {
    const playerTimestamps = this.playerCooldowns.get(playerId);
    if (!playerTimestamps) {
      return true;
    }

    const lastShot = playerTimestamps.get(weaponType);
    if (lastShot === undefined) {
      return true;
    }

    return now - lastShot >= config.cooldownMs;
  }

  private recordCooldown(playerId: string, weaponType: WeaponType, now: number): void {
    let playerTimestamps = this.playerCooldowns.get(playerId);
    if (!playerTimestamps) {
      playerTimestamps = new Map<WeaponType, number>();
      this.playerCooldowns.set(playerId, playerTimestamps);
    }
    playerTimestamps.set(weaponType, now);
  }

  private spawnProjectiles(
    playerId: string,
    config: WeaponConfig,
    payload: PlayerShootPayload,
  ): number {
    const normDir = this.normalizeDirection(payload.direction);

    if (config.isMine) {
      this.projectileSeq++;
      const mine: ActiveProjectile = {
        id: `mine-${playerId}-${this.projectileSeq}`,
        ownerId: playerId,
        weaponType: config.type,
        x: payload.origin.x,
        y: 0,
        z: payload.origin.z,
        vx: 0,
        vy: 0,
        vz: 0,
        radius: config.radius,
        damage: config.damage,
        remainingLife: config.lifespan,
        isMine: true,
        triggerRadius: config.triggerRadius ?? 1.8,
        explosionRadius: config.explosionRadius ?? 3.5,
        knockbackForce: config.knockbackForce ?? 14.0,
      };
      this.projectiles.push(mine);
      return 1;
    }

    if (config.type === 'scatter_shot') {
      const count = config.projectileCount ?? 5;
      const totalSpread = config.spreadAngle ?? 0.35;
      const baseAngle = Math.atan2(normDir.x, normDir.z);
      const angleStep = count > 1 ? totalSpread / (count - 1) : 0;
      const startAngle = baseAngle - totalSpread / 2;
      const lenXZ = Math.hypot(normDir.x, normDir.z) || 0.001;

      for (let i = 0; i < count; i++) {
        this.projectileSeq++;
        const angle = startAngle + i * angleStep;
        const vx = Math.sin(angle) * lenXZ * config.projectileSpeed;
        const vz = Math.cos(angle) * lenXZ * config.projectileSpeed;
        const vy = normDir.y * config.projectileSpeed;

        const projectile: ActiveProjectile = {
          id: `scatter-${playerId}-${this.projectileSeq}`,
          ownerId: playerId,
          weaponType: config.type,
          x: payload.origin.x,
          y: Math.max(0.5, payload.origin.y),
          z: payload.origin.z,
          vx,
          vy,
          vz,
          radius: config.radius,
          damage: config.damage,
          remainingLife: config.lifespan,
          isMine: false,
        };
        this.projectiles.push(projectile);
      }
      return count;
    }

    // Default: linear projectile (stud_blaster)
    this.projectileSeq++;
    const vx = normDir.x * config.projectileSpeed;
    const vy = normDir.y * config.projectileSpeed;
    const vz = normDir.z * config.projectileSpeed;

    const projectile: ActiveProjectile = {
      id: `stud-${playerId}-${this.projectileSeq}`,
      ownerId: playerId,
      weaponType: config.type,
      x: payload.origin.x,
      y: Math.max(0.5, payload.origin.y),
      z: payload.origin.z,
      vx,
      vy,
      vz,
      radius: config.radius,
      damage: config.damage,
      remainingLife: config.lifespan,
      isMine: false,
    };
    this.projectiles.push(projectile);
    return 1;
  }

  private processProjectile(
    proj: ActiveProjectile,
    dt: number,
    players: Map<string, ConnectedPlayer>,
    vehicles: Map<string, RoomVehicle>,
    damageEvents: DamageEvent[],
  ): boolean {
    proj.x += proj.vx * dt;
    proj.y += proj.vy * dt;
    proj.z += proj.vz * dt;

    if (
      proj.x < ARENA_BOUNDS.minX ||
      proj.x > ARENA_BOUNDS.maxX ||
      proj.z < ARENA_BOUNDS.minZ ||
      proj.z > ARENA_BOUNDS.maxZ ||
      proj.y < 0 ||
      proj.y > 100
    ) {
      return true;
    }

    const nearbyTargetKeys = this.targetGrid.queryNearby(
      { x: proj.x, y: proj.y, z: proj.z },
      proj.radius + 1.5,
    );

    for (const key of nearbyTargetKeys) {
      if (key.startsWith('player:')) {
        const targetPlayerId = key.substring(7);
        if (targetPlayerId === proj.ownerId) {
          continue;
        }

        const targetPlayer = players.get(targetPlayerId);
        if (!targetPlayer) {
          continue;
        }

        const dist = Math.hypot(
          proj.x - targetPlayer.x,
          proj.y - (targetPlayer.y + 0.9),
          proj.z - targetPlayer.z,
        );

        const playerRadius = 0.65;
        if (dist <= proj.radius + playerRadius) {
          targetPlayer.health = Math.max(0, targetPlayer.health - proj.damage);
          damageEvents.push({
            targetId: targetPlayer.id,
            amount: proj.damage,
            isVehicle: false,
            x: targetPlayer.x,
            y: targetPlayer.y,
            z: targetPlayer.z,
            attackerId: proj.ownerId,
            weaponType: proj.weaponType,
            timestamp: Date.now(),
          });
          return true;
        }
      } else if (key.startsWith('vehicle:')) {
        const vehicleId = key.substring(8);
        const vehicle = vehicles.get(vehicleId);
        if (!vehicle) {
          continue;
        }

        if (vehicle.driverId === proj.ownerId) {
          continue;
        }

        const dist = Math.hypot(
          proj.x - vehicle.x,
          proj.y - (vehicle.y + 0.6),
          proj.z - vehicle.z,
        );

        const vehicleRadius = 1.4;
        if (dist <= proj.radius + vehicleRadius) {
          vehicle.durability = Math.max(0, vehicle.durability - proj.damage);
          if (vehicle.durability <= 0 && vehicle.driverId) {
            const driver = players.get(vehicle.driverId);
            if (driver) {
              driver.isDriving = false;
              driver.vehicleId = null;
            }
            vehicle.driverId = null;
            vehicle.currentSpeed = 0;
            vehicle.isDrifting = false;
          }

          damageEvents.push({
            targetId: vehicle.id,
            amount: proj.damage,
            isVehicle: true,
            x: vehicle.x,
            y: vehicle.y,
            z: vehicle.z,
            attackerId: proj.ownerId,
            weaponType: proj.weaponType,
            timestamp: Date.now(),
          });
          return true;
        }
      }
    }

    return false;
  }

  private processMine(
    mine: ActiveProjectile,
    _dt: number,
    players: Map<string, ConnectedPlayer>,
    vehicles: Map<string, RoomVehicle>,
    damageEvents: DamageEvent[],
  ): boolean {
    const triggerRadius = mine.triggerRadius ?? 1.8;
    const explosionRadius = mine.explosionRadius ?? 3.5;
    const knockbackForce = mine.knockbackForce ?? 14.0;

    const nearbyTargetKeys = this.targetGrid.queryNearby(
      { x: mine.x, y: mine.y, z: mine.z },
      triggerRadius + 1.5,
    );

    let triggered = false;
    for (const key of nearbyTargetKeys) {
      if (key.startsWith('player:')) {
        const targetId = key.substring(7);
        if (targetId === mine.ownerId && mine.remainingLife > 28.5) {
          continue;
        }
        const target = players.get(targetId);
        if (!target) {
          continue;
        }
        const dist = Math.hypot(mine.x - target.x, mine.z - target.z);
        if (dist <= triggerRadius + 0.65) {
          triggered = true;
          break;
        }
      } else if (key.startsWith('vehicle:')) {
        const vehicleId = key.substring(8);
        const vehicle = vehicles.get(vehicleId);
        if (!vehicle) {
          continue;
        }
        if (vehicle.driverId === mine.ownerId && mine.remainingLife > 28.5) {
          continue;
        }
        const dist = Math.hypot(mine.x - vehicle.x, mine.z - vehicle.z);
        if (dist <= triggerRadius + 1.4) {
          triggered = true;
          break;
        }
      }
    }

    if (!triggered) {
      return false;
    }

    // Detonate area damage
    const affectedTargetKeys = this.targetGrid.queryNearby(
      { x: mine.x, y: mine.y, z: mine.z },
      explosionRadius + 1.5,
    );

    const now = Date.now();
    for (const key of affectedTargetKeys) {
      if (key.startsWith('player:')) {
        const targetId = key.substring(7);
        const target = players.get(targetId);
        if (!target) {
          continue;
        }

        const dist = Math.hypot(mine.x - target.x, mine.z - target.z);
        if (dist <= explosionRadius + 0.65) {
          target.health = Math.max(0, target.health - mine.damage);

          const safeDist = Math.max(0.1, dist);
          const dirX = (target.x - mine.x) / safeDist;
          const dirZ = (target.z - mine.z) / safeDist;
          target.x += dirX * 1.5;
          target.z += dirZ * 1.5;
          target.y = Math.max(target.y, 1.2);
          target.vy = 8.0;
          target.isGrounded = false;

          target.x = Math.max(ARENA_BOUNDS.minX, Math.min(ARENA_BOUNDS.maxX, target.x));
          target.z = Math.max(ARENA_BOUNDS.minZ, Math.min(ARENA_BOUNDS.maxZ, target.z));

          damageEvents.push({
            targetId: target.id,
            amount: mine.damage,
            isVehicle: false,
            x: target.x,
            y: target.y,
            z: target.z,
            attackerId: mine.ownerId,
            weaponType: mine.weaponType,
            timestamp: now,
            knockbackX: dirX * knockbackForce,
            knockbackZ: dirZ * knockbackForce,
          });
        }
      } else if (key.startsWith('vehicle:')) {
        const vehicleId = key.substring(8);
        const vehicle = vehicles.get(vehicleId);
        if (!vehicle) {
          continue;
        }

        const dist = Math.hypot(mine.x - vehicle.x, mine.z - vehicle.z);
        if (dist <= explosionRadius + 1.4) {
          vehicle.durability = Math.max(0, vehicle.durability - mine.damage);
          const safeDist = Math.max(0.1, dist);
          const dirX = (vehicle.x - mine.x) / safeDist;
          const dirZ = (vehicle.z - mine.z) / safeDist;
          vehicle.x += dirX * 2.0;
          vehicle.z += dirZ * 2.0;
          vehicle.currentSpeed = Math.sign(vehicle.currentSpeed) * (Math.abs(vehicle.currentSpeed) + 4.0);

          vehicle.x = Math.max(ARENA_BOUNDS.minX, Math.min(ARENA_BOUNDS.maxX, vehicle.x));
          vehicle.z = Math.max(ARENA_BOUNDS.minZ, Math.min(ARENA_BOUNDS.maxZ, vehicle.z));

          if (vehicle.durability <= 0 && vehicle.driverId) {
            const driver = players.get(vehicle.driverId);
            if (driver) {
              driver.isDriving = false;
              driver.vehicleId = null;
            }
            vehicle.driverId = null;
            vehicle.currentSpeed = 0;
            vehicle.isDrifting = false;
          }

          damageEvents.push({
            targetId: vehicle.id,
            amount: mine.damage,
            isVehicle: true,
            x: vehicle.x,
            y: vehicle.y,
            z: vehicle.z,
            attackerId: mine.ownerId,
            weaponType: mine.weaponType,
            timestamp: now,
            knockbackX: dirX * knockbackForce,
            knockbackZ: dirZ * knockbackForce,
          });
        }
      }
    }

    return true;
  }

  private syncTargetGrid(
    players: Map<string, ConnectedPlayer>,
    vehicles: Map<string, RoomVehicle>,
  ): void {
    this.targetGrid.clear();

    for (const player of players.values()) {
      if (!player.isDriving) {
        this.targetGrid.insert(
          `player:${player.id}`,
          { x: player.x, y: player.y + 0.9, z: player.z },
          0.65,
        );
      }
    }

    for (const vehicle of vehicles.values()) {
      this.targetGrid.insert(
        `vehicle:${vehicle.id}`,
        { x: vehicle.x, y: vehicle.y + 0.6, z: vehicle.z },
        1.4,
      );
    }
  }

  private normalizeDirection(dir: Vector3D): Vector3D {
    const len = Math.hypot(dir.x, dir.y, dir.z);
    if (len === 0) {
      return { x: 0, y: 0, z: 1 };
    }
    return {
      x: dir.x / len,
      y: dir.y / len,
      z: dir.z / len,
    };
  }
}
