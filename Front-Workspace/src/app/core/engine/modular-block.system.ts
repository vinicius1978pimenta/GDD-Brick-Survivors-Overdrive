import {
  ArenaBounds,
  DEFAULT_ARENA_BOUNDS,
  TransformComponent,
} from './types';
import {
  DebrisParticle,
  ModularBlock,
  ModularVehicleComponent,
} from './modular-block.types';
import { ObjectPool } from './object-pool';

/**
 * Cria a configuração padrão de blocos modulares destacados do Buggy Arcade de Blocos.
 */
export function createDefaultBuggyBlocks(): ModularBlock[] {
  return [
    {
      id: 'bumper_front',
      name: 'Para-choque Dianteiro Reforçado',
      socketId: 'socket_front',
      relativePos: { x: 0, y: 0.45, z: 1.7 },
      size: { w: 1.8, h: 0.35, d: 0.4 },
      blockType: 'bumper',
      maxHealth: 50,
      currentHealth: 50,
      isDetached: false,
      colorHex: 0xe52521, // Vermelho LEGO clássico
    },
    {
      id: 'hood_armor',
      name: 'Capô Blindado de Blocos',
      socketId: 'socket_hood',
      relativePos: { x: 0, y: 0.75, z: 0.85 },
      size: { w: 1.45, h: 0.35, d: 1.15 },
      blockType: 'armor',
      maxHealth: 60,
      currentHealth: 60,
      isDetached: false,
      colorHex: 0xfcd116, // Amarelo vibrante
    },
    {
      id: 'skirt_left',
      name: 'Blindagem Lateral Esquerda',
      socketId: 'socket_skirt_l',
      relativePos: { x: -0.92, y: 0.48, z: 0 },
      size: { w: 0.28, h: 0.38, d: 2.1 },
      blockType: 'armor',
      maxHealth: 45,
      currentHealth: 45,
      isDetached: false,
      colorHex: 0x1f2937, // Cinza escuro
    },
    {
      id: 'skirt_right',
      name: 'Blindagem Lateral Direita',
      socketId: 'socket_skirt_r',
      relativePos: { x: 0.92, y: 0.48, z: 0 },
      size: { w: 0.28, h: 0.38, d: 2.1 },
      blockType: 'armor',
      maxHealth: 45,
      currentHealth: 45,
      isDetached: false,
      colorHex: 0x1f2937,
    },
    {
      id: 'roof_cockpit',
      name: 'Teto Protetor Superior',
      socketId: 'socket_roof',
      relativePos: { x: 0, y: 1.82, z: -0.3 },
      size: { w: 1.45, h: 0.14, d: 1.25 },
      blockType: 'roof',
      maxHealth: 40,
      currentHealth: 40,
      isDetached: false,
      colorHex: 0x38bdf8, // Azul ciano luminoso
    },
    {
      id: 'wing_rear',
      name: 'Aerofólio Traseiro Overdrive',
      socketId: 'socket_wing',
      relativePos: { x: 0, y: 1.28, z: -1.45 },
      size: { w: 1.7, h: 0.18, d: 0.45 },
      blockType: 'wing',
      maxHealth: 35,
      currentHealth: 35,
      isDetached: false,
      colorHex: 0xe52521,
    },
    {
      id: 'bumper_rear',
      name: 'Para-choque Traseiro Anti-Impacto',
      socketId: 'socket_rear',
      relativePos: { x: 0, y: 0.45, z: -1.7 },
      size: { w: 1.8, h: 0.35, d: 0.4 },
      blockType: 'bumper',
      maxHealth: 50,
      currentHealth: 50,
      isDetached: false,
      colorHex: 0x111827,
    },
  ];
}

/**
 * Recalcula a porcentagem de integridade estrutural (durabilidade de 0 a 100%).
 */
