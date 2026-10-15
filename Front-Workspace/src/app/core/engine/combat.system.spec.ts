import { describe, expect, it } from 'vitest';
import {
  createProjectilePool,
  spawnProjectiles,
  updateCombatSystem,
} from './combat.system';
import {
  LocalDamageEvent,
  ProjectileEntity,
  WEAPON_CATALOG,
} from './interfaces/combat.interface';
import { SpatialHashGrid } from './spatial-hash-grid';
import {
  createDebrisFactory,
  createDefaultBuggyBlocks,
} from './modular-block.system';
import { ObjectPool } from './object-pool';
import { DebrisParticle, ModularVehicleComponent } from './modular-block.types';
import { DEFAULT_ARENA_BOUNDS, TransformComponent } from './types/ecs.types';

describe('Combat System & LEGO Arsenal', () => {
  it('deve instanciar o pool de projéteis e adquirir/liberar entidades', () => {
    const pool = createProjectilePool(8);
    const proj = pool.acquire();

    expect(proj.id).toBeDefined();
    expect(proj.active).toBe(false);

    proj.active = true;
    pool.release(proj);
    expect(proj.active).toBe(false);
  });

  it('deve disparar Stud Blaster com 1 projétil e velocidade alta', () => {
    const pool = createProjectilePool(8);
    const active: ProjectileEntity[] = [];

    const spawned = spawnProjectiles(
      'stud_blaster',
      'hero_1',
      { x: 0, y: 1, z: 0 },
      { x: 0, y: 0, z: 1 },
      pool,
      active,
    );

    expect(spawned).toBe(1);
    expect(active.length).toBe(1);
    expect(active[0].weaponType).toBe('stud_blaster');
    expect(active[0].damage).toBe(WEAPON_CATALOG.stud_blaster.damage);
    expect(active[0].vz).toBeGreaterThan(0);
    expect(active[0].isMine).toBe(false);
  });

  it('deve disparar Block Scatter Shot com 5 mini-blocos em leque', () => {
    const pool = createProjectilePool(16);
    const active: ProjectileEntity[] = [];

    const spawned = spawnProjectiles(
      'scatter_shot',
      'hero_1',
      { x: 0, y: 1, z: 0 },
      { x: 1, y: 0, z: 0 },
      pool,
      active,
    );

    expect(spawned).toBe(5);
    expect(active.length).toBe(5);
    expect(active[0].damage).toBe(WEAPON_CATALOG.scatter_shot.damage);
    // Cada projétil deve ter uma trajetória levemente diferente devido à dispersão angular
    const vxList = active.map((p) => p.vx);
    const vzList = active.map((p) => p.vz);
    expect(new Set(vzList).size).toBeGreaterThan(1);
  });

  it('deve plantar Spring Mine no solo com velocidade zero', () => {
    const pool = createProjectilePool(8);
    const active: ProjectileEntity[] = [];

    const spawned = spawnProjectiles(
      'spring_mine',
      'hero_1',
      { x: 10, y: 1, z: 12 },
      { x: 0, y: 0, z: 1 },
      pool,
      active,
    );

    expect(spawned).toBe(1);
    expect(active.length).toBe(1);
    expect(active[0].weaponType).toBe('spring_mine');
    expect(active[0].isMine).toBe(true);
    expect(active[0].vx).toBe(0);
    expect(active[0].vz).toBe(0);
    expect(active[0].y).toBe(0.1);
  });

  it('deve atualizar física balística de projéteis e descartar ao expirar vida', () => {
    const pool = createProjectilePool(8);
    const active: ProjectileEntity[] = [];
    const grid = new SpatialHashGrid(8);
    const debrisPool = new ObjectPool<DebrisParticle>(createDebrisFactory(), undefined, 8);
    const activeDebris: DebrisParticle[] = [];
    const vehicleTransform: TransformComponent = { x: 50, y: 0, z: 50, rotationY: 0 };
    const modularVehicle: ModularVehicleComponent = {
      blocks: createDefaultBuggyBlocks(),
      durabilityPercentage: 100,
      mass: 850,
    };

    spawnProjectiles(
      'stud_blaster',
      'hero_1',
      { x: 0, y: 1, z: 0 },
      { x: 0, y: 0, z: 1 },
      pool,
      active,
    );

    const initialZ = active[0].z;
    updateCombatSystem(
      active,
      pool,
      grid,
      0.1,
      DEFAULT_ARENA_BOUNDS,
      vehicleTransform,
      modularVehicle,
      debrisPool,
      activeDebris,
    );

    expect(active[0].z).toBeGreaterThan(initialZ);

    // Avança além do tempo de vida para expirar
    updateCombatSystem(
      active,
      pool,
      grid,
      2.0,
      DEFAULT_ARENA_BOUNDS,
      vehicleTransform,
      modularVehicle,
      debrisPool,
      activeDebris,
    );
    expect(active.length).toBe(0);
  });

  it('deve detonar Spring Mine por proximidade e aplicar dano em área AoE', () => {
    const pool = createProjectilePool(8);
    const active: ProjectileEntity[] = [];
    const grid = new SpatialHashGrid(8);
    const debrisPool = new ObjectPool<DebrisParticle>(createDebrisFactory(), undefined, 8);
    const activeDebris: DebrisParticle[] = [];
    const vehicleTransform: TransformComponent = { x: 0, y: 0, z: 1.2, rotationY: 0 };
    const modularVehicle: ModularVehicleComponent = {
      blocks: createDefaultBuggyBlocks(),
      durabilityPercentage: 100,
      mass: 850,
    };

    // Planta mina em (0, 0, 0) com dono 'hero_1'
    spawnProjectiles(
      'spring_mine',
      'hero_1',
      { x: 0, y: 0, z: 0 },
      { x: 0, y: 0, z: 1 },
      pool,
      active,
    );

    // Registra veículo a 1.2m (dentro do triggerRadius de 1.8m)
    grid.insert('vehicle_target', { x: 0, y: 0, z: 1.2 }, 1.5);

    const damageEvents: LocalDamageEvent[] = [];
    updateCombatSystem(
      active,
      pool,
      grid,
      0.016,
      DEFAULT_ARENA_BOUNDS,
      vehicleTransform,
      modularVehicle,
      debrisPool,
      activeDebris,
      (dmg) => damageEvents.push(dmg),
    );

    expect(damageEvents.length).toBeGreaterThan(0);
    expect(damageEvents[0].targetId).toBe('vehicle_target');
    expect(damageEvents[0].amount).toBe(50);
    expect(active.length).toBe(0); // Mina consumida na explosão
  });

  it('deve disparar para o céu aberto com vy > 0 e atualizar altitude vertical ascendentemente', () => {
    const pool = createProjectilePool(8);
    const active: ProjectileEntity[] = [];
    const grid = new SpatialHashGrid(8);
    const debrisPool = new ObjectPool<DebrisParticle>(createDebrisFactory(), undefined, 8);
    const activeDebris: DebrisParticle[] = [];
    const vehicleTransform: TransformComponent = { x: 50, y: 0, z: 50, rotationY: 0 };
    const modularVehicle: ModularVehicleComponent = {
      blocks: createDefaultBuggyBlocks(),
      durabilityPercentage: 100,
      mass: 850,
    };

    // Dispara apontando para o céu (+Y e +Z)
    const spawned = spawnProjectiles(
      'stud_blaster',
      'hero_1',
      { x: 0, y: 1.2, z: 0 },
      { x: 0, y: 1, z: 1 },
      pool,
      active,
    );

    expect(spawned).toBe(1);
    expect(active.length).toBe(1);
    const proj = active[0];
    expect(proj.vy).toBeGreaterThan(0);
    const initialY = proj.y;

    // Simula 0.1s de física
    updateCombatSystem(
      active,
      pool,
      grid,
      0.1,
      DEFAULT_ARENA_BOUNDS,
      vehicleTransform,
      modularVehicle,
      debrisPool,
      activeDebris,
    );

    expect(proj.y).toBeGreaterThan(initialY);
  });

  it('deve desativar projéteis balísticos ao colidirem com o solo ou atingirem o teto', () => {
    const pool = createProjectilePool(8);
    const active: ProjectileEntity[] = [];
    const grid = new SpatialHashGrid(8);
    const debrisPool = new ObjectPool<DebrisParticle>(createDebrisFactory(), undefined, 8);
    const activeDebris: DebrisParticle[] = [];
    const vehicleTransform: TransformComponent = { x: 50, y: 0, z: 50, rotationY: 0 };
    const modularVehicle: ModularVehicleComponent = {
      blocks: createDefaultBuggyBlocks(),
      durabilityPercentage: 100,
      mass: 850,
    };

    // 1. Projétil apontando para baixo (chão)
    spawnProjectiles(
      'stud_blaster',
      'hero_1',
      { x: 0, y: 0.5, z: 0 },
      { x: 0, y: -1, z: 0.1 },
      pool,
      active,
    );

    expect(active[0].vy).toBeLessThan(0);

    // Atualiza física por 0.1s: deve atingir o chão (p.y < 0) e ser reciclado
    updateCombatSystem(
      active,
      pool,
      grid,
      0.1,
      DEFAULT_ARENA_BOUNDS,
      vehicleTransform,
      modularVehicle,
      debrisPool,
      activeDebris,
    );

    expect(active.length).toBe(0);

    // 2. Projétil atingindo teto (> 100m)
    const skyProj = pool.acquire();
    skyProj.active = true;
    skyProj.isMine = false;
    skyProj.remainingLife = 5;
    skyProj.x = 0;
    skyProj.y = 99.5;
    skyProj.z = 0;
    skyProj.vx = 0;
    skyProj.vy = 20;
    skyProj.vz = 0;
    active.push(skyProj);

    updateCombatSystem(
      active,
      pool,
      grid,
      0.1,
      DEFAULT_ARENA_BOUNDS,
      vehicleTransform,
      modularVehicle,
      debrisPool,
      activeDebris,
    );

    expect(active.length).toBe(0); // Excedeu teto e foi liberado
  });
});
