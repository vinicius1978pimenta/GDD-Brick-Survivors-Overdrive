import { GameLoop } from './game-loop';
import {
  updateInteractionSystem,
  canInteractWithVehicle,
  canDismountVehicle,
} from './interaction.system';
import { updateMovementSystem } from './movement.system';
import {
  ArenaBounds,
  CharacterControllerComponent,
  DEFAULT_ARENA_BOUNDS,
  FIXED_TIMESTEP,
  InputState,
  TransformComponent,
  VehicleComponent,
  VelocityComponent,
} from './types';
import { updateVehicleSystem } from './vehicle.system';
import { ObjectPool } from './object-pool';
import { DebrisParticle, ModularVehicleComponent, Vector3D } from './modular-block.types';
import {
  applyDamageToBlock,
  applyVehicleImpactDamage,
  createDebrisFactory,
  createDefaultBuggyBlocks,
  dismantleVehicle,
  updateDebrisSimulation,
} from './modular-block.system';
import {
  LocalDamageEvent,
  ProjectileEntity,
  WEAPON_CATALOG,
  WeaponType,
} from './interfaces/combat.interface';
import { createProjectilePool, spawnProjectiles, updateCombatSystem } from './combat.system';
import { SpatialHashGrid } from './spatial-hash-grid';
import { PendingInput, WorldStateSnapshot } from '../network/network.types';

/**
 * GameWorld coordena a simulação ECS isomórfica e pura de Brick Survivors: Overdrive.
 */
export class GameWorld {
  public readonly heroId = 1;
  public readonly vehicleId = 2;

  // Componentes do Herói
  public readonly heroTransform: TransformComponent = {
    x: 0,
    y: 0,
    z: 0,
    rotationY: 0,
  };

  public readonly heroVelocity: VelocityComponent = {
    vx: 0,
    vy: 0,
    vz: 0,
    angularVelocityY: 0,
  };

  public readonly heroController: CharacterControllerComponent = {
    speed: 0,
    maxSpeed: 8.5,
    reverseMaxSpeed: -4.8,
    acceleration: 24.0,
    deceleration: 28.0,
    turnSpeed: 3.8,
    jumpForce: 7.2,
    gravity: 18.0,
    isGrounded: true,
    isMoving: false,
    moveAngle: 0,
  };

  // Componentes do Veículo (Buggy Arcade de Blocos)
  public readonly vehicleTransform: TransformComponent = {
    x: 3.5,
    y: 0,
    z: -2.5,
    rotationY: Math.PI / 4,
  };

  public readonly vehicleVelocity: VelocityComponent = {
    vx: 0,
    vy: 0,
    vz: 0,
    angularVelocityY: 0,
  };

  public readonly vehicleComponent: VehicleComponent = {
    currentSpeed: 0,
    maxSpeed: 24.0, // ~86 km/h
    reverseMaxSpeed: -8.0,
    acceleration: 18.0,
    brakeForce: 30.0,
    friction: 7.5,
    turnSpeed: 2.85,
    isDrifting: false,
    driverEntityId: null,
    driftVelocityX: 0,
    driftVelocityZ: 0,
  };

  // Componente de Lataria Modular e Destruição (Blocos LEGO)
  public readonly modularVehicle: ModularVehicleComponent = {
    blocks: createDefaultBuggyBlocks(),
    durabilityPercentage: 100,
    mass: 850,
  };

  // ObjectPool de Detritos Físicos
  public readonly debrisPool: ObjectPool<DebrisParticle> = new ObjectPool<DebrisParticle>(
    createDebrisFactory(),
    undefined,
    24,
    128,
  );
  public readonly activeDebris: DebrisParticle[] = [];

  // Arsenal Fictício e Sistema de Combate LEGO
  private currentWeapon: WeaponType = 'stud_blaster';
  public readonly weaponCooldowns: Record<WeaponType, number> = {
    stud_blaster: 0,
    scatter_shot: 0,
    spring_mine: 0,
  };
  public readonly projectilePool: ObjectPool<ProjectileEntity> = createProjectilePool(64);
  public readonly activeProjectiles: ProjectileEntity[] = [];
  public readonly spatialGrid: SpatialHashGrid = new SpatialHashGrid(8.0);
  public readonly recentDamageEvents: LocalDamageEvent[] = [];