export function calculateVehicleDurability(vehicle: ModularVehicleComponent): number {
  if (vehicle.blocks.length === 0) return 0;

  let totalMax = 0;
  let totalCurrent = 0;

  for (const block of vehicle.blocks) {
    totalMax += block.maxHealth;
    if (!block.isDetached) {
      totalCurrent += Math.max(0, block.currentHealth);
    }
  }

  if (totalMax === 0) return 0;
  return Math.round((totalCurrent / totalMax) * 100);
}

/**
 * Cria a fábrica de partículas de detritos físicos pré-alocados no ObjectPool.
 */
export function createDebrisFactory(): () => DebrisParticle {
  let nextId = 1;
  return () => ({
    id: nextId++,
    x: 0,
    y: 0,
    z: 0,
    vx: 0,
    vy: 0,
    vz: 0,
    rotX: 0,
    rotY: 0,
    rotZ: 0,
    vRotX: 0,
    vRotY: 0,
    size: { w: 0.5, h: 0.5, d: 0.5 },
    colorHex: 0xfcd116,
    life: 0,
    maxLife: 3.5,
    active: false,
    bounces: 0,
  });
}

/**
 * Aplica dano a um bloco modular. Se o dano zerar a integridade do bloco,
 * ele é desvinculado (descolado) e uma peça de detrito com impulsão balística é ejetada no pool.
 */
export function applyDamageToBlock(
  vehicle: ModularVehicleComponent,
  blockId: string,
  damage: number,
  vehicleTransform: TransformComponent,
  debrisPool: ObjectPool<DebrisParticle>,
  activeDebris: DebrisParticle[],
): boolean {
  const block = vehicle.blocks.find((b) => b.id === blockId);
  if (!block || block.isDetached) {
    return false;
  }

  block.currentHealth = Math.max(0, block.currentHealth - damage);

  if (block.currentHealth <= 0) {
    block.isDetached = true;
    vehicle.durabilityPercentage = calculateVehicleDurability(vehicle);

    // Ejeção balística da peça desprendida
    spawnDebrisFromBlock(block, vehicleTransform, debrisPool, activeDebris);
    return true;
  }

  vehicle.durabilityPercentage = calculateVehicleDurability(vehicle);
  return false;
}

/**
 * Converte a posição relativa do bloco para coordenadas mundiais e ejeta no ObjectPool.
 */
export function spawnDebrisFromBlock(
  block: ModularBlock,
  vehicleTransform: TransformComponent,
  debrisPool: ObjectPool<DebrisParticle>,
  activeDebris: DebrisParticle[],
): DebrisParticle {
  const particle = debrisPool.acquire();

  const rotY = vehicleTransform.rotationY;
  const cosR = Math.cos(rotY);
  const sinR = Math.sin(rotY);

  // Conversão de coordenadas locais do bloco para mundiais
  particle.x = vehicleTransform.x + (cosR * block.relativePos.x + sinR * block.relativePos.z);
  particle.y = vehicleTransform.y + block.relativePos.y;
  particle.z = vehicleTransform.z + (-sinR * block.relativePos.x + cosR * block.relativePos.z);

  // Impulso balístico arcade para o alto e para fora
  const spreadX = (Math.random() - 0.5) * 5.5;
  const spreadZ = (Math.random() - 0.5) * 5.5;
  particle.vx = spreadX + sinR * 3.5;
  particle.vy = 4.8 + Math.random() * 3.2; // Salto parabólico vertical
  particle.vz = spreadZ + cosR * 3.5;

  particle.rotX = Math.random() * Math.PI;
  particle.rotY = rotY;
  particle.rotZ = Math.random() * Math.PI;
  particle.vRotX = (Math.random() - 0.5) * 8.0;
  particle.vRotY = (Math.random() - 0.5) * 8.0;

  particle.size = { ...block.size };
  particle.colorHex = block.colorHex;
  particle.maxLife = 4.0;
  particle.life = particle.maxLife;
  particle.active = true;
  particle.bounces = 0;

  activeDebris.push(particle);
  return particle;
}

