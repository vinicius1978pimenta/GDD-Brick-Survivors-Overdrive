import {
  ArenaBounds,
  DEFAULT_ARENA_BOUNDS,
  InputState,
  TransformComponent,
  VehicleComponent,
  VelocityComponent,
} from './types';

/**
 * Sistema de Física Veicular Arcade com Aceleração, Marcha Ré, Frenagem e Drift de Blocos.
 */
export function updateVehicleSystem(
  transform: TransformComponent,
  velocity: VelocityComponent,
  vehicle: VehicleComponent,
  input: InputState,
  dt: number,
  bounds: ArenaBounds = DEFAULT_ARENA_BOUNDS,
): void {
  if (vehicle.isDestroyed) {
    vehicle.currentSpeed = 0;
    vehicle.isDrifting = false;
    vehicle.driftVelocityX = 0;
    vehicle.driftVelocityZ = 0;
    velocity.vx = 0;
    velocity.vy = 0;
    velocity.vz = 0;
    return;
  }

  const hasDriver = vehicle.driverEntityId !== null;

  if (hasDriver) {
    // 1. Aceleração / Frenagem / Marcha Ré
    if (input.forward) {
      if (vehicle.currentSpeed < -0.5) {
        // Freando a marcha ré
        vehicle.currentSpeed += vehicle.brakeForce * dt;
      } else {
        // Acelerando para frente
        vehicle.currentSpeed = Math.min(
          vehicle.maxSpeed,
          vehicle.currentSpeed + vehicle.acceleration * dt,
        );
      }
    } else if (input.backward) {
      if (vehicle.currentSpeed > 0.5) {
        // Freio ativo para frente
        vehicle.currentSpeed = Math.max(0, vehicle.currentSpeed - vehicle.brakeForce * dt);
      } else {
        // Marcha ré progressiva
        vehicle.currentSpeed = Math.max(
          vehicle.reverseMaxSpeed,
          vehicle.currentSpeed - vehicle.acceleration * 0.75 * dt,
        );
      }
    } else {
      // Desaceleração passiva por atrito
      if (vehicle.currentSpeed > 0) {
        vehicle.currentSpeed = Math.max(0, vehicle.currentSpeed - vehicle.friction * dt);
      } else if (vehicle.currentSpeed < 0) {
        vehicle.currentSpeed = Math.min(0, vehicle.currentSpeed + vehicle.friction * dt);
      }
    }

    // 2. Freio de mão (Handbrake / Drift)
    const isMovingFastEnough = Math.abs(vehicle.currentSpeed) > 3.0;
    vehicle.isDrifting = Boolean(input.handbrake && isMovingFastEnough);

    // Se estiver no freio de mão sem aceleração, desacelera suavemente
    if (input.handbrake && !input.forward) {
      vehicle.currentSpeed *= Math.max(0, 1 - 1.2 * dt);
    }

    // 3. Esterçamento / Rotação Angular proporcional à velocidade
    const absSpeed = Math.abs(vehicle.currentSpeed);
    const speedRatio = Math.min(1, absSpeed / 4.0);

    let effectiveTurnSpeed = vehicle.turnSpeed * speedRatio;
    if (vehicle.isDrifting) {
      effectiveTurnSpeed *= 1.5; // Curvas mais rápidas em drift
    }

    // Inversão de direção intuitiva durante marcha ré
    const directionSign = vehicle.currentSpeed >= 0 ? 1 : -1;

    let steerInput = 0;
    if (input.left) steerInput += 1;
    if (input.right) steerInput -= 1;

    if (steerInput !== 0 && absSpeed > 0.1) {
      transform.rotationY += steerInput * directionSign * effectiveTurnSpeed * dt;

      // Se estiver em drift com esterçamento, transfere momento lateral
      if (vehicle.isDrifting) {
        const driftSign = -steerInput; // Derrapagem para fora da curva
        const lateralX = Math.cos(transform.rotationY) * driftSign;
        const lateralZ = -Math.sin(transform.rotationY) * driftSign;
        const slipForce = absSpeed * 0.85;

        vehicle.driftVelocityX += lateralX * slipForce * dt * 4.0;
        vehicle.driftVelocityZ += lateralZ * slipForce * dt * 4.0;
      }
    }
  } else {
    // Veículo sem motorista: desacelera até o repouso absoluto
    vehicle.isDrifting = false;
    if (vehicle.currentSpeed > 0) {
      vehicle.currentSpeed = Math.max(0, vehicle.currentSpeed - vehicle.friction * 1.5 * dt);
    } else if (vehicle.currentSpeed < 0) {
      vehicle.currentSpeed = Math.min(0, vehicle.currentSpeed + vehicle.friction * 1.5 * dt);
    }
  }

  // 4. Amortecimento do vetor de derrapagem (Drift Decay)
  const driftDamping = vehicle.isDrifting ? Math.pow(0.88, dt * 60) : Math.pow(0.65, dt * 60);
  vehicle.driftVelocityX *= driftDamping;
  vehicle.driftVelocityZ *= driftDamping;

  // Vetor frontal do veículo (0 rad = +Z, PI/2 = +X)
  const forwardX = Math.sin(transform.rotationY);
  const forwardZ = Math.cos(transform.rotationY);

  velocity.vx = forwardX * vehicle.currentSpeed + vehicle.driftVelocityX;
  velocity.vz = forwardZ * vehicle.currentSpeed + vehicle.driftVelocityZ;

  // 5. Integração da posição no plano XZ
  transform.x += velocity.vx * dt;
  transform.z += velocity.vz * dt;

  // 6. Colisão com muretas da arena com impacto elástico arcade
  const bounceFactor = -0.35;

  if (transform.x < bounds.minX) {
    transform.x = bounds.minX;
    vehicle.currentSpeed *= bounceFactor;
    vehicle.driftVelocityX = 0;
  } else if (transform.x > bounds.maxX) {
    transform.x = bounds.maxX;
    vehicle.currentSpeed *= bounceFactor;
    vehicle.driftVelocityX = 0;
  }

  if (transform.z < bounds.minZ) {
    transform.z = bounds.minZ;
    vehicle.currentSpeed *= bounceFactor;
    vehicle.driftVelocityZ = 0;
  } else if (transform.z > bounds.maxZ) {
    transform.z = bounds.maxZ;
    vehicle.currentSpeed *= bounceFactor;
    vehicle.driftVelocityZ = 0;
  }
}