  // Estado de Entrada (Inputs)
  public readonly inputState: InputState = {
    forward: false,
    backward: false,
    left: false,
    right: false,
    handbrake: false,
    jump: false,
    interact: false,
  };

  public readonly gameLoop: GameLoop;
  public readonly bounds: ArenaBounds;

  constructor(bounds: ArenaBounds = DEFAULT_ARENA_BOUNDS) {
    this.bounds = bounds;
    this.gameLoop = new GameLoop((dt) => this.fixedUpdate(dt));
  }

  /**
   * Atualização determinística em Fixed Timestep (60Hz).
   */
  public fixedUpdate(dt: number = FIXED_TIMESTEP): void {
    // 1. Sistema de Interação (Embarque / Desembarque)
    updateInteractionSystem(
      this.heroTransform,
      this.heroVelocity,
      this.vehicleTransform,
      this.vehicleComponent,
      this.inputState,
      this.heroId,
      this.bounds,
    );

    const isDriving = this.isDriving();

    // 2. Sistema de Movimentação Pedestre
    updateMovementSystem(
      this.heroTransform,
      this.heroVelocity,
      this.heroController,
      this.inputState,
      isDriving,
      dt,
      this.bounds,
    );

    // 3. Sistema de Física Veicular com Detecção de Impacto
    const speedBefore = Math.abs(this.vehicleComponent.currentSpeed);

    updateVehicleSystem(
      this.vehicleTransform,
      this.vehicleVelocity,
      this.vehicleComponent,
      this.inputState,
      dt,
      this.bounds,
    );

    // Detecta impacto brusco com bordas da arena
    const isAtBoundary =
      this.vehicleTransform.x <= this.bounds.minX ||
      this.vehicleTransform.x >= this.bounds.maxX ||
      this.vehicleTransform.z <= this.bounds.minZ ||
      this.vehicleTransform.z >= this.bounds.maxZ;

    if (isAtBoundary && speedBefore > 4.5) {
      applyVehicleImpactDamage(
        this.modularVehicle,
        this.vehicleTransform,
        speedBefore,
        this.debrisPool,
        this.activeDebris,
      );
    }

    // Verifica se a integridade do veículo chegou a 0% e dispara a desmontagem e ejeção
    this.checkVehicleDestruction();

    // 4. Atualização da Simulação de Detritos Físicos
    updateDebrisSimulation(this.activeDebris, this.debrisPool, dt, this.bounds);

    // 5. Atualização dos Cooldowns de Armas
    for (const key of Object.keys(this.weaponCooldowns) as WeaponType[]) {
      if (this.weaponCooldowns[key] > 0) {
        this.weaponCooldowns[key] = Math.max(0, this.weaponCooldowns[key] - dt * 1000);
      }
    }

    // 6. Atualização do SpatialHashGrid para Broad-Phase
    this.spatialGrid.update(
      'vehicle_buggy',
      { x: this.vehicleTransform.x, y: this.vehicleTransform.y, z: this.vehicleTransform.z },
      2.0,
    );

    if (!isDriving) {
      this.spatialGrid.update(
        'hero_local',
        { x: this.heroTransform.x, y: this.heroTransform.y, z: this.heroTransform.z },
        0.6,
      );
    } else {
      this.spatialGrid.remove('hero_local');
    }

    // 7. Simulação Balística e Testes de Impacto de Projéteis
    updateCombatSystem(
      this.activeProjectiles,
      this.projectilePool,
      this.spatialGrid,
      dt,
      this.bounds,
      this.vehicleTransform,
      this.modularVehicle,
      this.debrisPool,
      this.activeDebris,
      (dmg) => {
        this.recentDamageEvents.push(dmg);
        if (this.recentDamageEvents.length > 50) {
          this.recentDamageEvents.shift();
        }
      },
    );

    // 8. Se ainda estiver dirigindo, acopla o herói ao assento do veículo
    if (this.isDriving()) {
      this.heroTransform.x = this.vehicleTransform.x;
      this.heroTransform.y = this.vehicleTransform.y + 0.35;
      this.heroTransform.z = this.vehicleTransform.z;
      this.heroTransform.rotationY = this.vehicleTransform.rotationY;
    }
  }

