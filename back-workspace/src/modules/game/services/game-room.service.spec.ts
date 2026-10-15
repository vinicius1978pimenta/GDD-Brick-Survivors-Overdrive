import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PlayerInputDto } from '../dto/player-input.dto.js';
import { WorldStateSnapshotDto } from '../dto/world-state-snapshot.dto.js';
import {
  ARENA_BOUNDS,
  HERO_COLLISION_CONFIG,
  SIMULATION_CONFIG,
  VEHICLE_COLLISION_CONFIG,
} from '../interfaces/index.js';
import { GameRoomService } from './game-room.service.js';

describe('GameRoomService', () => {
  let service: GameRoomService;

  beforeEach(() => {
    vi.useFakeTimers();
    service = new GameRoomService();
  });

  afterEach(() => {
    service.stopGameLoop();
    vi.clearAllTimers();
    vi.useRealTimers();
  });

  describe('Lifecycle and Game Loop', () => {
    it('should start game loop and run ticks periodically', () => {
      let snapshotsEmitted = 0;
      service.onSnapshot((_snapshot: WorldStateSnapshotDto) => {
        snapshotsEmitted++;
      });

      service.startGameLoop(50);
      expect(service.isRunning()).toBe(true);

      vi.advanceTimersByTime(150);
      expect(snapshotsEmitted).toBe(3);
      expect(service.getCurrentTick()).toBe(3);
    });

    it('should stop game loop cleanly and clear interval', () => {
      service.startGameLoop(50);
      expect(service.isRunning()).toBe(true);

      service.stopGameLoop();
      expect(service.isRunning()).toBe(false);

      const tickBefore = service.getCurrentTick();
      vi.advanceTimersByTime(200);
      expect(service.getCurrentTick()).toBe(tickBefore);
    });

    it('should not create duplicate intervals if startGameLoop is called multiple times', () => {
      service.startGameLoop(50);
      service.startGameLoop(50);

      vi.advanceTimersByTime(100);
      expect(service.getCurrentTick()).toBe(2);
    });

    it('should handle onModuleInit and onModuleDestroy lifecycle hooks', () => {
      service.onModuleInit();
      expect(service.isRunning()).toBe(true);

      service.onModuleDestroy();
      expect(service.isRunning()).toBe(false);
    });
  });

  describe('Player Management', () => {
    it('should register a player with custom name', () => {
      const player = service.addPlayer('socket-1', 'OverdriveAce');

      expect(player.id).toBe('socket-1');
      expect(player.name).toBe('OverdriveAce');
      expect(service.getPlayerCount()).toBe(1);
      expect(player.isGrounded).toBe(true);
      expect(player.isDriving).toBe(false);
    });

    it('should generate fallback name if none is provided', () => {
      const player = service.addPlayer('abcdef1234');

      expect(player.name).toBe('Hero_abcd');
    });

    it('should remove player on disconnect', () => {
      service.addPlayer('socket-1', 'Player1');
      expect(service.getPlayerCount()).toBe(1);

      service.removePlayer('socket-1');
      expect(service.getPlayerCount()).toBe(0);
      expect(service.getPlayer('socket-1')).toBeUndefined();
    });

    it('should release vehicle when driving player disconnects', () => {
      const player = service.addPlayer('socket-1', 'Racer');
      const vehicle = service.getVehicle('vehicle-alpha');
      expect(vehicle).toBeDefined();

      if (vehicle) {
        player.isDriving = true;
        player.vehicleId = vehicle.id;
        vehicle.driverId = player.id;

        service.removePlayer('socket-1');

        expect(service.getPlayer('socket-1')).toBeUndefined();
        expect(vehicle.driverId).toBeNull();
        expect(vehicle.isDrifting).toBe(false);
      }
    });

    it('should spawn players at distributed positions in the 15m to 35m ring avoiding collision', () => {
      const p1 = service.addPlayer('socket-1', 'PilotA');
      const p2 = service.addPlayer('socket-2', 'PilotB');
      const p3 = service.addPlayer('socket-3', 'PilotC');

      const dist1 = Math.hypot(p1.x, p1.z);
      const dist2 = Math.hypot(p2.x, p2.z);
      const dist3 = Math.hypot(p3.x, p3.z);

      expect(dist1).toBeGreaterThanOrEqual(15);
      expect(dist1).toBeLessThanOrEqual(35);
      expect(dist2).toBeGreaterThanOrEqual(15);
      expect(dist2).toBeLessThanOrEqual(35);
      expect(dist3).toBeGreaterThanOrEqual(15);
      expect(dist3).toBeLessThanOrEqual(35);

      const separation12 = Math.hypot(p1.x - p2.x, p1.z - p2.z);
      const separation23 = Math.hypot(p2.x - p3.x, p2.z - p3.z);
      expect(separation12).toBeGreaterThanOrEqual(10);
      expect(separation23).toBeGreaterThanOrEqual(10);
    });

    it('should update player name when addPlayer is called again for existing socket', () => {
      const initial = service.addPlayer('socket-1', 'InitialName');
      expect(initial.name).toBe('InitialName');

      const updated = service.addPlayer('socket-1', 'UpdatedHero');
      expect(updated.name).toBe('UpdatedHero');
      expect(service.getPlayerCount()).toBe(1);
    });
  });

  describe('Input Queueing and Sequence Acknowledgement', () => {
    it('should enqueue inputs and acknowledge the sequence in snapshot', () => {
      service.addPlayer('socket-1', 'Player1');

      const input1: PlayerInputDto = {
        seq: 101,
        forward: true,
        backward: false,
        left: false,
        right: false,
        handbrake: false,
        jump: false,
        interact: false,
        dt: 0.05,
        timestamp: Date.now(),
      };

      const input2: PlayerInputDto = {
        seq: 102,
        forward: true,
        backward: false,
        left: false,
        right: false,
        handbrake: false,
        jump: false,
        interact: false,
        dt: 0.05,
        timestamp: Date.now() + 50,
      };

      service.enqueueInput('socket-1', input1);
      service.enqueueInput('socket-1', input2);

      const snapshot = service.stepSimulation(0.05);

      expect(snapshot.ackInputs['socket-1']).toBe(102);
      const player = service.getPlayer('socket-1');
      expect(player?.lastProcessedSeq).toBe(102);
    });

    it('should limit pending inputs queue size to prevent unbounded growth', () => {
      service.addPlayer('socket-1', 'Player1');

      for (let i = 1; i <= 40; i++) {
        const input: PlayerInputDto = {
          seq: i,
          forward: true,
          backward: false,
          left: false,
          right: false,
          handbrake: false,
          jump: false,
          interact: false,
          dt: 0.05,
          timestamp: Date.now() + i,
        };
        service.enqueueInput('socket-1', input);
      }

      const player = service.getPlayer('socket-1');
      expect(player?.pendingInputs.length).toBe(SIMULATION_CONFIG.maxPendingInputsPerTick);
    });
  });

  describe('Pedestrian Simulation and Arena Bounds', () => {
    it('should move forward when forward input is active', () => {
      const player = service.addPlayer('socket-1', 'Player1');
      player.x = 0;
      player.z = 0;
      player.rotationY = 0;

      const input: PlayerInputDto = {
        seq: 1,
        forward: true,
        backward: false,
        left: false,
        right: false,
        handbrake: false,
        jump: false,
        interact: false,
        dt: 0.05,
        timestamp: Date.now(),
      };

      service.enqueueInput('socket-1', input);
      service.stepSimulation(0.05);

      expect(player.speed).toBeGreaterThan(0);
      expect(player.z).toBeGreaterThan(0);
    });

    it('should clamp player within arena bounds', () => {
      const player = service.addPlayer('socket-1', 'Player1');
      player.x = 48.5;
      player.z = 48.5;
      player.rotationY = Math.PI / 4;

      for (let i = 0; i < 50; i++) {
        service.enqueueInput('socket-1', {
          seq: i + 1,
          forward: true,
          backward: false,
          left: false,
          right: false,
          handbrake: false,
          jump: false,
          interact: false,
          dt: 0.05,
          timestamp: Date.now(),
        });
        service.stepSimulation(0.05);
      }

      expect(player.x).toBeLessThanOrEqual(ARENA_BOUNDS.maxX);
      expect(player.z).toBeLessThanOrEqual(ARENA_BOUNDS.maxZ);
      expect(player.x).toBeGreaterThanOrEqual(ARENA_BOUNDS.minX);
      expect(player.z).toBeGreaterThanOrEqual(ARENA_BOUNDS.minZ);
    });

    it('should simulate vertical jump and return to ground level', () => {
      const player = service.addPlayer('socket-1', 'Jumper');
      player.x = 0;
      player.y = 0;
      player.z = 0;

      service.enqueueInput('socket-1', {
        seq: 1,
        forward: false,
        backward: false,
        left: false,
        right: false,
        handbrake: false,
        jump: true,
        interact: false,
        dt: 0.05,
        timestamp: Date.now(),
      });

      service.stepSimulation(0.05);
      expect(player.y).toBeGreaterThan(0);
      expect(player.isGrounded).toBe(false);

      for (let i = 0; i < 20; i++) {
        service.stepSimulation(0.05);
      }

      expect(player.y).toBe(0);
      expect(player.isGrounded).toBe(true);
    });

    it('should strafe laterally to the right when right input is active', () => {
      const player = service.addPlayer('socket-1', 'StrafingHero');
      player.x = 0;
      player.z = 0;
      player.rotationY = 0;

      service.enqueueInput('socket-1', {
        seq: 1,
        forward: false,
        backward: false,
        left: false,
        right: true,
        handbrake: false,
        jump: false,
        interact: false,
        dt: 0.05,
        timestamp: Date.now(),
      });

      service.stepSimulation(0.05);

      expect(player.speed).toBeGreaterThan(0);
      expect(player.x).toBeLessThan(0);
    });

    it('should strafe laterally to the left when left input is active', () => {
      const player = service.addPlayer('socket-1', 'StrafingHeroLeft');
      player.x = 0;
      player.z = 0;
      player.rotationY = 0;

      service.enqueueInput('socket-1', {
        seq: 1,
        forward: false,
        backward: false,
        left: true,
        right: false,
        handbrake: false,
        jump: false,
        interact: false,
        dt: 0.05,
        timestamp: Date.now(),
      });

      service.stepSimulation(0.05);

      expect(player.speed).toBeGreaterThan(0);
      expect(player.x).toBeGreaterThan(0);
    });

    it('should combine forward and strafe inputs diagonally with normalized vector', () => {
      const player = service.addPlayer('socket-1', 'DiagonalHero');
      player.x = 0;
      player.z = 0;
      player.rotationY = 0;

      service.enqueueInput('socket-1', {
        seq: 1,
        forward: true,
        backward: false,
        left: false,
        right: true,
        handbrake: false,
        jump: false,
        interact: false,
        dt: 0.05,
        timestamp: Date.now(),
      });

      service.stepSimulation(0.05);

      expect(player.speed).toBeGreaterThan(0);
      expect(player.x).toBeLessThan(0);
      expect(player.z).toBeGreaterThan(0);
    });

    it('should smoothly decelerate to zero speed when all directional inputs are released', () => {
      const player = service.addPlayer('socket-1', 'DeceleratingHero');
      player.x = 0;
      player.z = 0;
      player.speed = 5.0;

      service.enqueueInput('socket-1', {
        seq: 1,
        forward: false,
        backward: false,
        left: false,
        right: false,
        handbrake: false,
        jump: false,
        interact: false,
        dt: 0.05,
        timestamp: Date.now(),
      });

      service.stepSimulation(0.05);
      expect(player.speed).toBeLessThan(5.0);

      // Advance several ticks without input
      for (let i = 2; i <= 20; i++) {
        service.enqueueInput('socket-1', {
          seq: i,
          forward: false,
          backward: false,
          left: false,
          right: false,
          handbrake: false,
          jump: false,
          interact: false,
          dt: 0.05,
          timestamp: Date.now() + i * 50,
        });
        service.stepSimulation(0.05);
      }

      expect(player.speed).toBe(0);
    });
  });

  describe('Vehicle Interaction and Driving', () => {
    it('should allow player to board nearby vehicle with interact input', () => {
      const player = service.addPlayer('socket-1', 'Driver');
      const vehicle = service.getVehicle('vehicle-alpha');
      expect(vehicle).toBeDefined();

      if (vehicle) {
        player.x = vehicle.x + 0.5;
        player.z = vehicle.z + 0.5;

        service.enqueueInput('socket-1', {
          seq: 1,
          forward: false,
          backward: false,
          left: false,
          right: false,
          handbrake: false,
          jump: false,
          interact: true,
          dt: 0.05,
          timestamp: Date.now(),
        });

        service.stepSimulation(0.05);

        expect(player.isDriving).toBe(true);
        expect(player.vehicleId).toBe(vehicle.id);
        expect(vehicle.driverId).toBe(player.id);
      }
    });

    it('should drive vehicle forward and sync player position', () => {
      const player = service.addPlayer('socket-1', 'Driver');
      const vehicle = service.getVehicle('vehicle-alpha');
      expect(vehicle).toBeDefined();

      if (vehicle) {
        player.isDriving = true;
        player.vehicleId = vehicle.id;
        vehicle.driverId = player.id;
        vehicle.x = 0;
        vehicle.z = 0;
        vehicle.rotationY = 0;

        service.enqueueInput('socket-1', {
          seq: 2,
          forward: true,
          backward: false,
          left: false,
          right: false,
          handbrake: false,
          jump: false,
          interact: false,
          dt: 0.05,
          timestamp: Date.now(),
        });

        service.stepSimulation(0.05);

        expect(vehicle.currentSpeed).toBeGreaterThan(0);
        expect(vehicle.z).toBeGreaterThan(0);
        expect(player.x).toBe(vehicle.x);
        expect(player.z).toBe(vehicle.z);
      }
    });

    it('should dismount from vehicle with interact input and exit to side', () => {
      const player = service.addPlayer('socket-1', 'Driver');
      const vehicle = service.getVehicle('vehicle-alpha');
      expect(vehicle).toBeDefined();

      if (vehicle) {
        player.isDriving = true;
        player.vehicleId = vehicle.id;
        vehicle.driverId = player.id;
        vehicle.x = 0;
        vehicle.z = 0;

        service.enqueueInput('socket-1', {
          seq: 3,
          forward: false,
          backward: false,
          left: false,
          right: false,
          handbrake: false,
          jump: false,
          interact: true,
          dt: 0.05,
          timestamp: Date.now(),
        });

        service.stepSimulation(0.05);

        expect(player.isDriving).toBe(false);
        expect(player.vehicleId).toBeNull();
        expect(vehicle.driverId).toBeNull();
        expect(player.x).not.toBe(vehicle.x);
      }
    });

    it('should clamp vehicle and apply bounce within arena boundaries', () => {
      const vehicle = service.getVehicle('vehicle-alpha');
      expect(vehicle).toBeDefined();

      if (vehicle) {
        vehicle.x = 55;
        vehicle.currentSpeed = 10;
        service.stepSimulation(0.05);

        expect(vehicle.x).toBeLessThanOrEqual(ARENA_BOUNDS.maxX);
        expect(vehicle.currentSpeed).toBeLessThan(0);
      }
    });
  });

  describe('Snapshot Structure and Determinism', () => {
    it('should produce fully populated and serializable WorldStateSnapshotDto', () => {
      service.addPlayer('socket-1', 'PlayerA');
      const snapshot = service.stepSimulation(0.05);

      expect(snapshot).toHaveProperty('tick');
      expect(snapshot).toHaveProperty('timestamp');
      expect(snapshot).toHaveProperty('players');
      expect(snapshot).toHaveProperty('vehicles');
      expect(snapshot).toHaveProperty('ackInputs');
      expect(snapshot).toHaveProperty('projectiles');
      expect(snapshot).toHaveProperty('damageEvents');

      expect(snapshot.players.length).toBe(1);
      expect(snapshot.vehicles.length).toBe(1);

      const p = snapshot.players[0];
      expect(typeof p.x).toBe('number');
      expect(typeof p.y).toBe('number');
      expect(typeof p.z).toBe('number');
      expect(typeof p.rotationY).toBe('number');
      expect(typeof p.speed).toBe('number');
      expect(typeof p.isDriving).toBe('boolean');
      expect(typeof p.isGrounded).toBe('boolean');
      expect(typeof p.health).toBe('number');
      expect(p.health).toBe(100);
      expect(p.hp).toBe(100);
      expect(p.maxHp).toBe(100);
      expect(p.weapon).toBe('stud_blaster');

      const v = snapshot.vehicles[0];
      expect(typeof v.x).toBe('number');
      expect(typeof v.y).toBe('number');
      expect(typeof v.z).toBe('number');
      expect(typeof v.rotationY).toBe('number');
      expect(typeof v.speed).toBe('number');
      expect(typeof v.durability).toBe('number');
    });
  });

  describe('Combat Integration in Room Simulation', () => {
    it('should accept player shoot and include active projectile in snapshot', () => {
      service.addPlayer('socket-1', 'Gunslinger');

      const shootResult = service.handlePlayerShoot('socket-1', {
        weaponType: 'stud_blaster',
        origin: { x: 0, y: 1.0, z: 2.5 },
        direction: { x: 0, y: 0, z: 1 },
        clientTimestamp: Date.now(),
      });

      expect(shootResult.success).toBe(true);
      expect(shootResult.projectilesSpawned).toBe(1);

      const snapshot = service.stepSimulation(0.05);
      expect(snapshot.projectiles.length).toBe(1);
      expect(snapshot.projectiles[0].weaponType).toBe('stud_blaster');
    });

    it('should reject shoot for non-existent player', () => {
      const shootResult = service.handlePlayerShoot('unknown-socket', {
        weaponType: 'stud_blaster',
        origin: { x: 0, y: 0, z: 0 },
        direction: { x: 0, y: 0, z: 1 },
        clientTimestamp: Date.now(),
      });

      expect(shootResult.success).toBe(false);
      expect(shootResult.reason).toBe('Player not connected');
    });

    it('should update player active weapon when player shoots with different weapon', () => {
      const player = service.addPlayer('socket-1', 'Sharpshooter');
      expect(player.weapon).toBe('stud_blaster');

      service.handlePlayerShoot('socket-1', {
        weaponType: 'scatter_shot',
        origin: { x: 0, y: 1.0, z: 0 },
        direction: { x: 0, y: 0, z: 1 },
        clientTimestamp: Date.now(),
      });

      expect(player.weapon).toBe('scatter_shot');
      const snapshot = service.stepSimulation(0.05);
      expect(snapshot.players[0].weapon).toBe('scatter_shot');
    });
  });

  describe('Pedestrian vs Vehicle Solid Collision', () => {
    it('should push pedestrian out when attempting to walk forward into the front of vehicle', () => {
      // Vehicle is at (0, 0, 0), rotation 0. Front edge is z = +1.6, back is z = -1.6
      const player = service.addPlayer('socket-1', 'Walker');
      // Place player just in front of vehicle facing south (towards the car)
      player.x = 0;
      player.z = 2.2;
      player.rotationY = Math.PI; // facing -Z (towards vehicle at z = 0)

      // Move forward towards the car
      service.enqueueInput('socket-1', {
        seq: 1,
        forward: true,
        backward: false,
        left: false,
        right: false,
        handbrake: false,
        jump: false,
        interact: false,
        dt: 0.05,
        timestamp: Date.now(),
      });

      service.stepSimulation(0.05);

      // Half length is 1.6, hero radius is 0.5. Player must not penetrate past 1.6 + 0.5 = 2.1
      expect(player.z).toBeGreaterThanOrEqual(
        VEHICLE_COLLISION_CONFIG.halfLength + HERO_COLLISION_CONFIG.radius - 0.001,
      );
    });

    it('should push pedestrian out when attempting to walk into the side door of vehicle', () => {
      // Vehicle is at (0, 0, 0), halfWidth = 0.9. Right edge is x = +0.9
      const player = service.addPlayer('socket-1', 'SideWalker');
      player.x = 1.45;
      player.z = 0;
      player.rotationY = -Math.PI / 2; // facing -X (towards vehicle)

      service.enqueueInput('socket-1', {
        seq: 1,
        forward: true,
        backward: false,
        left: false,
        right: false,
        handbrake: false,
        jump: false,
        interact: false,
        dt: 0.05,
        timestamp: Date.now(),
      });

      service.stepSimulation(0.05);

      // Must be kept outside: halfWidth + heroRadius = 0.9 + 0.5 = 1.4
      expect(player.x).toBeGreaterThanOrEqual(
        VEHICLE_COLLISION_CONFIG.halfWidth + HERO_COLLISION_CONFIG.radius - 0.001,
      );
    });

    it('should project pedestrian out if spawned directly inside the vehicle', () => {
      const player = service.addPlayer('socket-1', 'InsideMan');
      player.x = 0.2;
      player.z = 0.2;

      // When stepping simulation, player should be pushed out to the exterior
      service.stepSimulation(0.05);

      const vehicle = service.getVehicle('vehicle-alpha');
      expect(vehicle).toBeDefined();
      if (vehicle) {
        // Player should now be outside the bounding box + radius
        const dx = Math.abs(player.x - vehicle.x);
        const dz = Math.abs(player.z - vehicle.z);
        const outside =
          dx >= VEHICLE_COLLISION_CONFIG.halfWidth + HERO_COLLISION_CONFIG.radius - 0.001 ||
          dz >= VEHICLE_COLLISION_CONFIG.halfLength + HERO_COLLISION_CONFIG.radius - 0.001;
        expect(outside).toBe(true);
      }
    });

    it('should slide tangentially when walking diagonally against the vehicle body', () => {
      const player = service.addPlayer('socket-1', 'Slider');
      // Place on right side of vehicle
      player.x = 1.42;
      player.z = 0;
      // Angle diagonally forward and left towards the car (-X and +Z)
      player.rotationY = -(3 * Math.PI) / 4;

      service.enqueueInput('socket-1', {
        seq: 1,
        forward: true,
        backward: false,
        left: false,
        right: false,
        handbrake: false,
        jump: false,
        interact: false,
        dt: 0.05,
        timestamp: Date.now(),
      });

      service.stepSimulation(0.05);

      // Should maintain X boundary
      expect(player.x).toBeGreaterThanOrEqual(
        VEHICLE_COLLISION_CONFIG.halfWidth + HERO_COLLISION_CONFIG.radius - 0.001,
      );
    });

    it('should not push out driver who is currently driving the vehicle', () => {
      const player = service.addPlayer('socket-1', 'Driver');
      player.isDriving = true;
      player.vehicleId = 'vehicle-alpha';
      player.x = 0;
      player.z = 0;

      const vehicle = service.getVehicle('vehicle-alpha');
      expect(vehicle).toBeDefined();

      const collided = service.resolvePedestrianVehicleCollision(player, vehicle!);
      expect(collided).toBe(false);
      expect(player.x).toBe(0);
      expect(player.z).toBe(0);
    });

    it('should correctly handle rotated vehicle OBB orientation', () => {
      const vehicle = service.getVehicle('vehicle-alpha');
      expect(vehicle).toBeDefined();
      // Rotate vehicle 90 degrees (Math.PI / 2)
      // Now length (3.2m, half 1.6m) runs along X and width (1.8m, half 0.9m) runs along Z
      vehicle!.rotationY = Math.PI / 2;

      const player = service.addPlayer('socket-1', 'OBBWalker');
      // Place player along rotated vehicle's front (now +X direction)
      player.x = 2.15;
      player.z = 0;
      player.rotationY = -Math.PI / 2; // facing -X towards vehicle

      service.enqueueInput('socket-1', {
        seq: 1,
        forward: true,
        backward: false,
        left: false,
        right: false,
        handbrake: false,
        jump: false,
        interact: false,
        dt: 0.05,
        timestamp: Date.now(),
      });

      service.stepSimulation(0.05);

      // In rotated space, front is along X so halfLength (1.6) + heroRadius (0.5) = 2.1
      expect(player.x).toBeGreaterThanOrEqual(2.1 - 0.01);
    });
  });
});
