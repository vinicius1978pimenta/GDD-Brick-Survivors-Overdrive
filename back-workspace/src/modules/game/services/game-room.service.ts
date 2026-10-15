import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { Server } from 'socket.io';
import { PlayerInputDto } from '../dto/player-input.dto.js';
import { WorldStateSnapshotDto } from '../dto/world-state-snapshot.dto.js';
import {
  ARENA_BOUNDS,
  CITY_OBSTACLES,
  DEFAULT_CHARACTER_TYPE,
  HERO_COLLISION_CONFIG,
  PLAYER_CONFIG,
  SIMULATION_CONFIG,
  VEHICLE_COLLISION_CONFIG,
  VEHICLE_CONFIG,
} from '../interfaces/index.js';
import type {
  ActiveProjectile,
  CharacterType,
  ConnectedPlayer,
  DamageEvent,
  DamageEventSnapshot,
  KillEvent,
  PlayerShootPayload,
  PlayerSnapshot,
  ProjectileSnapshot,
  RoomVehicle,
  ShootResult,
  VehicleSnapshot,
  WorldObstacleAABB,
} from '../interfaces/index.js';
import { CombatService } from './combat.service.js';
import { MatchManagerService } from './match-manager.service.js';

export type {
  CharacterType,
  ConnectedPlayer,
  KillEvent,
  PlayerSnapshot,
  RoomVehicle,
  VehicleSnapshot,
  WorldObstacleAABB,
};
export {
  ARENA_BOUNDS,
  CITY_OBSTACLES,
  DEFAULT_CHARACTER_TYPE,
  HERO_COLLISION_CONFIG,
  PLAYER_CONFIG,
  SIMULATION_CONFIG,
  VEHICLE_COLLISION_CONFIG,
  VEHICLE_CONFIG,
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
  private pendingDamageEvents: DamageEvent[] = [];

  constructor(
    private readonly combatService: CombatService = new CombatService(),
    private readonly matchManagerService: MatchManagerService = new MatchManagerService(),
  ) {
    this.initDefaultVehicles();
  }

  onModuleInit(): void {
    this.startGameLoop();
  }

  onModuleDestroy(): void {
    this.stopGameLoop();
    this.combatService.clear();
    this.matchManagerService.reset();
  }

  public setServer(server: Server): void {
    this.server = server;
  }

  public getCombatService(): CombatService {
    return this.combatService;
  }

  public getMatchManagerService(): MatchManagerService {
    return this.matchManagerService;
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
    const defaultVehicles: RoomVehicle[] = [
      {
        id: 'vehicle-alpha',
        x: 0,
        y: 0,
        z: 5,
        rotationY: 0,
        currentSpeed: 0,
        durability: 100,
        driverId: null,
        driftVelocityX: 0,
        driftVelocityZ: 0,
        isDrifting: false,
      },
      {
        id: 'vehicle-beta',
        x: -25,
        y: 0,
        z: -20,
        rotationY: 0,
        currentSpeed: 0,
        durability: 100,
        driverId: null,
        driftVelocityX: 0,
        driftVelocityZ: 0,
        isDrifting: false,
      },
      {
        id: 'vehicle-gamma',
        x: 25,
        y: 0,
        z: 20,
        rotationY: 0,
        currentSpeed: 0,
        durability: 100,
        driverId: null,
        driftVelocityX: 0,
        driftVelocityZ: 0,
        isDrifting: false,
      },
      {
        id: 'vehicle-delta',
        x: -20,
        y: 0,
        z: 25,
        rotationY: 0,
        currentSpeed: 0,
        durability: 100,
        driverId: null,
        driftVelocityX: 0,
        driftVelocityZ: 0,
        isDrifting: false,
      },
    ];

    for (const v of defaultVehicles) {
      this.vehicles.set(v.id, v);
    }
  }

  public addPlayer(
    socketId: string,
    playerName?: string,
    characterType?: CharacterType,
  ): ConnectedPlayer {
    const trimmed = playerName?.trim();
    const defaultName = trimmed && trimmed.length > 0
      ? trimmed
      : `Hero_${socketId.slice(0, 4)}`;

    const selectedCharacter = characterType ?? DEFAULT_CHARACTER_TYPE;

    const existingPlayer = this.players.get(socketId);
    if (existingPlayer) {
      existingPlayer.name = defaultName;
      if (characterType) {
        existingPlayer.characterType = characterType;
      }
      this.matchManagerService.registerPlayer(existingPlayer);
      this.logger.log(`Player updated in room: ${existingPlayer.name} (${socketId})`);
      return existingPlayer;
    }

    // Distributed spawn in ring 20m - 45m (spaced out to avoid collision)
    const playerIndex = this.players.size;
    const angle = (playerIndex * ((Math.PI * 2) / 8)) + (Math.PI / 6);
    const radius = 22.0 + ((playerIndex % 5) * 5.0); // 22m, 27m, 32m, 37m, 42m
    const rawX = Math.cos(angle) * radius;
    const rawZ = Math.sin(angle) * radius;
    const spawnX = Number(this.clamp(rawX, ARENA_BOUNDS.minX + 3, ARENA_BOUNDS.maxX - 3).toFixed(2));
    const spawnZ = Number(this.clamp(rawZ, ARENA_BOUNDS.minZ + 3, ARENA_BOUNDS.maxZ - 3).toFixed(2));

    const player: ConnectedPlayer = {
      id: socketId,
      name: defaultName,
      characterType: selectedCharacter,
      x: spawnX,
      y: 0,
      z: spawnZ,
      vx: 0,
      vy: 0,
      vz: 0,
      rotationY: angle,
      speed: 0,
      isDriving: false,
      isGrounded: true,
      vehicleId: null,
      lastProcessedSeq: 0,
      pendingInputs: [],
      health: PLAYER_CONFIG.maxHealth,
      maxHealth: PLAYER_CONFIG.maxHealth,
      weapon: 'stud_blaster',
    };

    this.resolveObstacleCollisions(player, HERO_COLLISION_CONFIG.radius);

    this.players.set(socketId, player);
    this.matchManagerService.registerPlayer(player);
    this.logger.log(
      `Player added to room: ${player.name} (${socketId}) [${player.characterType}] at (${player.x}, ${player.z})`,
    );
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

    this.combatService.resetPlayerCooldowns(socketId);
    this.matchManagerService.unregisterPlayer(socketId);
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

  public handlePlayerShoot(
    playerId: string,
    payload: PlayerShootPayload,
  ): ShootResult {
    const player = this.players.get(playerId);
    if (!player) {
      return {
        success: false,
        reason: 'Player not connected',
        projectilesSpawned: 0,
      };
    }
    player.weapon = payload.weaponType;
    return this.combatService.handleShoot(playerId, payload);
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

    const { damageEvents, activeProjectiles } = this.combatService.update(
      dt,
      this.players,
      this.vehicles,
    );

    const allDamageEvents = [...damageEvents, ...this.pendingDamageEvents];
    this.pendingDamageEvents = [];

    this.matchManagerService.update(
      dt,
      this.players,
      this.vehicles,
      this.combatService,
    );

    const snapshot = this.buildSnapshot(ackInputs, activeProjectiles, allDamageEvents);
    this.broadcastSnapshot(snapshot, allDamageEvents);
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
      player.vx = 0;
      player.vy = 0;
      player.vz = 0;
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
      player.vx = 0;
      player.vy = 0;
      player.vz = 0;
      player.isGrounded = true;
    }
  }

  private simulatePedestrian(player: ConnectedPlayer, input: PlayerInputDto, dt: number): void {
    if (typeof input.rotationY === 'number') {
      player.rotationY = input.rotationY;
    } else {
      let steer = 0;
      if (input.left) steer += 1;
      if (input.right) steer -= 1;

      if (steer !== 0) {
        player.rotationY += steer * PLAYER_CONFIG.turnSpeed * dt;
      }
    }

    const forwardAxis = (input.forward ? 1 : 0) - (input.backward ? 1 : 0);
    const strafeAxis = (input.right ? 1 : 0) - (input.left ? 1 : 0);
    const fx = Math.sin(player.rotationY);
    const fz = Math.cos(player.rotationY);
    const rx = -Math.cos(player.rotationY);
    const rz = Math.sin(player.rotationY);

    if (forwardAxis !== 0 || strafeAxis !== 0) {
      let dx = fx * forwardAxis + rx * strafeAxis;
      let dz = fz * forwardAxis + rz * strafeAxis;
      const len = Math.hypot(dx, dz) || 1;
      dx /= len;
      dz /= len;
      player.speed = Math.min(PLAYER_CONFIG.maxSpeed, player.speed + PLAYER_CONFIG.acceleration * dt);
      player.vx = dx * player.speed;
      player.vz = dz * player.speed;
      player.x += player.vx * dt;
      player.z += player.vz * dt;
    } else {
      if (player.speed > 0) {
        player.speed = Math.max(0, player.speed - PLAYER_CONFIG.deceleration * dt);
        const currentLen = Math.hypot(player.vx, player.vz);
        if (currentLen > 0.001) {
          player.vx = (player.vx / currentLen) * player.speed;
          player.vz = (player.vz / currentLen) * player.speed;
          player.x += player.vx * dt;
          player.z += player.vz * dt;
        } else {
          player.vx = 0;
          player.vz = 0;
        }
      } else {
        player.speed = 0;
        player.vx = 0;
        player.vz = 0;
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

    this.resolveObstacleCollisions(player, HERO_COLLISION_CONFIG.radius);

    for (const vehicle of this.vehicles.values()) {
      this.resolvePedestrianVehicleCollision(player, vehicle);
    }

    this.resolveObstacleCollisions(player, HERO_COLLISION_CONFIG.radius);

    player.x = this.clamp(player.x, ARENA_BOUNDS.minX, ARENA_BOUNDS.maxX);
    player.z = this.clamp(player.z, ARENA_BOUNDS.minZ, ARENA_BOUNDS.maxZ);
  }

  private simulateIdlePlayer(player: ConnectedPlayer, dt: number): void {
    if (player.isDriving) {
      return;
    }

    if (player.speed > 0) {
      player.speed = Math.max(0, player.speed - PLAYER_CONFIG.deceleration * dt);
      const currentLen = Math.hypot(player.vx, player.vz);
      if (currentLen > 0.001) {
        player.vx = (player.vx / currentLen) * player.speed;
        player.vz = (player.vz / currentLen) * player.speed;
        player.x += player.vx * dt;
        player.z += player.vz * dt;
      } else {
        player.vx = 0;
        player.vz = 0;
      }
    } else {
      player.speed = 0;
      player.vx = 0;
      player.vz = 0;
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

    this.resolveObstacleCollisions(player, HERO_COLLISION_CONFIG.radius);

    for (const vehicle of this.vehicles.values()) {
      this.resolvePedestrianVehicleCollision(player, vehicle);
    }

    this.resolveObstacleCollisions(player, HERO_COLLISION_CONFIG.radius);

    player.x = this.clamp(player.x, ARENA_BOUNDS.minX, ARENA_BOUNDS.maxX);
    player.z = this.clamp(player.z, ARENA_BOUNDS.minZ, ARENA_BOUNDS.maxZ);
  }

  public resolvePedestrianVehicleCollision(
    player: ConnectedPlayer,
    vehicle: RoomVehicle,
  ): boolean {
    if (player.isDriving || player.vehicleId === vehicle.id) {
      return false;
    }

    const halfWidth = VEHICLE_COLLISION_CONFIG.halfWidth;
    const halfLength = VEHICLE_COLLISION_CONFIG.halfLength;
    const heroRadius = HERO_COLLISION_CONFIG.radius;

    const dx = player.x - vehicle.x;
    const dz = player.z - vehicle.z;

    const angle = vehicle.rotationY;
    const forwardX = Math.sin(angle);
    const forwardZ = Math.cos(angle);
    const rightX = Math.cos(angle);
    const rightZ = -Math.sin(angle);

    // Transform relative position into vehicle local coordinate frame
    const localX = dx * rightX + dz * rightZ;
    const localZ = dx * forwardX + dz * forwardZ;

    // Find the closest point on the vehicle body rectangle
    const closestX = Math.max(-halfWidth, Math.min(halfWidth, localX));
    const closestZ = Math.max(-halfLength, Math.min(halfLength, localZ));

    const diffX = localX - closestX;
    const diffZ = localZ - closestZ;
    const distSq = diffX * diffX + diffZ * diffZ;

    let pushLocalX = 0;
    let pushLocalZ = 0;
    let normalLocalX = 0;
    let normalLocalZ = 0;

    if (distSq > 0.000001) {
      const dist = Math.sqrt(distSq);
      if (dist < heroRadius) {
        const penetration = heroRadius - dist;
        normalLocalX = diffX / dist;
        normalLocalZ = diffZ / dist;
        pushLocalX = normalLocalX * penetration;
        pushLocalZ = normalLocalZ * penetration;
      } else {
        return false;
      }
    } else {
      // Player center is deeply inside the vehicle box; push out along nearest axis
      const penLeft = halfWidth + heroRadius + localX;
      const penRight = halfWidth + heroRadius - localX;
      const penBack = halfLength + heroRadius + localZ;
      const penFront = halfLength + heroRadius - localZ;

      const minPen = Math.min(penLeft, penRight, penBack, penFront);

      if (minPen === penRight) {
        normalLocalX = 1;
        pushLocalX = penRight;
      } else if (minPen === penLeft) {
        normalLocalX = -1;
        pushLocalX = -penLeft;
      } else if (minPen === penFront) {
        normalLocalZ = 1;
        pushLocalZ = penFront;
      } else {
        normalLocalZ = -1;
        pushLocalZ = -penBack;
      }
    }

    // Convert local push vector and collision normal back to world space
    const pushWorldX = pushLocalX * rightX + pushLocalZ * forwardX;
    const pushWorldZ = pushLocalX * rightZ + pushLocalZ * forwardZ;
    const normalWorldX = normalLocalX * rightX + normalLocalZ * forwardX;
    const normalWorldZ = normalLocalX * rightZ + normalLocalZ * forwardZ;

    // Apply push-out to project pedestrian outside the vehicle body
    player.x += pushWorldX;
    player.z += pushWorldZ;

    // Cancel velocity directed towards the vehicle to allow smooth lateral sliding
    const velX = Math.sin(player.rotationY) * player.speed;
    const velZ = Math.cos(player.rotationY) * player.speed;
    const dot = velX * normalWorldX + velZ * normalWorldZ;

    if (dot < 0) {
      const tangentVelX = velX - dot * normalWorldX;
      const tangentVelZ = velZ - dot * normalWorldZ;
      player.speed = Math.hypot(tangentVelX, tangentVelZ);
    }

    // Vehicular Ramming (Atropelamento)
    const absSpeed = Math.abs(vehicle.currentSpeed);
    if (vehicle.driverId && absSpeed >= 3.0) {
      const damage = Math.min(75, Math.max(10, Math.floor(absSpeed * 3.5)));
      player.health = Math.max(0, player.health - damage);

      const dirSign = Math.sign(vehicle.currentSpeed) || 1;
      const forwardDirX = Math.sin(vehicle.rotationY) * dirSign;
      const forwardDirZ = Math.cos(vehicle.rotationY) * dirSign;
      const knockbackDist = 3.0 + absSpeed * 0.35;

      player.x += forwardDirX * knockbackDist;
      player.z += forwardDirZ * knockbackDist;
      player.y = 1.0;
      player.vy = 4.5;
      player.isGrounded = false;

      player.x = this.clamp(player.x, ARENA_BOUNDS.minX, ARENA_BOUNDS.maxX);
      player.z = this.clamp(player.z, ARENA_BOUNDS.minZ, ARENA_BOUNDS.maxZ);

      const damageEvent: DamageEvent = {
        targetId: player.id,
        amount: damage,
        isVehicle: false,
        x: player.x,
        y: player.y,
        z: player.z,
        attackerId: vehicle.driverId,
        weaponType: 'stud_blaster',
        timestamp: Date.now(),
        knockbackX: forwardDirX * knockbackDist,
        knockbackZ: forwardDirZ * knockbackDist,
      };
      this.pendingDamageEvents.push(damageEvent);

      if (player.health <= 0) {
        this.matchManagerService.recordKill(vehicle.driverId, player.id, 'atropelamento');
        const driver = this.players.get(vehicle.driverId);
        const killPayload: KillEvent = {
          killerId: vehicle.driverId,
          killerName: driver ? driver.name : 'Unknown Driver',
          victimId: player.id,
          victimName: player.name,
          reason: 'atropelamento',
          timestamp: Date.now(),
        };
        if (this.server) {
          this.server.to('game-room').emit('killEvent', killPayload);
        }
        this.logger.log(
          `Kill via atropelamento: ${killPayload.killerName} ran over ${killPayload.victimName}!`,
        );
      }
    }

    return true;
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

    const hitObstacle = this.resolveObstacleCollisions(vehicle, VEHICLE_COLLISION_CONFIG.radius);
    if (hitObstacle) {
      vehicle.currentSpeed *= -0.25;
      vehicle.driftVelocityX = 0;
      vehicle.driftVelocityZ = 0;
    }

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

    for (const pedestrian of this.players.values()) {
      if (!pedestrian.isDriving && pedestrian.vehicleId !== vehicle.id) {
        this.resolvePedestrianVehicleCollision(pedestrian, vehicle);
      }
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

    const hitObstacle = this.resolveObstacleCollisions(vehicle, VEHICLE_COLLISION_CONFIG.radius);
    if (hitObstacle) {
      vehicle.currentSpeed *= -0.25;
      vehicle.driftVelocityX = 0;
      vehicle.driftVelocityZ = 0;
    }

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

  private buildSnapshot(
    ackInputs: Record<string, number>,
    activeProjectiles: ActiveProjectile[] = [],
    damageEvents: DamageEvent[] = [],
  ): WorldStateSnapshotDto {
    const players: PlayerSnapshot[] = Array.from(this.players.values()).map((p) => ({
      id: p.id,
      name: p.name,
      characterType: p.characterType ?? DEFAULT_CHARACTER_TYPE,
      x: Number(p.x.toFixed(4)),
      y: Number(p.y.toFixed(4)),
      z: Number(p.z.toFixed(4)),
      rotationY: Number(p.rotationY.toFixed(4)),
      speed: Number(p.speed.toFixed(4)),
      isDriving: p.isDriving,
      isGrounded: p.isGrounded,
      vehicleId: p.vehicleId,
      health: p.health,
      maxHealth: p.maxHealth,
      hp: p.health,
      maxHp: p.maxHealth,
      weapon: p.weapon ?? 'stud_blaster',
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

    const projectiles: ProjectileSnapshot[] = activeProjectiles.map((p) => ({
      id: p.id,
      weaponType: p.weaponType,
      x: Number(p.x.toFixed(4)),
      y: Number(p.y.toFixed(4)),
      z: Number(p.z.toFixed(4)),
      vx: Number(p.vx.toFixed(4)),
      vy: Number(p.vy.toFixed(4)),
      vz: Number(p.vz.toFixed(4)),
    }));

    const damageSnapshots: DamageEventSnapshot[] = damageEvents.map((d) => ({
      targetId: d.targetId,
      amount: d.amount,
      isVehicle: d.isVehicle,
      x: Number(d.x.toFixed(4)),
      y: Number(d.y.toFixed(4)),
      z: Number(d.z.toFixed(4)),
    }));

    return {
      tick: this.currentTick,
      timestamp: Date.now(),
      players,
      vehicles,
      ackInputs,
      projectiles,
      damageEvents: damageSnapshots,
      match: this.matchManagerService.getSnapshot(),
    };
  }

  private broadcastSnapshot(
    snapshot: WorldStateSnapshotDto,
    damageEvents: DamageEvent[] = [],
  ): void {
    if (this.server) {
      this.server.to('game-room').emit('worldStateSnapshot', snapshot);
      if (damageEvents.length > 0) {
        this.server.to('game-room').emit('combatEvent', damageEvents);
      }
    }

    for (const callback of this.snapshotCallbacks) {
      callback(snapshot);
    }
  }

  public resolveObstacleCollisions(
    entity: { x: number; z: number },
    radius: number,
  ): boolean {
    let collided = false;
    for (const obs of CITY_OBSTACLES) {
      const closestX = Math.max(obs.minX, Math.min(obs.maxX, entity.x));
      const closestZ = Math.max(obs.minZ, Math.min(obs.maxZ, entity.z));

      const diffX = entity.x - closestX;
      const diffZ = entity.z - closestZ;
      const distSq = diffX * diffX + diffZ * diffZ;

      if (distSq > 0.000001) {
        if (distSq < radius * radius) {
          const dist = Math.sqrt(distSq);
          const penetration = radius - dist;
          const normalX = diffX / dist;
          const normalZ = diffZ / dist;
          entity.x += normalX * penetration;
          entity.z += normalZ * penetration;
          collided = true;
        }
      } else {
        const penLeft = entity.x - obs.minX + radius;
        const penRight = obs.maxX - entity.x + radius;
        const penBottom = entity.z - obs.minZ + radius;
        const penTop = obs.maxZ - entity.z + radius;

        const minPen = Math.min(penLeft, penRight, penBottom, penTop);
        if (minPen === penLeft) {
          entity.x = obs.minX - radius;
        } else if (minPen === penRight) {
          entity.x = obs.maxX + radius;
        } else if (minPen === penBottom) {
          entity.z = obs.minZ - radius;
        } else {
          entity.z = obs.maxZ + radius;
        }
        collided = true;
      }
    }
    return collided;
  }

  public restartMatch(): WorldStateSnapshotDto {
    this.logger.log('Restarting match: resetting FSM, players, vehicles and combat');

    this.matchManagerService.reset();
    this.combatService.clear();
    this.pendingDamageEvents = [];
    for (const v of this.vehicles.values()) {
      v.driverId = null;
      v.currentSpeed = 0;
      v.driftVelocityX = 0;
      v.driftVelocityZ = 0;
      v.isDrifting = false;
    }
    this.initDefaultVehicles();

    let playerIndex = 0;
    for (const player of this.players.values()) {
      player.health = PLAYER_CONFIG.maxHealth;
      player.maxHealth = PLAYER_CONFIG.maxHealth;
      player.isDriving = false;
      player.vehicleId = null;
      player.speed = 0;
      player.vx = 0;
      player.vy = 0;
      player.vz = 0;
      player.isGrounded = true;
      player.pendingInputs = [];

      const angle = (playerIndex * ((Math.PI * 2) / 8)) + (Math.PI / 6);
      const radius = 22.0 + ((playerIndex % 5) * 5.0);
      const rawX = Math.cos(angle) * radius;
      const rawZ = Math.sin(angle) * radius;
      player.x = Number(this.clamp(rawX, ARENA_BOUNDS.minX + 3, ARENA_BOUNDS.maxX - 3).toFixed(2));
      player.y = 0;
      player.z = Number(this.clamp(rawZ, ARENA_BOUNDS.minZ + 3, ARENA_BOUNDS.maxZ - 3).toFixed(2));
      player.rotationY = angle;

      this.resolveObstacleCollisions(player, HERO_COLLISION_CONFIG.radius);
      this.matchManagerService.registerPlayer(player);
      playerIndex++;
    }

    const ackInputs: Record<string, number> = {};
    for (const player of this.players.values()) {
      ackInputs[player.id] = player.lastProcessedSeq;
    }

    const snapshot = this.buildSnapshot(ackInputs, [], []);
    this.broadcastSnapshot(snapshot, []);

    if (this.server) {
      this.server.to('game-room').emit('matchSnapshot', this.matchManagerService.getSnapshot());
    }

    return snapshot;
  }

  private clamp(value: number, min: number, max: number): number {
    return Math.max(min, Math.min(max, value));
  }
}
