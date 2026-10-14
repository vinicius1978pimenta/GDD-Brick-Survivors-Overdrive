import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { Server } from 'socket.io';
import { PlayerInputDto } from '../dto/player-input.dto.js';
import {PlayerSnapshot,
  VehicleSnapshot,
  WorldStateSnapshotDto,
} from '../dto/world-state-snapshot.dto.js';
import {
  ConnectedPlayer,
  RoomVehicle,
  ARENA_BOUNDS,
  SIMULATION_CONFIG,
  VEHICLE_CONFIG,
  PLAYER_CONFIG,
} from './Interface-game-room.js';

export type {
  ConnectedPlayer,
  RoomVehicle,
};
export {
  ARENA_BOUNDS,
  SIMULATION_CONFIG,
  VEHICLE_CONFIG,
  PLAYER_CONFIG,
};


@Injectable()
export class GameRoomService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(GameRoomService.name);
  private server: Server | null = null;
  private tickInterval: NodeJS.Timeout | null = null;
  private currentTick = 0;

  private readonly players = new Map<string, ConnectedPlayer>();
  private readonly vehicles = new Map<string, RoomVehicle>();
  private readonly snapshotCallbacks: Array<(snapshot: WorldStateSnapshotDto) => void> = [];

  constructor() {
    this.initDefaultVehicles();
  }

  onModuleInit(): void {
    this.startGameLoop();
  }

  onModuleDestroy(): void {
    this.stopGameLoop();
  }

  public setServer(server: Server): void {
    this.server = server;
  }

  public onSnapshot(callback: (snapshot: WorldStateSnapshotDto) => void): void {
    this.snapshotCallbacks.push(callback);
  }

  public getCurrentTick(): number {
    return this.currentTick;
  }

  public getPlayerCount(): number {
    return this.players.size;
  }

  public getPlayer(id: string): ConnectedPlayer | undefined {
    return this.players.get(id);
  }

  public getPlayers(): ConnectedPlayer[] {
    return Array.from(this.players.values());
  }

  public getVehicle(id: string): RoomVehicle | undefined {
    return this.vehicles.get(id);
  }

  public getVehicles(): RoomVehicle[] {
    return Array.from(this.vehicles.values());
  }

  public initDefaultVehicles(): void {
    this.vehicles.clear();
    const defaultVehicle: RoomVehicle = {
      id: 'vehicle-alpha',
      x: 0,
      y: 0,
      z: 0,
      rotationY: 0,
      currentSpeed: 0,
      durability: 100,
      driverId: null,
      driftVelocityX: 0,
      driftVelocityZ: 0,
      isDrifting: false,
    };
    this.vehicles.set(defaultVehicle.id, defaultVehicle);
  }

  public addPlayer(socketId: string, playerName?: string): ConnectedPlayer {
    const defaultName = playerName && playerName.trim().length > 0
      ? playerName.trim()
      : `Hero_${socketId.slice(0, 4)}`;

    const playerIndex = this.players.size;
    const initialZ = -4 - (playerIndex * 2);

    const player: ConnectedPlayer = {
      id: socketId,
      name: defaultName,
      x: 0,
      y: 0,
      z: Math.max(ARENA_BOUNDS.minZ + 1, initialZ),
      vy: 0,
      rotationY: 0,
      speed: 0,
      isDriving: false,
      isGrounded: true,
      vehicleId: null,
      lastProcessedSeq: 0,
      pendingInputs: [],
    };

    this.players.set(socketId, player);
    this.logger.log(`Player added to room: ${player.name} (${socketId})`);
    return player;
  }

  public removePlayer(socketId: string): void {
    const player = this.players.get(socketId);
    if (!player) {
      return;
    }

    if (player.isDriving && player.vehicleId) {
      const vehicle = this.vehicles.get(player.vehicleId);
      if (vehicle) {
        vehicle.driverId = null;
        vehicle.isDrifting = false;
      }
    }

    this.players.delete(socketId);
    this.logger.log(`Player removed from room: ${player.name} (${socketId})`);
  }

  public enqueueInput(socketId: string, input: PlayerInputDto): void {
    const player = this.players.get(socketId);
    if (!player) {
      return;
    }

    if (player.pendingInputs.length >= SIMULATION_CONFIG.maxPendingInputsPerTick) {
      player.pendingInputs.shift();
    }
    player.pendingInputs.push(input);
  }

  public startGameLoop(intervalMs = SIMULATION_CONFIG.intervalMs): void {
    if (this.tickInterval) {
      return;
    }

    this.logger.log(`Starting authoritative game loop at ${SIMULATION_CONFIG.tickRateHz}Hz (${intervalMs}ms)`);
    this.tickInterval = setInterval(() => {
      this.tick();
    }, intervalMs);
  }

  public stopGameLoop(): void {
    if (this.tickInterval) {
      clearInterval(this.tickInterval);
      this.tickInterval = null;
      this.logger.log('Authoritative game loop stopped');
    }
  }

  public isRunning(): boolean {
    return this.tickInterval !== null;
  }

  public tick(): WorldStateSnapshotDto {
    return this.stepSimulation(SIMULATION_CONFIG.dt);
  }

  public stepSimulation(dt: number = SIMULATION_CONFIG.dt): WorldStateSnapshotDto {
    this.currentTick++;
    const ackInputs: Record<string, number> = {};

    for (const player of this.players.values()) {
      if (player.pendingInputs.length === 0) {
        this.simulateIdlePlayer(player, dt);
      } else {
        const inputsToProcess = [...player.pendingInputs];
        player.pendingInputs = [];

        for (const input of inputsToProcess) {
          player.lastProcessedSeq = input.seq;
          const stepDt = input.dt > 0 && input.dt < 0.2 ? input.dt : dt;
          this.processPlayerInput(player, input, stepDt);
        }
      }

      ackInputs[player.id] = player.lastProcessedSeq;
    }

    for (const vehicle of this.vehicles.values()) {
      if (vehicle.driverId === null) {
        this.simulateIdleVehicle(vehicle, dt);
      }
    }

    const snapshot = this.buildSnapshot(ackInputs);
    this.broadcastSnapshot(snapshot);
    return snapshot;
  }

  private processPlayerInput(player: ConnectedPlayer, input: PlayerInputDto, dt: number): void {
    if (input.interact) {
      this.handlePlayerInteract(player);
    }

    if (player.isDriving && player.vehicleId) {
      const vehicle = this.vehicles.get(player.vehicleId);
      if (vehicle) {
        this.simulateDrivenVehicle(vehicle, player, input, dt);
      }
    } else {
      this.simulatePedestrian(player, input, dt);
    }
  }

  private handlePlayerInteract(player: ConnectedPlayer): void {
    if (player.isDriving && player.vehicleId) {
      const vehicle = this.vehicles.get(player.vehicleId);
      if (vehicle) {
        vehicle.driverId = null;
        vehicle.isDrifting = false;

        const exitAngle = vehicle.rotationY;
        player.x = vehicle.x - Math.cos(exitAngle) * 1.6;
        player.z = vehicle.z + Math.sin(exitAngle) * 1.6;
        player.y = 0;
        player.rotationY = exitAngle;
      }

      player.isDriving = false;
      player.vehicleId = null;
      player.speed = 0;
      player.vy = 0;
      player.isGrounded = true;

      player.x = this.clamp(player.x, ARENA_BOUNDS.minX, ARENA_BOUNDS.maxX);
      player.z = this.clamp(player.z, ARENA_BOUNDS.minZ, ARENA_BOUNDS.maxZ);
      return;
    }

    let candidateVehicle: RoomVehicle | null = null;
    let minDistance: number = VEHICLE_CONFIG.interactionRadius;

    for (const vehicle of this.vehicles.values()) {
      if (vehicle.driverId === null && vehicle.durability > 0) {
        const distance = Math.hypot(player.x - vehicle.x, player.z - vehicle.z);
        if (distance <= minDistance) {
          minDistance = distance;
          candidateVehicle = vehicle;
        }
      }
    }

    if (candidateVehicle) {
      candidateVehicle.driverId = player.id;
      player.isDriving = true;
      player.vehicleId = candidateVehicle.id;
      player.x = candidateVehicle.x;
      player.y = candidateVehicle.y;
      player.z = candidateVehicle.z;
      player.rotationY = candidateVehicle.rotationY;
      player.speed = candidateVehicle.currentSpeed;
      player.vy = 0;
      player.isGrounded = true;
    }
  }

  private simulatePedestrian(player: ConnectedPlayer, input: PlayerInputDto, dt: number): void {
    let steer = 0;
    if (input.left) steer += 1;
    if (input.right) steer -= 1;

    if (steer !== 0) {
      player.rotationY += steer * PLAYER_CONFIG.turnSpeed * dt;
    }

    if (input.forward) {
      if (player.speed < -0.5) {
        player.speed += PLAYER_CONFIG.deceleration * dt;
      } else {
        player.speed = Math.min(PLAYER_CONFIG.maxSpeed, player.speed + PLAYER_CONFIG.acceleration * dt);
      }
    } else if (input.backward) {
      if (player.speed > 0.5) {
        player.speed = Math.max(0, player.speed - PLAYER_CONFIG.deceleration * dt);
      } else {
        player.speed = Math.max(-PLAYER_CONFIG.reverseMaxSpeed, player.speed - PLAYER_CONFIG.acceleration * 0.75 * dt);
      }
    } else {
      if (player.speed > 0) {
        player.speed = Math.max(0, player.speed - PLAYER_CONFIG.deceleration * dt);
      } else if (player.speed < 0) {
        player.speed = Math.min(0, player.speed + PLAYER_CONFIG.deceleration * dt);
      }
    }

    if (player.y <= 0) {
      player.y = 0;
      player.vy = 0;
      player.isGrounded = true;

      if (input.jump) {
        player.vy = PLAYER_CONFIG.jumpForce;
        player.isGrounded = false;
      }
    } else {
      player.isGrounded = false;
      player.vy -= PLAYER_CONFIG.gravity * dt;
    }

    player.y += player.vy * dt;
    if (player.y <= 0) {
      player.y = 0;
      player.vy = 0;
      player.isGrounded = true;
    }

    const vx = Math.sin(player.rotationY) * player.speed;
    const vz = Math.cos(player.rotationY) * player.speed;
    player.x += vx * dt;
    player.z += vz * dt;

    player.x = this.clamp(player.x, ARENA_BOUNDS.minX, ARENA_BOUNDS.maxX);
    player.z = this.clamp(player.z, ARENA_BOUNDS.minZ, ARENA_BOUNDS.maxZ);
  }

  private simulateIdlePlayer(player: ConnectedPlayer, dt: number): void {
    if (player.isDriving) {
      return;
    }

    if (player.speed > 0) {
      player.speed = Math.max(0, player.speed - PLAYER_CONFIG.deceleration * dt);
    } else if (player.speed < 0) {
      player.speed = Math.min(0, player.speed + PLAYER_CONFIG.deceleration * dt);
    }

    if (player.y > 0) {
      player.isGrounded = false;
      player.vy -= PLAYER_CONFIG.gravity * dt;
      player.y += player.vy * dt;
      if (player.y <= 0) {
        player.y = 0;
        player.vy = 0;
        player.isGrounded = true;
      }
    }
  }

  private simulateDrivenVehicle(
    vehicle: RoomVehicle,
    driver: ConnectedPlayer,
    input: PlayerInputDto,
    dt: number,
  ): void {
    if (input.forward) {
      if (vehicle.currentSpeed < -0.5) {
        vehicle.currentSpeed += VEHICLE_CONFIG.brakeForce * dt;
      } else {
        vehicle.currentSpeed = Math.min(
          VEHICLE_CONFIG.maxSpeed,
          vehicle.currentSpeed + VEHICLE_CONFIG.acceleration * dt,
        );
      }
    } else if (input.backward) {
      if (vehicle.currentSpeed > 0.5) {
        vehicle.currentSpeed = Math.max(0, vehicle.currentSpeed - VEHICLE_CONFIG.brakeForce * dt);
      } else {
        vehicle.currentSpeed = Math.max(
          VEHICLE_CONFIG.reverseMaxSpeed,
          vehicle.currentSpeed - VEHICLE_CONFIG.acceleration * 0.75 * dt,
        );
      }
    } else {
      if (vehicle.currentSpeed > 0) {
        vehicle.currentSpeed = Math.max(0, vehicle.currentSpeed - VEHICLE_CONFIG.friction * dt);
      } else if (vehicle.currentSpeed < 0) {
        vehicle.currentSpeed = Math.min(0, vehicle.currentSpeed + VEHICLE_CONFIG.friction * dt);
      }
    }

    const isMovingFast = Math.abs(vehicle.currentSpeed) > 3.0;
    vehicle.isDrifting = Boolean(input.handbrake && isMovingFast);

    if (input.handbrake && !input.forward) {
      vehicle.currentSpeed *= Math.max(0, 1 - 1.2 * dt);
    }

    const absSpeed = Math.abs(vehicle.currentSpeed);
    const speedRatio = Math.min(1, absSpeed / 4.0);
    let effectiveTurnSpeed = VEHICLE_CONFIG.turnSpeed * speedRatio;
    if (vehicle.isDrifting) {
      effectiveTurnSpeed *= 1.5;
    }

    const directionSign = vehicle.currentSpeed >= 0 ? 1 : -1;
    let steer = 0;
    if (input.left) steer += 1;
    if (input.right) steer -= 1;

    if (steer !== 0 && absSpeed > 0.1) {
      vehicle.rotationY += steer * directionSign * effectiveTurnSpeed * dt;

      if (vehicle.isDrifting) {
        const driftSign = -steer;
        const lateralX = Math.cos(vehicle.rotationY) * driftSign;
        const lateralZ = -Math.sin(vehicle.rotationY) * driftSign;
        const slipForce = absSpeed * 0.85;

        vehicle.driftVelocityX += lateralX * slipForce * dt * 4.0;
        vehicle.driftVelocityZ += lateralZ * slipForce * dt * 4.0;
      }
    }

    const damping = vehicle.isDrifting ? Math.pow(0.88, dt * 60) : Math.pow(0.65, dt * 60);
    vehicle.driftVelocityX *= damping;
    vehicle.driftVelocityZ *= damping;

    const forwardX = Math.sin(vehicle.rotationY);
    const forwardZ = Math.cos(vehicle.rotationY);

    const vx = forwardX * vehicle.currentSpeed + vehicle.driftVelocityX;
    const vz = forwardZ * vehicle.currentSpeed + vehicle.driftVelocityZ;

    vehicle.x += vx * dt;
    vehicle.z += vz * dt;

    const bounce = -0.35;
    if (vehicle.x < ARENA_BOUNDS.minX) {
      vehicle.x = ARENA_BOUNDS.minX;
      vehicle.currentSpeed *= bounce;
      vehicle.driftVelocityX = 0;
    } else if (vehicle.x > ARENA_BOUNDS.maxX) {
      vehicle.x = ARENA_BOUNDS.maxX;
      vehicle.currentSpeed *= bounce;
      vehicle.driftVelocityX = 0;
    }

    if (vehicle.z < ARENA_BOUNDS.minZ) {
      vehicle.z = ARENA_BOUNDS.minZ;
      vehicle.currentSpeed *= bounce;
      vehicle.driftVelocityZ = 0;
    } else if (vehicle.z > ARENA_BOUNDS.maxZ) {
      vehicle.z = ARENA_BOUNDS.maxZ;
      vehicle.currentSpeed *= bounce;
      vehicle.driftVelocityZ = 0;
    }

    driver.x = vehicle.x;
    driver.y = vehicle.y;
    driver.z = vehicle.z;
    driver.rotationY = vehicle.rotationY;
    driver.speed = vehicle.currentSpeed;
  }

  private simulateIdleVehicle(vehicle: RoomVehicle, dt: number): void {
    vehicle.isDrifting = false;

    if (vehicle.currentSpeed > 0) {
      vehicle.currentSpeed = Math.max(0, vehicle.currentSpeed - VEHICLE_CONFIG.friction * 1.5 * dt);
    } else if (vehicle.currentSpeed < 0) {
      vehicle.currentSpeed = Math.min(0, vehicle.currentSpeed + VEHICLE_CONFIG.friction * 1.5 * dt);
    }

    const damping = Math.pow(0.65, dt * 60);
    vehicle.driftVelocityX *= damping;
    vehicle.driftVelocityZ *= damping;

    const forwardX = Math.sin(vehicle.rotationY);
    const forwardZ = Math.cos(vehicle.rotationY);

    vehicle.x += (forwardX * vehicle.currentSpeed + vehicle.driftVelocityX) * dt;
    vehicle.z += (forwardZ * vehicle.currentSpeed + vehicle.driftVelocityZ) * dt;

    const bounce = -0.35;
    if (vehicle.x < ARENA_BOUNDS.minX) {
      vehicle.x = ARENA_BOUNDS.minX;
      vehicle.currentSpeed *= bounce;
      vehicle.driftVelocityX = 0;
    } else if (vehicle.x > ARENA_BOUNDS.maxX) {
      vehicle.x = ARENA_BOUNDS.maxX;
      vehicle.currentSpeed *= bounce;
      vehicle.driftVelocityX = 0;
    }

    if (vehicle.z < ARENA_BOUNDS.minZ) {
      vehicle.z = ARENA_BOUNDS.minZ;
      vehicle.currentSpeed *= bounce;
      vehicle.driftVelocityZ = 0;
    } else if (vehicle.z > ARENA_BOUNDS.maxZ) {
      vehicle.z = ARENA_BOUNDS.maxZ;
      vehicle.currentSpeed *= bounce;
      vehicle.driftVelocityZ = 0;
    }
  }

  private buildSnapshot(ackInputs: Record<string, number>): WorldStateSnapshotDto {
    const players: PlayerSnapshot[] = Array.from(this.players.values()).map((p) => ({
      id: p.id,
      name: p.name,
      x: Number(p.x.toFixed(4)),
      y: Number(p.y.toFixed(4)),
      z: Number(p.z.toFixed(4)),
      rotationY: Number(p.rotationY.toFixed(4)),
      speed: Number(p.speed.toFixed(4)),
      isDriving: p.isDriving,
      isGrounded: p.isGrounded,
      vehicleId: p.vehicleId,
    }));

    const vehicles: VehicleSnapshot[] = Array.from(this.vehicles.values()).map((v) => ({
      id: v.id,
      x: Number(v.x.toFixed(4)),
      y: Number(v.y.toFixed(4)),
      z: Number(v.z.toFixed(4)),
      rotationY: Number(v.rotationY.toFixed(4)),
      speed: Number(v.currentSpeed.toFixed(4)),
      durability: v.durability,
      driverId: v.driverId,
    }));

    return {
      tick: this.currentTick,
      timestamp: Date.now(),
      players,
      vehicles,
      ackInputs,
    };
  }

  private broadcastSnapshot(snapshot: WorldStateSnapshotDto): void {
    if (this.server) {
      this.server.to('game-room').emit('worldStateSnapshot', snapshot);
    }

    for (const callback of this.snapshotCallbacks) {
      callback(snapshot);
    }
  }

  private clamp(value: number, min: number, max: number): number {
    return Math.max(min, Math.min(max, value));
  }
}