/**
 * Aplica dano de impacto quando o veículo colide com barreiras ou obstáculos em velocidade.
 */
export function applyVehicleImpactDamage(
  vehicle: ModularVehicleComponent,
  vehicleTransform: TransformComponent,
  impactSpeed: number,
  debrisPool: ObjectPool<DebrisParticle>,
  activeDebris: DebrisParticle[],
): number {
  const minImpactSpeed = 4.5;
  if (impactSpeed < minImpactSpeed) {
    return 0;
  }

  // Dano proporcional à energia cinética do choque
  const damage = Math.round((impactSpeed - minImpactSpeed) * 8.5 + 15);

  // Seleciona um bloco periférico que ainda esteja anexado
  const attachedBlocks = vehicle.blocks.filter((b) => !b.isDetached);
  if (attachedBlocks.length === 0) {
    return 0;
  }

  // Prioriza para-choques e saias laterais antes de partes estruturais
  const targetBlock =
    attachedBlocks.find((b) => b.blockType === 'bumper') ??
    attachedBlocks.find((b) => b.blockType === 'armor') ??
    attachedBlocks[0];

  applyDamageToBlock(vehicle, targetBlock.id, damage, vehicleTransform, debrisPool, activeDebris);
  return damage;
}

/**
 * Atualiza simulação física dos detritos (gravidade, quiques de blocos no chão de studs e reciclagem).
 */
export function updateDebrisSimulation(
  activeDebris: DebrisParticle[],
  debrisPool: ObjectPool<DebrisParticle>,
  dt: number,
  bounds: ArenaBounds = DEFAULT_ARENA_BOUNDS,
): void {
  const gravity = 17.5;
  const bounceRestitution = 0.45;
  const groundFriction = 0.88;

  for (let i = activeDebris.length - 1; i >= 0; i--) {
    const p = activeDebris[i];

    // Gravidade contínua
    p.vy -= gravity * dt;

    // Integração de movimento
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.z += p.vz * dt;

    // Rotação acrobática das peças de blocos soltas
    p.rotX += p.vRotX * dt;
    p.rotY += p.vRotY * dt;

    // Colisão com o solo (y = 0)
    if (p.y <= 0.1) {
      p.y = 0.1;

      if (p.vy < -0.8) {
        // Quique arcade com amortecimento
        p.vy = -p.vy * bounceRestitution;
        p.vx *= groundFriction;
        p.vz *= groundFriction;
        p.vRotX *= 0.7;
        p.vRotY *= 0.7;
        p.bounces++;
      } else {
        // Repouso no solo
        p.vy = 0;
        p.vx *= Math.pow(0.5, dt * 20);
        p.vz *= Math.pow(0.5, dt * 20);
        p.vRotX = 0;
        p.vRotY = 0;
      }
    }

    // Limites da arena
    p.x = Math.max(bounds.minX, Math.min(bounds.maxX, p.x));
    p.z = Math.max(bounds.minZ, Math.min(bounds.maxZ, p.z));

    // Decaimento de vida e reciclagem no pool
    p.life -= dt;
    if (p.life <= 0) {
      p.active = false;
      debrisPool.release(p);
      activeDebris.splice(i, 1);
    }
  }
}

/**
 * Desmonta completamente o veículo ejetando todos os blocos restantes no ObjectPool de detritos,
 * zerando a durabilidade estrutural.
 */
export function dismantleVehicle(
  vehicle: ModularVehicleComponent,
  vehicleTransform: TransformComponent,
  debrisPool: ObjectPool<DebrisParticle>,
  activeDebris: DebrisParticle[],
): void {
  for (const block of vehicle.blocks) {
    if (!block.isDetached) {
      block.isDetached = true;
      block.currentHealth = 0;
      spawnDebrisFromBlock(block, vehicleTransform, debrisPool, activeDebris);
    }
  }
  vehicle.durabilityPercentage = 0;
}
