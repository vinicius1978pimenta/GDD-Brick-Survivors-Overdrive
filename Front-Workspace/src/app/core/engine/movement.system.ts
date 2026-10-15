import {
  ArenaBounds,
  CharacterControllerComponent,
  DEFAULT_ARENA_BOUNDS,
  InputState,
  TransformComponent,
  VelocityComponent,
} from './types';

/**
 * Normaliza uma diferença angular para o menor caminho no intervalo [-PI, PI].
 */
export function normalizeAngleDifference(target: number, current: number): number {
  let diff = (target - current) % (Math.PI * 2);
  if (diff > Math.PI) {
    diff -= Math.PI * 2;
  } else if (diff < -Math.PI) {
    diff += Math.PI * 2;
  }
  return diff;
}

/**
 * Sistema de Movimentação do Personagem Pedestre.
 * Controle arcade alinhado à orientação da câmera e veículo:
 * - W: avança na direção em que o personagem está olhando
 * - S: recua / marcha ré mantendo o enquadramento
 * - A: gira o corpo para a esquerda
 * - D: gira o corpo para a direita
 */
export function updateMovementSystem(
  transform: TransformComponent,
  velocity: VelocityComponent,
  controller: CharacterControllerComponent,
  input: InputState,
  isDriving: boolean,
  dt: number,
  bounds: ArenaBounds = DEFAULT_ARENA_BOUNDS,
): void {
  // Quando o herói está dentro do veículo, o controle a pé é suspenso
  if (isDriving) {
    controller.isMoving = false;
    controller.speed = 0;
    velocity.vx = 0;
    velocity.vy = 0;
    velocity.vz = 0;
    transform.y = 0;
    controller.isGrounded = true;
    return;
  }

  // 1. Rotação / Esterçamento Angular do Personagem (A/D)
  const turnSpeed = controller.turnSpeed ?? 3.8;
  let steerInput = 0;
  if (input.left) steerInput += 1;
  if (input.right) steerInput -= 1;

  if (steerInput !== 0) {
    transform.rotationY += steerInput * turnSpeed * dt;
  }

  // 2. Aceleração / Frenagem / Recuo (W/S)
  const reverseMax = Math.abs(controller.reverseMaxSpeed ?? (controller.maxSpeed * 0.55));

  if (input.forward) {
    if (controller.speed < -0.5) {
      // Freia o recuo
      controller.speed += controller.deceleration * dt;
    } else {
      // Acelera para frente na direção frontal
      controller.speed = Math.min(
        controller.maxSpeed,
        controller.speed + controller.acceleration * dt,
      );
    }
  } else if (input.backward) {
    if (controller.speed > 0.5) {
      // Freia a marcha à frente
      controller.speed = Math.max(0, controller.speed - controller.deceleration * dt);
    } else {
      // Recua suavemente de ré
      controller.speed = Math.max(
        -reverseMax,
        controller.speed - controller.acceleration * 0.75 * dt,
      );
    }
  } else {
    // Desaceleração passiva por atrito
    if (controller.speed > 0) {
      controller.speed = Math.max(0, controller.speed - controller.deceleration * dt);
    } else if (controller.speed < 0) {
      controller.speed = Math.min(0, controller.speed + controller.deceleration * dt);
    }
  }

  controller.isMoving = Math.abs(controller.speed) > 0.05 || steerInput !== 0;
  controller.moveAngle = transform.rotationY;

  // 3. Vetor de velocidade baseado no ângulo atual
  velocity.vx = Math.sin(transform.rotationY) * controller.speed;
  velocity.vz = Math.cos(transform.rotationY) * controller.speed;

  // 4. Física Vertical no Eixo Y (Pulo e Gravidade)
  const jumpForce = controller.jumpForce ?? 7.2;
  const gravity = controller.gravity ?? 18.0;

  // Se estiver no chão
  if (transform.y <= 0) {
    transform.y = 0;
    if (velocity.vy <= 0) {
      velocity.vy = 0;
      controller.isGrounded = true;
    }

    if (input.jump && controller.isGrounded) {
      velocity.vy = jumpForce;
      controller.isGrounded = false;
      input.jump = false;
    }
  } else {
    // No ar: gravidade contínua
    controller.isGrounded = false;
    velocity.vy -= gravity * dt;
  }

  // Integração vertical
  transform.y += velocity.vy * dt;

  // Aterrissagem no solo
  if (transform.y <= 0) {
    transform.y = 0;
    velocity.vy = 0;
    controller.isGrounded = true;
  }

  // 5. Atualização da posição física horizontal (XZ)
  transform.x += velocity.vx * dt;
  transform.z += velocity.vz * dt;

  // 5. Restrição aos limites da arena
  if (transform.x < bounds.minX) {
    transform.x = bounds.minX;
    velocity.vx = 0;
  } else if (transform.x > bounds.maxX) {
    transform.x = bounds.maxX;
    velocity.vx = 0;
  }

  if (transform.z < bounds.minZ) {
    transform.z = bounds.minZ;
    velocity.vz = 0;
  } else if (transform.z > bounds.maxZ) {
    transform.z = bounds.maxZ;
    velocity.vz = 0;
  }
}

