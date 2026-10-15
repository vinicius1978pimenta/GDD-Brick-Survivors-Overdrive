import { ArenaBounds, TransformComponent } from './types/ecs.types';
import { DebrisParticle, ModularVehicleComponent, Vector3D } from './modular-block.types';
import { applyDamageToBlock } from './modular-block.system';
import { ObjectPool } from './object-pool';
import {
  LocalDamageEvent,
  ProjectileEntity,
  WEAPON_CATALOG,
  WeaponType,
} from './interfaces/combat.interface';
import { SpatialHashGrid } from './spatial-hash-grid';

/**
 * Cria um pool de entidades de projéteis reutilizáveis.
 */
export function createProjectilePool(initialCapacity = 64): ObjectPool<ProjectileEntity> {
  let counter = 0;
  return new ObjectPool<ProjectileEntity>(
    () => ({
      id: `proj_${++counter}`,
      ownerId: '',
      weaponType: 'stud_blaster',
      x: 0,
      y: 0,
      z: 0,
      vx: 0,
      vy: 0,
      vz: 0,
      radius: 0.25,
      damage: 15,
      remainingLife: 1.5,
      isMine: false,
      active: false,
      triggerRadius: undefined,
      explosionRadius: undefined,
      knockbackForce: undefined,
    }),
    (p) => {
      p.active = false;
      p.remainingLife = 0;
      p.vx = 0;
      p.vy = 0;
      p.vz = 0;
      p.isMine = false;
    },
    initialCapacity,
  );
}

/**
 * Instancia e ejeta projéteis da arma atual a partir de uma origem e vetor unitário de direção.
 */
export function spawnProjectiles(
  weaponType: WeaponType,
  ownerId: string,
  origin: Vector3D,
  direction: Vector3D,
  pool: ObjectPool<ProjectileEntity>,
  activeList: ProjectileEntity[],
): number {
  const config = WEAPON_CATALOG[weaponType];
  if (!config) {
    return 0;
  }

  // Normalização do vetor de direção 3D completo
  const len3D = Math.hypot(direction.x, direction.y, direction.z) || 1;
  const normX = direction.x / len3D;
  const normY = direction.y / len3D;
  const normZ = direction.z / len3D;

  const lenXZ = Math.hypot(normX, normZ) || 0.0001;
  const baseAngle = Math.atan2(normX, normZ);
  const dirY = normY;

  let spawned = 0;

  for (let i = 0; i < config.projectileCount; i++) {
    const proj = pool.acquire();
    proj.ownerId = ownerId;
    proj.weaponType = weaponType;
    proj.damage = config.damage;
    proj.radius = config.radius;
    proj.remainingLife = config.lifespan;
    proj.isMine = Boolean(config.isMine);
    proj.active = true;
    proj.triggerRadius = config.triggerRadius;
    proj.explosionRadius = config.explosionRadius;
    proj.knockbackForce = config.knockbackForce;

    if (config.isMine) {
      // Mina é posicionada diretamente no solo
      proj.x = origin.x;
      proj.y = 0.1;
      proj.z = origin.z;
      proj.vx = 0;
      proj.vy = 0;
      proj.vz = 0;
    } else {
      // Disparo balístico cinético 3D
      let angle = baseAngle;
      if (config.projectileCount > 1 && config.spreadAngle) {
        const spreadStep = config.spreadAngle / (config.projectileCount - 1);
        const offset = -config.spreadAngle / 2 + i * spreadStep;
        angle += offset;
      }

      proj.x = origin.x + Math.sin(angle) * lenXZ * 0.8;
      proj.y = Math.max(0.4, origin.y + dirY * 0.8);
      proj.z = origin.z + Math.cos(angle) * lenXZ * 0.8;
      proj.vx = Math.sin(angle) * lenXZ * config.projectileSpeed;
      proj.vy = dirY * config.projectileSpeed;
      proj.vz = Math.cos(angle) * lenXZ * config.projectileSpeed;
    }

    activeList.push(proj);
    spawned++;
  }

  return spawned;
}

/**
 * Atualiza o sistema de projéteis e testes de impacto e proximidade via SpatialHashGrid.
 */