  /**
   * Verifica se a integridade estrutural do veículo zerou. Em caso positivo,
   * desmonta todas as peças restantes em detritos físicos, desativa os motores
   * e ejeta o motorista com segurança para fora do veículo.
   */
  public checkVehicleDestruction(): void {
    if (this.modularVehicle.durabilityPercentage === 0 && !this.vehicleComponent.isDestroyed) {
      this.vehicleComponent.isDestroyed = true;
      this.vehicleComponent.currentSpeed = 0;
      this.vehicleVelocity.vx = 0;
      this.vehicleVelocity.vy = 0;
      this.vehicleVelocity.vz = 0;
      this.vehicleVelocity.angularVelocityY = 0;

      dismantleVehicle(
        this.modularVehicle,
        this.vehicleTransform,
        this.debrisPool,
        this.activeDebris,
      );

      // Desembarque / ejeção automática de emergência
      if (this.isDriving()) {
        const exitOffset = 1.8;
        const angle = this.vehicleTransform.rotationY;
        this.heroTransform.x = Math.max(
          this.bounds.minX,
          Math.min(this.bounds.maxX, this.vehicleTransform.x - exitOffset * Math.cos(angle)),
        );
        this.heroTransform.y = 0;
        this.heroTransform.z = Math.max(
          this.bounds.minZ,
          Math.min(this.bounds.maxZ, this.vehicleTransform.z + exitOffset * Math.sin(angle)),
        );
        this.heroVelocity.vx = 0;
        this.heroVelocity.vy = 0;
        this.heroVelocity.vz = 0;
        this.vehicleComponent.driverEntityId = null;
      }
    }
  }

  /**
   * Força o desprendimento imediato de uma peça de lataria (usado para testes ou disparos).
   * Bloqueado enquanto o jogador estiver pilotando o veículo.
   */
  public forceDetachNextBlock(): boolean {
    if (this.isDriving()) {
      return false;
    }

    const attachedBlock = this.modularVehicle.blocks.find((b) => !b.isDetached);
    if (!attachedBlock) {
      return false;
    }

    const detached = applyDamageToBlock(
      this.modularVehicle,
      attachedBlock.id,
      attachedBlock.maxHealth + 10,
      this.vehicleTransform,
      this.debrisPool,
      this.activeDebris,
    );

    this.checkVehicleDestruction();
    return detached;
  }

  public getDurabilityPercentage(): number {
    return this.modularVehicle.durabilityPercentage;
  }

  /**
   * Executa um passo de simulação por um deltaTime qualquer (usado no game loop da viewport).
   */
  public step(deltaTimeSeconds: number): void {
    this.gameLoop.step(deltaTimeSeconds);
  }

  public isDriving(): boolean {
    return this.vehicleComponent.driverEntityId === this.heroId;
  }

  public isVehicleDestroyed(): boolean {
    return Boolean(
      this.vehicleComponent.isDestroyed || this.modularVehicle.durabilityPercentage <= 0,
    );
  }

  public canInteract(): boolean {
    return canInteractWithVehicle(
      this.heroTransform,
      this.vehicleTransform,
      undefined,
      this.isVehicleDestroyed(),
    );
  }

  public canDismount(): boolean {
    return canDismountVehicle(this.vehicleComponent);
  }

  public getSpeedKmh(): number {
    const rawSpeed = this.isDriving()
      ? Math.abs(this.vehicleComponent.currentSpeed)
      : Math.abs(this.heroController.speed);
    // Conversão de unidades do mundo (1 bloco = 1 metro) para km/h: 1 m/s = 3.6 km/h
    return Math.round(rawSpeed * 3.6);
  }

