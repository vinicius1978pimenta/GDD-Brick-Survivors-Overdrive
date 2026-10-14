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

  it('deve recuar de ré (-Z) mantendo orientação frontal com input backward', () => {
    input.backward = true;
    updateMovementSystem(transform, velocity, controller, input, false, 0.1);

    expect(controller.speed).toBeLessThan(0);
    expect(controller.isMoving).toBe(true);
    expect(transform.z).toBeLessThan(0); // Recuou para trás (-Z)
  });

  it('deve rotacionar para a esquerda (A) e direita (D) estilo condução', () => {
    // Rotação para a esquerda (A)
    input.left = true;
    updateMovementSystem(transform, velocity, controller, input, false, 0.1);
    expect(transform.rotationY).toBeGreaterThan(0);

    // Rotação para a direita (D)
    input.left = false;
    input.right = true;
    transform.rotationY = 0;
    updateMovementSystem(transform, velocity, controller, input, false, 0.1);
    expect(transform.rotationY).toBeLessThan(0);
  });

  it('deve permitir girar o corpo no próprio eixo mesmo estando parado', () => {
    controller.speed = 0;
    input.left = true;

    updateMovementSystem(transform, velocity, controller, input, false, 0.1);

    expect(transform.rotationY).toBeGreaterThan(0);
    expect(controller.isMoving).toBe(true);
    expect(transform.x).toBe(0);
    expect(transform.z).toBe(0);
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
    input.forward = true;

    updateMovementSystem(transform, velocity, controller, input, false, 0.1, DEFAULT_ARENA_BOUNDS);

    expect(transform.x).toBe(DEFAULT_ARENA_BOUNDS.maxX);
    expect(transform.z).toBe(DEFAULT_ARENA_BOUNDS.minZ);
  });

  it('deve normalizar corretamente a menor diferença angular', () => {
    expect(normalizeAngleDifference(Math.PI, -Math.PI)).toBeCloseTo(0);
    expect(normalizeAngleDifference(Math.PI * 0.5, 0)).toBeCloseTo(Math.PI * 0.5);
  });

  describe('Física Vertical & Pulo (Jump)', () => {
    it('deve aplicar impulso vertical no eixo Y com input jump estando no solo', () => {
      controller.jumpForce = 7.2;
      controller.gravity = 18.0;
      controller.isGrounded = true;
      transform.y = 0;
      input.jump = true;

      updateMovementSystem(transform, velocity, controller, input, false, 0.05);

      expect(controller.isGrounded).toBe(false);
      expect(transform.y).toBeGreaterThan(0);
    });

    it('deve aplicar gravidade contínua quando o herói estiver no ar e aterrissar em y = 0', () => {
      controller.gravity = 18.0;
      transform.y = 1.0;
      velocity.vy = 0;
      controller.isGrounded = false;

      // Primeiro passo no ar
      updateMovementSystem(transform, velocity, controller, input, false, 0.1);
      expect(velocity.vy).toBeLessThan(0); // Puxado para baixo pela gravidade

      // Avança mais passos até tocar o chão
      for (let i = 0; i < 10; i++) {
        updateMovementSystem(transform, velocity, controller, input, false, 0.1);
      }

      expect(transform.y).toBe(0);
      expect(velocity.vy).toBe(0);
      expect(controller.isGrounded).toBe(true);
    });

    it('não deve permitir pulo duplo no ar quando já estiver sem contato com o solo', () => {
      controller.jumpForce = 7.2;
      controller.gravity = 18.0;
      transform.y = 1.5;
      velocity.vy = 1.0;
      controller.isGrounded = false;
      input.jump = true;

      updateMovementSystem(transform, velocity, controller, input, false, 0.05);

      // velocity.vy deve diminuir devido à gravidade e não resetar para jumpForce
      expect(velocity.vy).toBeLessThan(1.0);
      expect(controller.isGrounded).toBe(false);
    });

    it('deve zerar velocidade vertical e travar y em 0 quando estiver pilotando (isDriving = true)', () => {
      transform.y = 1.5;
      velocity.vy = 4.0;
      controller.isGrounded = false;
      input.jump = true;

      updateMovementSystem(transform, velocity, controller, input, true, 0.1);

      expect(transform.y).toBe(0);
      expect(velocity.vy).toBe(0);
      expect(controller.isGrounded).toBe(true);
    });
  });
});