/**
 * Trata a colisão sólida e push-out entre pedestre e veículo.
 * Utiliza o retângulo orientado (OBB) do carro no plano XZ para impedir que
 * o pedestre atravesse a lataria e permitir deslizamento suave pelas bordas.
 */
export function resolvePedestrianVehicleCollision(
  heroTransform: TransformComponent,
  heroVelocity: VelocityComponent,
  vehicleTransform: TransformComponent,
  heroRadius = 0.45,
  vehicleHalfWidth = 1.15,
  vehicleHalfLength = 1.85,
): boolean {
  const dx = heroTransform.x - vehicleTransform.x;
  const dz = heroTransform.z - vehicleTransform.z;

  const cosAngle = Math.cos(-vehicleTransform.rotationY);
  const sinAngle = Math.sin(-vehicleTransform.rotationY);

  // Coordenadas no referencial local orientado do veículo
  const localX = dx * cosAngle - dz * sinAngle;
  const localZ = dx * sinAngle + dz * cosAngle;

  const thresholdX = vehicleHalfWidth + heroRadius;
  const thresholdZ = vehicleHalfLength + heroRadius;

  if (Math.abs(localX) < thresholdX && Math.abs(localZ) < thresholdZ) {
    const overlapX = thresholdX - Math.abs(localX);
    const overlapZ = thresholdZ - Math.abs(localZ);

    let resolvedLocalX = localX;
    let resolvedLocalZ = localZ;

    // Projeta velocidade no referencial local para permitir deslizamento tangencial
    let localVx = heroVelocity.vx * cosAngle - heroVelocity.vz * sinAngle;
    let localVz = heroVelocity.vx * sinAngle + heroVelocity.vz * cosAngle;

    if (overlapX < overlapZ) {
      resolvedLocalX += localX >= 0 ? overlapX : -overlapX;
      // Anula velocidade normal de penetração no eixo X local
      if (localX >= 0 && localVx < 0) {
        localVx = 0;
      } else if (localX < 0 && localVx > 0) {
        localVx = 0;
      }
      localVz *= 0.85; // Permite deslizar suavemente pelas laterais
    } else {
      resolvedLocalZ += localZ >= 0 ? overlapZ : -overlapZ;
      // Anula velocidade normal de penetração no eixo Z local
      if (localZ >= 0 && localVz < 0) {
        localVz = 0;
      } else if (localZ < 0 && localVz > 0) {
        localVz = 0;
      }
      localVx *= 0.85; // Permite deslizar suavemente pela dianteira/traseira
    }

    const worldCos = Math.cos(vehicleTransform.rotationY);
    const worldSin = Math.sin(vehicleTransform.rotationY);

    heroTransform.x = vehicleTransform.x + resolvedLocalX * worldCos - resolvedLocalZ * worldSin;
    heroTransform.z = vehicleTransform.z + resolvedLocalX * worldSin + resolvedLocalZ * worldCos;

    // Converte de volta para coordenadas globais
    heroVelocity.vx = localVx * worldCos - localVz * worldSin;
    heroVelocity.vz = localVx * worldSin + localVz * worldCos;

    return true;
  }

  return false;
}
