import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PlayerInputDto } from '../dto/player-input.dto.js';
import { WorldStateSnapshotDto } from '../dto/world-state-snapshot.dto.js';
import {
  ARENA_BOUNDS,
  GameRoomService,
  SIMULATION_CONFIG,
} from './game-room.service.js';

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

      for (let i = 1; i <= 20; i++) {
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
      player.x = 18.9;
      player.z = 18.9;
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
        vehicle.x = 25;
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

      const v = snapshot.vehicles[0];
      expect(typeof v.x).toBe('number');
      expect(typeof v.y).toBe('number');
      expect(typeof v.z).toBe('number');
      expect(typeof v.rotationY).toBe('number');
      expect(typeof v.speed).toBe('number');
      expect(typeof v.durability).toBe('number');
    });
  });
});
