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
 * Acelera suavemente na direção do input, rotaciona para a direção da marcha e aplica limites da arena.
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
    return;
  }

  let inputX = 0;
  let inputZ = 0;

  if (input.left) inputX -= 1;
  if (input.right) inputX += 1;
  if (input.forward) inputZ += 1;
  if (input.backward) inputZ -= 1;

  const hasInput = inputX !== 0 || inputZ !== 0;

  if (hasInput) {
    // Normalização do vetor de entrada
    const length = Math.hypot(inputX, inputZ);
    const normX = inputX / length;
    const normZ = inputZ / length;

    // Aceleração progressiva até a velocidade máxima
    controller.speed = Math.min(
      controller.maxSpeed,
      controller.speed + controller.acceleration * dt,
    );
    controller.isMoving = true;

    // Ângulo desejado em relação ao plano XZ (0 rad = olhando para +Z, PI/2 = +X, etc.)
    const targetAngle = Math.atan2(normX, normZ);
    controller.moveAngle = targetAngle;

    // Rotação suave do personagem em direção à marcha
    const angleDiff = normalizeAngleDifference(targetAngle, transform.rotationY);
    const turnRate = 14 * dt;
    if (Math.abs(angleDiff) <= turnRate) {
      transform.rotationY = targetAngle;
    } else {
      transform.rotationY += Math.sign(angleDiff) * turnRate;
    }

    velocity.vx = Math.sin(transform.rotationY) * controller.speed;
    velocity.vz = Math.cos(transform.rotationY) * controller.speed;
  } else {
    // Desaceleração suave por atrito quando sem entrada
    controller.speed = Math.max(0, controller.speed - controller.deceleration * dt);
    controller.isMoving = controller.speed > 0.05;

    velocity.vx = Math.sin(transform.rotationY) * controller.speed;
    velocity.vz = Math.cos(transform.rotationY) * controller.speed;
  }

  // Atualização da posição física
  transform.x += velocity.vx * dt;
  transform.z += velocity.vz * dt;

  // Restrição aos limites da arena
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
