import { beforeEach, describe, expect, it } from 'vitest';
import type { ConnectedPlayer, RoomVehicle } from '../interfaces/index.js';
import { CombatService } from './combat.service.js';

describe('CombatService', () => {
  let combatService: CombatService;
  let players: Map<string, ConnectedPlayer>;
  let vehicles: Map<string, RoomVehicle>;

  function createPlayer(id: string, x = 0, z = 0, health = 100): ConnectedPlayer {
    return {
      id,
      name: `Player_${id}`,
      x,
      y: 0,
      z,
      vy: 0,
      rotationY: 0,
      speed: 0,
      isDriving: false,
      isGrounded: true,
      vehicleId: null,
      lastProcessedSeq: 0,
      pendingInputs: [],
      health,
      maxHealth: 100,
    };
  }

  function createVehicle(id: string, x = 0, z = 0, durability = 100): RoomVehicle {
    return {
      id,
      x,
      y: 0,
      z,
      rotationY: 0,
      currentSpeed: 0,
      durability,
      driverId: null,
      driftVelocityX: 0,
      driftVelocityZ: 0,
      isDrifting: false,
    };
  }

  beforeEach(() => {
    combatService = new CombatService();
    players = new Map<string, ConnectedPlayer>();
    vehicles = new Map<string, RoomVehicle>();
  });

  describe('Weapon Catalog and Firing', () => {
    it('should fire stud_blaster spawning a single high-speed projectile', () => {
      const result = combatService.handleShoot('player-1', {
        weaponType: 'stud_blaster',
        origin: { x: 0, y: 1.0, z: 0 },
        direction: { x: 0, y: 0, z: 1 },
        clientTimestamp: Date.now(),
      });

      expect(result.success).toBe(true);
      expect(result.projectilesSpawned).toBe(1);

      const projectiles = combatService.getActiveProjectiles();
      expect(projectiles.length).toBe(1);
      expect(projectiles[0].weaponType).toBe('stud_blaster');
      expect(projectiles[0].damage).toBe(15);
      expect(projectiles[0].vz).toBeGreaterThan(30);
    });

    it('should fire scatter_shot spawning 5 spread projectiles in an arcade cone', () => {
      const result = combatService.handleShoot('player-1', {
        weaponType: 'scatter_shot',
        origin: { x: 0, y: 1.0, z: 0 },
        direction: { x: 0, y: 0, z: 1 },
        clientTimestamp: Date.now(),
      });

      expect(result.success).toBe(true);
      expect(result.projectilesSpawned).toBe(5);

      const projectiles = combatService.getActiveProjectiles();
      expect(projectiles.length).toBe(5);
      for (const p of projectiles) {
        expect(p.weaponType).toBe('scatter_shot');
        expect(p.damage).toBe(8);
      }
    });

    it('should place a stationary spring_mine on the arena floor', () => {
      const result = combatService.handleShoot('player-1', {
        weaponType: 'spring_mine',
        origin: { x: 5, y: 2.5, z: 5 },
        direction: { x: 0, y: 0, z: 1 },
        clientTimestamp: Date.now(),
      });

      expect(result.success).toBe(true);
      expect(result.projectilesSpawned).toBe(1);

      const projectiles = combatService.getActiveProjectiles();
      expect(projectiles.length).toBe(1);
      expect(projectiles[0].isMine).toBe(true);
      expect(projectiles[0].y).toBe(0);
      expect(projectiles[0].damage).toBe(50);
      expect(projectiles[0].vx).toBe(0);
      expect(projectiles[0].vz).toBe(0);
    });

    it('should reject unknown weapon types', () => {
      const result = combatService.handleShoot('player-1', {
        weaponType: 'laser_nuke' as unknown as 'stud_blaster',
        origin: { x: 0, y: 0, z: 0 },
        direction: { x: 0, y: 0, z: 1 },
        clientTimestamp: Date.now(),
      });

      expect(result.success).toBe(false);
      expect(result.reason).toContain('Unknown weapon type');
    });
  });

  describe('Anti-Cheat Cooldown Validation', () => {
    it('should reject shot when cooldown is active on the server', () => {
      const now = 10000;
      const first = combatService.handleShoot(
        'player-1',
        {
          weaponType: 'stud_blaster',
          origin: { x: 0, y: 0, z: 0 },
          direction: { x: 0, y: 0, z: 1 },
          clientTimestamp: now,
        },
        now,
      );
      expect(first.success).toBe(true);

      // Attempt to shoot 50ms later (cooldown is 150ms)
      const second = combatService.handleShoot(
        'player-1',
        {
          weaponType: 'stud_blaster',
          origin: { x: 0, y: 0, z: 0 },
          direction: { x: 0, y: 0, z: 1 },
          clientTimestamp: now + 50,
        },
        now + 50,
      );
      expect(second.success).toBe(false);
      expect(second.reason).toBe('Weapon cooldown active');

      // Attempt to shoot after 160ms (cooldown satisfied)
      const third = combatService.handleShoot(
        'player-1',
        {
          weaponType: 'stud_blaster',
          origin: { x: 0, y: 0, z: 0 },
          direction: { x: 0, y: 0, z: 1 },
          clientTimestamp: now + 160,
        },
        now + 160,
      );
      expect(third.success).toBe(true);
    });
  });

  describe('Simulation, Collision and Damage via SpatialHashGrid', () => {
    it('should advance projectile positions and remove them when lifespan expires', () => {
      combatService.handleShoot('player-1', {
        weaponType: 'stud_blaster',
        origin: { x: 0, y: 1.0, z: 0 },
        direction: { x: 0, y: 0, z: 1 },
        clientTimestamp: Date.now(),
      });

      const { activeProjectiles } = combatService.update(0.05, players, vehicles);
      expect(activeProjectiles.length).toBe(1);
      expect(activeProjectiles[0].z).toBeGreaterThan(0);

      // Advance by full lifespan (1.5s + extra)
      const { activeProjectiles: expired } = combatService.update(2.0, players, vehicles);
      expect(expired.length).toBe(0);
    });

    it('should damage enemy player on projectile impact', () => {
      const shooter = createPlayer('p-shooter', 0, 0);
      const victim = createPlayer('p-victim', 0, 5, 100);
      players.set(shooter.id, shooter);
      players.set(victim.id, victim);

      combatService.handleShoot(shooter.id, {
        weaponType: 'stud_blaster',
        origin: { x: 0, y: 0.9, z: 0 },
        direction: { x: 0, y: 0, z: 1 },
        clientTimestamp: Date.now(),
      });

      // Update simulation step where bullet reaches victim at z = 5 (speed 32m/s, dt ~0.16s reaches ~5.1m)
      const { damageEvents, activeProjectiles } = combatService.update(0.16, players, vehicles);

      expect(damageEvents.length).toBe(1);
      expect(damageEvents[0].targetId).toBe('p-victim');
      expect(damageEvents[0].amount).toBe(15);
      expect(damageEvents[0].isVehicle).toBe(false);
      expect(victim.health).toBe(85);
      expect(activeProjectiles.length).toBe(0); // Projectile consumed on hit
    });

    it('should damage vehicle on projectile impact and dismount driver if durability is depleted', () => {
      const shooter = createPlayer('p-shooter', 0, 0);
      const driver = createPlayer('p-driver', 0, 5);
      const vehicle = createVehicle('v-1', 0, 5, 10); // Durability 10, weapon does 15

      driver.isDriving = true;
      driver.vehicleId = vehicle.id;
      vehicle.driverId = driver.id;

      players.set(shooter.id, shooter);
      players.set(driver.id, driver);
      vehicles.set(vehicle.id, vehicle);

      combatService.handleShoot(shooter.id, {
        weaponType: 'stud_blaster',
        origin: { x: 0, y: 0.6, z: 0 },
        direction: { x: 0, y: 0, z: 1 },
        clientTimestamp: Date.now(),
      });

      const { damageEvents } = combatService.update(0.16, players, vehicles);

      expect(damageEvents.length).toBe(1);
      expect(damageEvents[0].targetId).toBe('v-1');
      expect(damageEvents[0].amount).toBe(15);
      expect(damageEvents[0].isVehicle).toBe(true);
      expect(vehicle.durability).toBe(0);
      expect(vehicle.driverId).toBeNull();
      expect(driver.isDriving).toBe(false);
    });

    it('should detonate spring_mine on proximity, apply area damage and knockback', () => {
      const miner = createPlayer('p-miner', -10, -10);
      const victim = createPlayer('p-victim', 0, 1.2, 100);
      players.set(miner.id, miner);
      players.set(victim.id, victim);

      combatService.handleShoot(miner.id, {
        weaponType: 'spring_mine',
        origin: { x: 0, y: 0, z: 0 },
        direction: { x: 0, y: 0, z: 1 },
        clientTimestamp: Date.now(),
      });

      // Victim is at z = 1.2 (within triggerRadius 1.8m)
      const { damageEvents, activeProjectiles } = combatService.update(0.05, players, vehicles);

      expect(damageEvents.length).toBe(1);
      expect(damageEvents[0].targetId).toBe('p-victim');
      expect(damageEvents[0].amount).toBe(50);
      expect(victim.health).toBe(50);
      expect(damageEvents[0].knockbackZ).toBeDefined();
      expect(victim.isGrounded).toBe(false); // Knockback launches victim in air
      expect(activeProjectiles.length).toBe(0); // Mine exploded
    });
  });

  describe('3D Vertical Trajectories and Height Boundaries', () => {
    it('should fire upward into the sky with positive vy, increasing proj.y on each tick', () => {
      const result = combatService.handleShoot('player-1', {
        weaponType: 'stud_blaster',
        origin: { x: 0, y: 1.0, z: 0 },
        direction: { x: 0, y: 1.0, z: 0 },
        clientTimestamp: Date.now(),
      });

      expect(result.success).toBe(true);
      const active = combatService.getActiveProjectiles();
      expect(active.length).toBe(1);
      expect(active[0].vy).toBeGreaterThan(30);

      const initialY = active[0].y;
      const { activeProjectiles } = combatService.update(0.05, players, vehicles);
      expect(activeProjectiles.length).toBe(1);
      expect(activeProjectiles[0].y).toBeGreaterThan(initialY);
    });

    it('should remove projectile when it exceeds maximum sky ceiling (y > 100)', () => {
      combatService.handleShoot('player-1', {
        weaponType: 'stud_blaster',
        origin: { x: 0, y: 99.0, z: 0 },
        direction: { x: 0, y: 1.0, z: 0 },
        clientTimestamp: Date.now(),
      });

      // At vy ~36, dt = 0.05 moves y by ~1.8m -> y becomes ~100.8 > 100
      const { activeProjectiles } = combatService.update(0.05, players, vehicles);
      expect(activeProjectiles.length).toBe(0);
    });

    it('should remove projectile immediately when fired downward into the ground (y < 0)', () => {
      combatService.handleShoot('player-1', {
        weaponType: 'stud_blaster',
        origin: { x: 0, y: 0.5, z: 0 },
        direction: { x: 0, y: -1.0, z: 0 },
        clientTimestamp: Date.now(),
      });

      // vy is -36m/s, dt = 0.05 -> drops to y = 0.5 - 1.8 = -1.3 < 0
      const { activeProjectiles } = combatService.update(0.05, players, vehicles);
      expect(activeProjectiles.length).toBe(0);
    });

    it('should preserve correct projectileSpeed magnitude in 3D scatter_shot when aimed upward', () => {
      const result = combatService.handleShoot('player-1', {
        weaponType: 'scatter_shot',
        origin: { x: 0, y: 1.0, z: 0 },
        direction: { x: 0.2, y: 0.8, z: 0.2 },
        clientTimestamp: Date.now(),
      });

      expect(result.success).toBe(true);
      const projectiles = combatService.getActiveProjectiles();
      expect(projectiles.length).toBe(5);

      for (const proj of projectiles) {
        const totalSpeed = Math.hypot(proj.vx, proj.vy, proj.vz);
        // scatter_shot speed is 24 m/s (WEAPON_CATALOG.scatter_shot.projectileSpeed)
        expect(totalSpeed).toBeCloseTo(24, 1);
        expect(proj.vy).toBeGreaterThan(0);
      }
    });
  });
});
