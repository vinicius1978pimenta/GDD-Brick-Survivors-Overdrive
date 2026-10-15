import {
  DEFAULT_ARENA_BOUNDS,
  InputState,
  TransformComponent,
  VehicleComponent,
  VelocityComponent,
} from './types';
import { updateVehicleSystem } from './vehicle.system';

describe('VehicleSystem (Arcade Physics & Drift)', () => {
  let transform: TransformComponent;
  let velocity: VelocityComponent;
  let vehicle: VehicleComponent;
  let input: InputState;

  beforeEach(() => {
    transform = { x: 0, y: 0, z: 0, rotationY: 0 };
    velocity = { vx: 0, vy: 0, vz: 0, angularVelocityY: 0 };
    vehicle = {
      currentSpeed: 0,
      maxSpeed: 20.0,
      reverseMaxSpeed: -6.0,
      acceleration: 15.0,
      brakeForce: 25.0,
      friction: 5.0,
      turnSpeed: 2.5,
      isDrifting: false,
      driverEntityId: 1, // Com motorista por padrão
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

  it('deve acelerar progressivamente para frente com input forward', () => {
    input.forward = true;
    updateVehicleSystem(transform, velocity, vehicle, input, 0.1);

    expect(vehicle.currentSpeed).toBeGreaterThan(0);
    expect(vehicle.currentSpeed).toBeLessThanOrEqual(vehicle.maxSpeed);
    expect(velocity.vz).toBeGreaterThan(0);
  });

  it('deve frear o veículo rapidamente quando em velocidade positiva e input backward', () => {
    vehicle.currentSpeed = 15.0;
    input.backward = true;

    updateVehicleSystem(transform, velocity, vehicle, input, 0.1);

    expect(vehicle.currentSpeed).toBeLessThan(15.0);
  });

  it('deve engatar e acelerar marcha ré quando parado com input backward', () => {
    vehicle.currentSpeed = 0;
    input.backward = true;

    updateVehicleSystem(transform, velocity, vehicle, input, 0.1);

    expect(vehicle.currentSpeed).toBeLessThan(0);
    expect(vehicle.currentSpeed).toBeGreaterThanOrEqual(vehicle.reverseMaxSpeed);
  });

  it('deve esterçar suavemente apenas quando houver velocidade e movimento', () => {
    // Parado
    vehicle.currentSpeed = 0;
    input.left = true;
    updateVehicleSystem(transform, velocity, vehicle, input, 0.1);
    expect(transform.rotationY).toBe(0); // Não esterça parado

    // Em movimento
    vehicle.currentSpeed = 10.0;
    updateVehicleSystem(transform, velocity, vehicle, input, 0.1);
    expect(transform.rotationY).toBeGreaterThan(0);
  });

  it('deve ativar o drift arcade e aumentar vetor lateral quando handbrake for acionado', () => {
    vehicle.currentSpeed = 12.0;
    input.handbrake = true;
    input.left = true;

    updateVehicleSystem(transform, velocity, vehicle, input, 0.1);

    expect(vehicle.isDrifting).toBe(true);
    expect(vehicle.driftVelocityX !== 0 || vehicle.driftVelocityZ !== 0).toBe(true);
  });

  it('deve desacelerar passivamente por atrito quando não houver motorista', () => {
    vehicle.driverEntityId = null;
    vehicle.currentSpeed = 8.0;
    input.forward = true; // Mesmo com input pressionado, sem motorista não acelera

    updateVehicleSystem(transform, velocity, vehicle, input, 0.1);

    expect(vehicle.currentSpeed).toBeLessThan(8.0);
    expect(vehicle.isDrifting).toBe(false);
  });

  it('deve colidir com os limites da arena e aplicar resposta elástica arcade', () => {
    transform.x = DEFAULT_ARENA_BOUNDS.maxX + 1;
    vehicle.currentSpeed = 10.0;

    updateVehicleSystem(transform, velocity, vehicle, input, 0.1, DEFAULT_ARENA_BOUNDS);

    expect(transform.x).toBe(DEFAULT_ARENA_BOUNDS.maxX);
    expect(vehicle.currentSpeed).toBeLessThan(0); // Ricochete com inversão de velocidade
  });

  it('deve congelar tração, velocidade e rotação quando o veículo estiver destruído', () => {
    vehicle.isDestroyed = true;
    vehicle.currentSpeed = 10.0;
    input.forward = true;
    input.left = true;

    updateVehicleSystem(transform, velocity, vehicle, input, 0.1);

    expect(vehicle.currentSpeed).toBe(0);
    expect(velocity.vx).toBe(0);
    expect(velocity.vz).toBe(0);
    expect(velocity.angularVelocityY).toBe(0);
  });
});
