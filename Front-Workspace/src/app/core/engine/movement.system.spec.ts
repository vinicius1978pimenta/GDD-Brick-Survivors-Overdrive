import {
  CharacterControllerComponent,
  DEFAULT_ARENA_BOUNDS,
  InputState,
  TransformComponent,
  VelocityComponent,
} from './types';
import { normalizeAngleDifference, updateMovementSystem } from './movement.system';

describe('MovementSystem', () => {
  let transform: TransformComponent;
  let velocity: VelocityComponent;
  let controller: CharacterControllerComponent;
  let input: InputState;

  beforeEach(() => {
    transform = { x: 0, y: 0, z: 0, rotationY: 0 };
    velocity = { vx: 0, vy: 0, vz: 0, angularVelocityY: 0 };
    controller = {
      speed: 0,
      maxSpeed: 8.0,
      acceleration: 20.0,
      deceleration: 25.0,
      isMoving: false,
      moveAngle: 0,
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

  it('deve acelerar e deslocar o personagem na direção para frente (+Z) com input forward', () => {
    input.forward = true;
    updateMovementSystem(transform, velocity, controller, input, false, 0.1);

    expect(controller.speed).toBeGreaterThan(0);
    expect(controller.isMoving).toBe(true);
    expect(transform.z).toBeGreaterThan(0); // Movimentou-se para a frente (+Z)
  });

  it('deve rotacionar suavemente o herói em direção ao vetor de entrada', () => {
    input.right = true; // Direção para +X
    const initialRot = transform.rotationY;

    updateMovementSystem(transform, velocity, controller, input, false, 0.1);

    expect(transform.rotationY).not.toBe(initialRot);
    expect(controller.moveAngle).toBeCloseTo(Math.PI / 2, 2);
  });

  it('deve desacelerar o personagem gradualmente quando o input for liberado', () => {
    controller.speed = 6.0;
    controller.isMoving = true;

    updateMovementSystem(transform, velocity, controller, input, false, 0.1);

    expect(controller.speed).toBeLessThan(6.0);
    expect(controller.speed).toBeGreaterThanOrEqual(0);
  });

  it('não deve mover a pé quando o personagem estiver dirigindo (isDriving = true)', () => {
    input.forward = true;
    updateMovementSystem(transform, velocity, controller, input, true, 0.1);

    expect(controller.speed).toBe(0);
    expect(controller.isMoving).toBe(false);
    expect(velocity.vx).toBe(0);
    expect(velocity.vz).toBe(0);
    expect(transform.z).toBe(0);
  });

  it('deve restringir rigorosamente as coordenadas dentro dos limites da arena (-19 a 19)', () => {
    transform.x = 25.0; // Posição fora da arena
    transform.z = -30.0;
    input.right = true;

    updateMovementSystem(transform, velocity, controller, input, false, 0.1, DEFAULT_ARENA_BOUNDS);

    expect(transform.x).toBe(DEFAULT_ARENA_BOUNDS.maxX);
    expect(transform.z).toBe(DEFAULT_ARENA_BOUNDS.minZ);
  });

  it('deve normalizar corretamente a menor diferença angular', () => {
    expect(normalizeAngleDifference(Math.PI, -Math.PI)).toBeCloseTo(0);
    expect(normalizeAngleDifference(Math.PI * 0.5, 0)).toBeCloseTo(Math.PI * 0.5);
  });
});
