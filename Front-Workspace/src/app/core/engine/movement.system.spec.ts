import {
  CharacterControllerComponent,
  DEFAULT_ARENA_BOUNDS,
  InputState,
  TransformComponent,
  VelocityComponent,
} from './types';
import {
  normalizeAngleDifference,
  resolvePedestrianVehicleCollision,
  updateMovementSystem,
} from './movement.system';

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

  it('deve recuar de ré (-Z) mantendo velocidade positiva e vetor direcional negativo com input backward', () => {
    input.backward = true;
    updateMovementSystem(transform, velocity, controller, input, false, 0.1);

    expect(controller.speed).toBeGreaterThan(0);
    expect(controller.isMoving).toBe(true);
    expect(velocity.vz).toBeLessThan(0);
    expect(transform.z).toBeLessThan(0); // Recuou para trás (-Z)
  });

  it('deve realizar strafe lateral para a direita da tela (-X) com D e para a esquerda da tela (+X) com A quando virado para frente', () => {
    // Strafe para a direita da tela (D) com mouse/mira para frente da arena (rotationY = 0)
    transform.rotationY = 0;
    input.right = true;
    updateMovementSystem(transform, velocity, controller, input, false, 0.1);
    expect(controller.isMoving).toBe(true);
    expect(controller.speed).toBeGreaterThan(0);
    expect(velocity.vx).toBeLessThan(0);
    expect(transform.x).toBeLessThan(0);
    expect(transform.z).toBe(0);

    // Reseta estado para strafe para a esquerda da tela (A)
    transform.x = 0;
    transform.z = 0;
    transform.rotationY = 0;
    velocity.vx = 0;
    velocity.vz = 0;
    controller.speed = 0;
    input.right = false;
    input.left = true;

    updateMovementSystem(transform, velocity, controller, input, false, 0.1);
    expect(controller.isMoving).toBe(true);
    expect(controller.speed).toBeGreaterThan(0);
    expect(velocity.vx).toBeGreaterThan(0);
    expect(transform.x).toBeGreaterThan(0);
    expect(transform.z).toBe(0);
  });

  it('deve normalizar o vetor de movimentação na diagonal (forward + right) sem exceder a velocidade máxima', () => {
    transform.rotationY = 0;
    input.forward = true;
    input.right = true;

    updateMovementSystem(transform, velocity, controller, input, false, 0.1);

    expect(controller.isMoving).toBe(true);
    expect(transform.x).toBeLessThan(0);
    expect(transform.z).toBeGreaterThan(0);

    // A magnitude da velocidade calculada no plano XZ deve ser exatamente controller.speed
    const speedMagnitude = Math.hypot(velocity.vx, velocity.vz);
    expect(speedMagnitude).toBeCloseTo(controller.speed, 4);
    expect(speedMagnitude).toBeLessThanOrEqual(controller.maxSpeed);
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

  describe('resolvePedestrianVehicleCollision (Física Sólida Carro vs Pedestre)', () => {
    let heroTransform: TransformComponent;
    let heroVelocity: VelocityComponent;
    let vehicleTransform: TransformComponent;

    beforeEach(() => {
      heroTransform = { x: 0, y: 0, z: 0, rotationY: 0 };
      heroVelocity = { vx: 0, vy: 0, vz: 0, angularVelocityY: 0 };
      vehicleTransform = { x: 5, y: 0, z: 5, rotationY: 0 };
    });

    it('não deve colidir nem alterar posição quando o pedestre estiver distante do veículo', () => {
      heroTransform.x = 0;
      heroTransform.z = 0;
      const collided = resolvePedestrianVehicleCollision(
        heroTransform,
        heroVelocity,
        vehicleTransform
      );

      expect(collided).toBe(false);
      expect(heroTransform.x).toBe(0);
      expect(heroTransform.z).toBe(0);
    });

    it('deve repelir o pedestre para fora pela lateral (+X) quando penetrar pela direita do veículo', () => {
      // Veículo em (0, 0, 0) sem rotação. Metade da largura = 1.0, raio = 0.55 => limite lateral = 1.55
      vehicleTransform.x = 0;
      vehicleTransform.z = 0;
      heroTransform.x = 1.2; // Penetração de 0.35 no eixo X
      heroTransform.z = 0;
      heroVelocity.vx = -2.0;

      const collided = resolvePedestrianVehicleCollision(
        heroTransform,
        heroVelocity,
        vehicleTransform,
        0.55,
        1.0,
        1.6
      );

      expect(collided).toBe(true);
      // Deve ter sido empurrado para além de 1.55 no eixo X
      expect(heroTransform.x).toBeGreaterThanOrEqual(1.55);
      // Velocidade apontando para o veículo deve ser amortecida
      expect(heroVelocity.vx).toBeGreaterThanOrEqual(0);
    });

    it('deve repelir o pedestre pela frente (+Z) quando penetrar pelo capô do veículo', () => {
      vehicleTransform.x = 0;
      vehicleTransform.z = 0;
      heroTransform.x = 0;
      heroTransform.z = 1.8; // Metade do comprimento = 1.6 + raio 0.55 = 2.15 limite. 1.8 está dentro!
      heroVelocity.vz = -3.0;

      const collided = resolvePedestrianVehicleCollision(
        heroTransform,
        heroVelocity,
        vehicleTransform,
        0.55,
        1.0,
        1.6
      );

      expect(collided).toBe(true);
      expect(heroTransform.z).toBeGreaterThanOrEqual(2.15);
      expect(heroVelocity.vz).toBeGreaterThanOrEqual(0);
    });

    it('deve funcionar corretamente com o veículo rotacionado em 90 graus (OBB transform)', () => {
      vehicleTransform.x = 0;
      vehicleTransform.z = 0;
      vehicleTransform.rotationY = Math.PI * 0.5; // Girado 90 graus no sentido anti-horário
      // O eixo longitudinal do veículo agora está alinhado com o eixo X mundial
      heroTransform.x = 1.8; // Dentro do comprimento no eixo X
      heroTransform.z = 0;

      const collided = resolvePedestrianVehicleCollision(
        heroTransform,
        heroVelocity,
        vehicleTransform,
        0.55,
        1.0,
        1.6
      );

      expect(collided).toBe(true);
      // Deve empurrar para fora
      const dist = Math.hypot(heroTransform.x, heroTransform.z);
      expect(dist).toBeGreaterThanOrEqual(2.15);
    });
  });
});

