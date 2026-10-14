import { GameLoop } from './game-loop';
import { updateInteractionSystem, canInteractWithVehicle } from './interaction.system';
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

  // Estado de Entrada (Inputs)
  public readonly inputState: InputState = {
    forward: false,
    backward: false,
    left: false,
    right: false,
    handbrake: false,
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

    // 3. Sistema de Física Veicular
    updateVehicleSystem(
      this.vehicleTransform,
      this.vehicleVelocity,
      this.vehicleComponent,
      this.inputState,
      dt,
      this.bounds,
    );

    // 4. Se estiver dirigindo, acopla o herói ao assento do veículo
    if (isDriving) {
      this.heroTransform.x = this.vehicleTransform.x;
      this.heroTransform.y = this.vehicleTransform.y + 0.35;
      this.heroTransform.z = this.vehicleTransform.z;
      this.heroTransform.rotationY = this.vehicleTransform.rotationY;
    }
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

  public canInteract(): boolean {
    return canInteractWithVehicle(this.heroTransform, this.vehicleTransform);
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
}