  public isDrifting(): boolean {
    return this.vehicleComponent.isDrifting;
  }

  public setInput(input: Partial<InputState>): void {
    Object.assign(this.inputState, input);
  }

  public triggerInteract(): void {
    this.inputState.interact = true;
  }

  // --- CLIENT-SIDE PREDICTION & SERVER RECONCILIATION ---
  public readonly pendingInputs: PendingInput[] = [];

  /**
   * Enfileira um input enviado ao servidor com a posição prevista localmente.
   */
  public enqueuePendingInput(seq: number, input: InputState, dt: number): void {
    this.pendingInputs.push({
      seq,
      input: {
        forward: input.forward,
        backward: input.backward,
        left: input.left,
        right: input.right,
        handbrake: input.handbrake,
        jump: Boolean(input.jump),
        interact: input.interact,
      },
      dt,
      predictedPosition: {
        x: this.heroTransform.x,
        y: this.heroTransform.y,
        z: this.heroTransform.z,
      },
    });

    // Limita o buffer para evitar crescimento descontrolado
    if (this.pendingInputs.length > 120) {
      this.pendingInputs.shift();
    }
  }

  /**
   * Executa a reconciliação autoritativa baseada no snapshot do servidor.
   * Se a divergência exceder o limiar (ex: 0.25m), ajusta e reaplica os inputs pendentes.
   */
  public reconcileServerSnapshot(
    snapshot: WorldStateSnapshot,
    localPlayerId: string,
    divergenceThreshold = 0.25,
  ): { reconciled: boolean; divergence: number } {
    const serverPlayer = snapshot.players.find((p) => p.id === localPlayerId);
    if (!serverPlayer) {
      return { reconciled: false, divergence: 0 };
    }

    const lastAckSeq = snapshot.ackInputs[localPlayerId] ?? 0;
    // Descarta inputs que o servidor já processou e confirmou
    this.pendingInputs.splice(
      0,
      this.pendingInputs.findIndex((item) => item.seq > lastAckSeq) === -1 && this.pendingInputs.length > 0 && this.pendingInputs[this.pendingInputs.length - 1].seq <= lastAckSeq
        ? this.pendingInputs.length
        : Math.max(0, this.pendingInputs.findIndex((item) => item.seq > lastAckSeq)),
    );

    // Mede a discrepância entre a posição local e a do servidor
    const dx = this.heroTransform.x - serverPlayer.x;
    const dz = this.heroTransform.z - serverPlayer.z;
    const divergence = Math.hypot(dx, dz);

    if (divergence > divergenceThreshold) {
      // Ajusta posição e orientação para o estado autoritativo
      this.heroTransform.x = serverPlayer.x;
      this.heroTransform.y = serverPlayer.y;
      this.heroTransform.z = serverPlayer.z;
      this.heroTransform.rotationY = serverPlayer.rotationY;

      // Replay dos inputs locais pendentes (re-simulação determinística)
      for (const pending of this.pendingInputs) {
        updateMovementSystem(
          this.heroTransform,
          this.heroVelocity,
          this.heroController,
          pending.input,
          this.isDriving(),
          pending.dt,
          this.bounds,
        );
        pending.predictedPosition.x = this.heroTransform.x;
        pending.predictedPosition.y = this.heroTransform.y;
        pending.predictedPosition.z = this.heroTransform.z;
      }

      return { reconciled: true, divergence };
    }

    return { reconciled: false, divergence };
  }

  public getPendingInputsCount(): number {
    return this.pendingInputs.length;
  }

  public clearPendingInputs(): void {
    this.pendingInputs.length = 0;
  }

  // --- MÉTODOS DE ARSENAL & COMBATE LEGO ---

  /**
   * Retorna a arma atualmente equipada pelo jogador local.
   */
  public getEquippedWeapon(): WeaponType {
    return this.currentWeapon;
  }