export function updateCombatSystem(
  activeProjectiles: ProjectileEntity[],
  pool: ObjectPool<ProjectileEntity>,
  spatialGrid: SpatialHashGrid,
  dt: number,
  bounds: ArenaBounds,
  vehicleTransform: TransformComponent,
  modularVehicle: ModularVehicleComponent,
  debrisPool: ObjectPool<DebrisParticle>,
  activeDebris: DebrisParticle[],
  onDamageApplied?: (damageEvent: LocalDamageEvent) => void,
): void {
  for (let i = activeProjectiles.length - 1; i >= 0; i--) {
    const p = activeProjectiles[i];

    p.remainingLife -= dt;
    if (p.remainingLife <= 0) {
      pool.release(p);
      activeProjectiles.splice(i, 1);
      continue;
    }

    if (!p.isMine) {
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.z += p.vz * dt;

      // Limites da arena e colisão com solo/teto
      if (
        p.x < bounds.minX - 2 ||
        p.x > bounds.maxX + 2 ||
        p.z < bounds.minZ - 2 ||
        p.z > bounds.maxZ + 2 ||
        p.y < 0 ||
        p.y > 100
      ) {
        pool.release(p);
        activeProjectiles.splice(i, 1);
        continue;
      }
    }

    // Broad-Phase via SpatialHashGrid
    const queryRadius = p.isMine ? (p.triggerRadius ?? 1.8) : p.radius + 1.2;
    const nearbyEntities = spatialGrid.queryNearby({ x: p.x, y: p.y, z: p.z }, queryRadius);

    let impacted = false;

    if (p.isMine) {
      // Checagem de gatilho de proximidade para mina
      for (const entityId of nearbyEntities) {
        if (entityId === p.ownerId) continue;

        const entityBounds = spatialGrid.getEntityBounds(entityId);
        if (!entityBounds) continue;

        const dist = Math.hypot(p.x - entityBounds.position.x, p.z - entityBounds.position.z);
        if (dist <= (p.triggerRadius ?? 1.8) + entityBounds.radius) {
          // Detonação em área (AoE)
          impacted = true;
          const explosionRadius = p.explosionRadius ?? 3.5;
          const affectedEntities = spatialGrid.queryNearby(
            { x: p.x, y: p.y, z: p.z },
            explosionRadius,
          );

          for (const affId of affectedEntities) {
            const affBounds = spatialGrid.getEntityBounds(affId);
            if (!affBounds) continue;
            const affDist = Math.hypot(p.x - affBounds.position.x, p.z - affBounds.position.z);
            if (affDist <= explosionRadius + affBounds.radius) {
              const damage = p.damage;
              const isVehicle = affId.startsWith('vehicle');

              if (isVehicle) {
                // Danifica bloco mais próximo
                damageModularVehicle(
                  modularVehicle,
                  vehicleTransform,
                  p.x,
                  p.z,
                  damage,
                  debrisPool,
                  activeDebris,
                );
              }

              if (onDamageApplied) {
                onDamageApplied({
                  targetId: affId,
                  amount: damage,
                  isVehicle,
                  x: affBounds.position.x,
                  y: affBounds.position.y + 0.5,
                  z: affBounds.position.z,
                  weaponType: p.weaponType,
                  timestamp: Date.now(),
                });
              }
            }
          }
          break;
        }
      }
    } else {
      // Projétil balístico colide com a primeira entidade válida
      for (const entityId of nearbyEntities) {
        if (entityId === p.ownerId) continue;

        const entityBounds = spatialGrid.getEntityBounds(entityId);
        if (!entityBounds) continue;

        const dist = Math.hypot(p.x - entityBounds.position.x, p.z - entityBounds.position.z);
        if (dist <= p.radius + entityBounds.radius) {
          impacted = true;
          const isVehicle = entityId.startsWith('vehicle');

          if (isVehicle) {
            damageModularVehicle(
              modularVehicle,
              vehicleTransform,
              p.x,
              p.z,
              p.damage,
              debrisPool,
              activeDebris,
            );
          }

          if (onDamageApplied) {
            onDamageApplied({
              targetId: entityId,
              amount: p.damage,
              isVehicle,
              x: p.x,
              y: p.y,
              z: p.z,
              weaponType: p.weaponType,
              timestamp: Date.now(),
            });
          }
          break;
        }
      }
    }

    if (impacted) {
      pool.release(p);
      activeProjectiles.splice(i, 1);
    }
  }
}

/**
 * Danifica os blocos periféricos do veículo modular com base no ponto de impacto.
 */
function damageModularVehicle(
  modularVehicle: ModularVehicleComponent,
  vehicleTransform: TransformComponent,
  impactX: number,
  impactZ: number,
  damage: number,
  debrisPool: ObjectPool<DebrisParticle>,
  activeDebris: DebrisParticle[],
): void {
  const attachedBlocks = modularVehicle.blocks.filter((b) => !b.isDetached);
  if (attachedBlocks.length === 0) return;

  // Encontra o bloco modular mais próximo do impacto
  let closestBlock = attachedBlocks[0];
  let minDistance = Infinity;

  const cosAngle = Math.cos(vehicleTransform.rotationY);
  const sinAngle = Math.sin(vehicleTransform.rotationY);

  for (const block of attachedBlocks) {
    const worldX =
      vehicleTransform.x + block.relativePos.x * cosAngle - block.relativePos.z * sinAngle;
    const worldZ =
      vehicleTransform.z + block.relativePos.x * sinAngle + block.relativePos.z * cosAngle;

    const dist = Math.hypot(impactX - worldX, impactZ - worldZ);
    if (dist < minDistance) {
      minDistance = dist;
      closestBlock = block;
    }
  }

  applyDamageToBlock(
    modularVehicle,
    closestBlock.id,
    damage,
    vehicleTransform,
    debrisPool,
    activeDebris,
  );
}
