import {
  InputState,
  TransformComponent,
  VEHICLE_INTERACTION_RADIUS,
  VehicleComponent,
  VelocityComponent,
} from './types';
import {
  canDismountVehicle,
  canInteractWithVehicle,
  getDistance2D,
  MAX_DISMOUNT_SPEED,
  updateInteractionSystem,
} from './interaction.system';

describe('InteractionSystem (Mount / Dismount)', () => {
  let heroTransform: TransformComponent;
  let heroVelocity: VelocityComponent;
  let vehicleTransform: TransformComponent;
  let vehicle: VehicleComponent;
  let input: InputState;

  beforeEach(() => {
    heroTransform = { x: 0, y: 0, z: 0, rotationY: 0 };
    heroVelocity = { vx: 0, vy: 0, vz: 0, angularVelocityY: 0 };
    vehicleTransform = { x: 2.0, y: 0, z: 0, rotationY: 0 };
    vehicle = {
      currentSpeed: 0,
      maxSpeed: 20.0,
      reverseMaxSpeed: -6.0,
      acceleration: 15.0,
      brakeForce: 25.0,
      friction: 5.0,
      turnSpeed: 2.5,
      isDrifting: false,
      driverEntityId: null,
      driftVelocityX: 0,
      driftVelocityZ: 0,
    };
    input = {
      forward: false,
      backward: false,
      left: false,
      right: false,
      handbrake: false,
      interact: false,
    };
  });

  it('deve calcular a distância 2D e identificar proximidade de interação válida (<= 2.8m)', () => {
    expect(getDistance2D(heroTransform, vehicleTransform)).toBe(2.0);
    expect(canInteractWithVehicle(heroTransform, vehicleTransform)).toBe(true);

    vehicleTransform.x = 5.0; // Distância maior que 2.8m
    expect(canInteractWithVehicle(heroTransform, vehicleTransform)).toBe(false);
  });

  it('deve realizar o embarque no veículo quando estiver dentro do raio de interação e interact for acionado', () => {
    input.interact = true;
    const result = updateInteractionSystem(
      heroTransform,
      heroVelocity,
      vehicleTransform,
      vehicle,
      input,
      1,
    );

    expect(result.interacted).toBe(true);
    expect(result.isNowDriving).toBe(true);
    expect(vehicle.driverEntityId).toBe(1);
    expect(heroTransform.x).toBe(vehicleTransform.x);
    expect(input.interact).toBe(false); // Entrada consumida
  });

  it('não deve permitir embarque se o herói estiver fora do raio de interação (> 2.8m)', () => {
    vehicleTransform.x = VEHICLE_INTERACTION_RADIUS + 1.0;
    input.interact = true;

    const result = updateInteractionSystem(
      heroTransform,
      heroVelocity,
      vehicleTransform,
      vehicle,
      input,
      1,
    );

    expect(result.interacted).toBe(false);
    expect(result.isNowDriving).toBe(false);
    expect(vehicle.driverEntityId).toBeNull();
  });

  it('deve realizar o desembarque do veículo ao lado esquerdo quando estiver pilotando e interact for acionado', () => {
    vehicle.driverEntityId = 1; // Já está pilotando
    input.interact = true;

    const result = updateInteractionSystem(
      heroTransform,
      heroVelocity,
      vehicleTransform,
      vehicle,
      input,
      1,
    );

    expect(result.interacted).toBe(true);
    expect(result.isNowDriving).toBe(false);
    expect(vehicle.driverEntityId).toBeNull();
    // Herói posicionado ao lado esquerdo do veículo (com offset)
    expect(heroTransform.x).not.toBe(vehicleTransform.x);
    expect(heroVelocity.vx).toBe(0);
  });

  it('não deve permitir embarque se o veículo estiver destruído', () => {
    vehicle.isDestroyed = true;
    input.interact = true;

    const result = updateInteractionSystem(
      heroTransform,
      heroVelocity,
      vehicleTransform,
      vehicle,
      input,
      1,
    );

    expect(result.interacted).toBe(false);
    expect(result.isNowDriving).toBe(false);
    expect(vehicle.driverEntityId).toBeNull();
  });

  it('deve permitir o desembarque do veículo mesmo em movimento ao pressionar [E]', () => {
    vehicle.driverEntityId = 1;
    vehicle.currentSpeed = 12.0; // Em alta velocidade
    input.interact = true;

    const result = updateInteractionSystem(
      heroTransform,
      heroVelocity,
      vehicleTransform,
      vehicle,
      input,
      1,
    );

    // Desembarque em movimento permitido com sucesso
    expect(result.interacted).toBe(true);
    expect(result.isNowDriving).toBe(false);
    expect(vehicle.driverEntityId).toBeNull();
    expect(heroTransform.x).not.toBe(vehicleTransform.x);
  });

  it('deve calcular canDismountVehicle com segurança apenas quando parado (velocidade <= MAX_DISMOUNT_SPEED)', () => {
    vehicle.driverEntityId = 1;
    vehicle.currentSpeed = 5.0; // Em movimento
    expect(canDismountVehicle(vehicle)).toBe(false);

    vehicle.currentSpeed = 0.3; // Parado
    expect(canDismountVehicle(vehicle)).toBe(true);
  });
});
