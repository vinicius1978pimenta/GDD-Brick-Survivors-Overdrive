import {
  ArenaBounds,
  DEFAULT_ARENA_BOUNDS,
  InputState,
  TransformComponent,
  VEHICLE_INTERACTION_RADIUS,
  VehicleComponent,
  VelocityComponent,
} from './types';

/**
 * Calcula a distância euclidiana no plano horizontal (XZ).
 */
export function getDistance2D(a: TransformComponent, b: TransformComponent): number {
  return Math.hypot(a.x - b.x, a.z - b.z);
}

/**
 * Verifica se o herói está suficientemente próximo do veículo para interagir.
 */
export function canInteractWithVehicle(
  heroTransform: TransformComponent,
  vehicleTransform: TransformComponent,
  maxDistance: number = VEHICLE_INTERACTION_RADIUS,
  isDestroyed: boolean = false,
): boolean {
  if (isDestroyed) {
    return false;
  }
  return getDistance2D(heroTransform, vehicleTransform) <= maxDistance;
}

/**
 * Sistema de Interação: Embarque e Desembarque de Veículos de Blocos.
 */
export function updateInteractionSystem(
  heroTransform: TransformComponent,
  heroVelocity: VelocityComponent,
  vehicleTransform: TransformComponent,
  vehicle: VehicleComponent,
  input: InputState,
  heroEntityId: number = 1,
  bounds: ArenaBounds = DEFAULT_ARENA_BOUNDS,
): { interacted: boolean; isNowDriving: boolean } {
  const isCurrentlyDriving = vehicle.driverEntityId === heroEntityId;

  if (!input.interact) {
    return { interacted: false, isNowDriving: isCurrentlyDriving };
  }

  // Consome a entrada de interação para evitar múltiplos disparos no mesmo aperto de tecla
  input.interact = false;

  if (isCurrentlyDriving) {
    // Desembarque: posiciona o herói ao lado esquerdo do veículo
    vehicle.driverEntityId = null;

    const exitDistance = 1.6;
    const exitAngle = vehicleTransform.rotationY;
    // Vetor lateral esquerdo do veículo
    heroTransform.x = vehicleTransform.x - Math.cos(exitAngle) * exitDistance;
    heroTransform.z = vehicleTransform.z + Math.sin(exitAngle) * exitDistance;
    heroTransform.y = 0;
    heroTransform.rotationY = exitAngle;

    // Respeita os limites da arena
    heroTransform.x = Math.max(bounds.minX, Math.min(bounds.maxX, heroTransform.x));
    heroTransform.z = Math.max(bounds.minZ, Math.min(bounds.maxZ, heroTransform.z));

    heroVelocity.vx = 0;
    heroVelocity.vy = 0;
    heroVelocity.vz = 0;

    return { interacted: true, isNowDriving: false };
  }

  // Se não estiver dirigindo, valida se o veículo não está destruído e a distância para embarque
  if (
    !vehicle.isDestroyed &&
    vehicle.driverEntityId === null &&
    canInteractWithVehicle(heroTransform, vehicleTransform, VEHICLE_INTERACTION_RADIUS, vehicle.isDestroyed)
  ) {
    vehicle.driverEntityId = heroEntityId;

    // Sincroniza a posição inicial do herói no assento do piloto
    heroTransform.x = vehicleTransform.x;
    heroTransform.y = vehicleTransform.y;
    heroTransform.z = vehicleTransform.z;
    heroTransform.rotationY = vehicleTransform.rotationY;

    heroVelocity.vx = 0;
    heroVelocity.vy = 0;
    heroVelocity.vz = 0;

    return { interacted: true, isNowDriving: true };
  }

  return { interacted: false, isNowDriving: false };
}