  /**
   * Equipa uma arma do arsenal fictício ('stud_blaster' | 'scatter_shot' | 'spring_mine').
   */
  public setEquippedWeapon(weapon: WeaponType): boolean {
    if (!WEAPON_CATALOG[weapon]) {
      return false;
    }
    this.currentWeapon = weapon;
    return true;
  }

  /**
   * Retorna o tempo restante de cooldown da arma em milissegundos.
   */
  public getWeaponCooldownRemaining(weapon: WeaponType = this.currentWeapon): number {
    return this.weaponCooldowns[weapon] ?? 0;
  }

  /**
   * Retorna a fração normalizada (0 a 1) do cooldown da arma (0 = pronta, 1 = recém disparada).
   */
  public getWeaponCooldownRatio(weapon: WeaponType = this.currentWeapon): number {
    const config = WEAPON_CATALOG[weapon];
    if (!config || config.cooldownMs <= 0) return 0;
    return Math.min(1, Math.max(0, (this.weaponCooldowns[weapon] ?? 0) / config.cooldownMs));
  }

  /**
   * Checa se a arma equipada está pronta para disparar.
   */
  public canShootCurrentWeapon(): boolean {
    return (this.weaponCooldowns[this.currentWeapon] ?? 0) <= 0;
  }

  /**
   * Realiza o disparo da arma equipada, aplicando predição imediata local dos projéteis.
   */
  public shootCurrentWeapon(
    customOrigin?: Vector3D,
    customDirection?: Vector3D,
  ): {
    success: boolean;
    projectilesSpawned: number;
    weaponType: WeaponType;
    origin: Vector3D;
    direction: Vector3D;
  } {
    const weaponType = this.currentWeapon;
    const config = WEAPON_CATALOG[weaponType];

    if (!config || (this.weaponCooldowns[weaponType] ?? 0) > 0) {
      const defaultOrigin: Vector3D = {
        x: this.isDriving() ? this.vehicleTransform.x : this.heroTransform.x,
        y: this.isDriving() ? this.vehicleTransform.y + 0.6 : this.heroTransform.y + 0.8,
        z: this.isDriving() ? this.vehicleTransform.z : this.heroTransform.z,
      };
      const angle = this.isDriving() ? this.vehicleTransform.rotationY : this.heroTransform.rotationY;
      const defaultDir: Vector3D = { x: Math.sin(angle), y: 0, z: Math.cos(angle) };

      return {
        success: false,
        projectilesSpawned: 0,
        weaponType,
        origin: customOrigin ?? defaultOrigin,
        direction: customDirection ?? defaultDir,
      };
    }

    // Calcula ponto de emissão e vetor direcional padrão com base no estado do herói/veículo
    const angle = this.isDriving() ? this.vehicleTransform.rotationY : this.heroTransform.rotationY;
    const defaultOrigin: Vector3D = {
      x: this.isDriving() ? this.vehicleTransform.x : this.heroTransform.x,
      y: this.isDriving() ? this.vehicleTransform.y + 0.6 : this.heroTransform.y + 0.8,
      z: this.isDriving() ? this.vehicleTransform.z : this.heroTransform.z,
    };
    const defaultDir: Vector3D = {
      x: Math.sin(angle),
      y: 0,
      z: Math.cos(angle),
    };

    const origin = customOrigin ?? defaultOrigin;
    const direction = customDirection ?? defaultDir;

    // Aplica o cooldown
    this.weaponCooldowns[weaponType] = config.cooldownMs;

    // Ejeta os projéteis no pool local (predição imediata)
    const spawned = spawnProjectiles(
      weaponType,
      'hero_local',
      origin,
      direction,
      this.projectilePool,
      this.activeProjectiles,
    );

    return {
      success: true,
      projectilesSpawned: spawned,
      weaponType,
      origin,
      direction,
    };
  }

  /**
   * Consome e limpa a lista de eventos de dano recentes detectados pela simulação.
   */
  public flushRecentDamageEvents(): LocalDamageEvent[] {
    const events = [...this.recentDamageEvents];
    this.recentDamageEvents.length = 0;
    return events;
  }
}
