import { TransformComponent } from './types';
import {
  DebrisParticle,
  ModularVehicleComponent,
} from './modular-block.types';
import {
  applyDamageToBlock,
  applyVehicleImpactDamage,
  calculateVehicleDurability,
  createDebrisFactory,
  createDefaultBuggyBlocks,
  dismantleVehicle,
  updateDebrisSimulation,
} from './modular-block.system';
import { ObjectPool } from './object-pool';

describe('ModularBlockSystem (Lego-style Destruction & Physics)', () => {
  let vehicle: ModularVehicleComponent;
  let vehicleTransform: TransformComponent;
  let debrisPool: ObjectPool<DebrisParticle>;
  let activeDebris: DebrisParticle[];

  beforeEach(() => {
    vehicle = {
      blocks: createDefaultBuggyBlocks(),
      durabilityPercentage: 100,
      mass: 850,
    };
    vehicleTransform = {
      x: 0,
      y: 0,
      z: 0,
      rotationY: 0,
    };
    debrisPool = new ObjectPool<DebrisParticle>(createDebrisFactory(), undefined, 10, 50);
    activeDebris = [];
  });

  it('deve montar a configuração padrão de blocos modulares com durabilidade em 100%', () => {
    expect(vehicle.blocks.length).toBeGreaterThan(4);
    expect(calculateVehicleDurability(vehicle)).toBe(100);
    expect(vehicle.blocks.every((b) => !b.isDetached)).toBe(true);
  });

  it('deve aplicar dano parcial a um bloco sem desprendê-lo', () => {
    const target = vehicle.blocks[0];
    const initialHealth = target.currentHealth;

    const detached = applyDamageToBlock(
      vehicle,
      target.id,
      20,
      vehicleTransform,
      debrisPool,
      activeDebris,
    );

    expect(detached).toBe(false);
    expect(target.currentHealth).toBe(initialHealth - 20);
    expect(target.isDetached).toBe(false);
    expect(vehicle.durabilityPercentage).toBeLessThan(100);
    expect(activeDebris.length).toBe(0);
  });

  it('deve desvincular o bloco e ejetar detrito no pool quando o dano for fatal', () => {
    const target = vehicle.blocks[0];

    const detached = applyDamageToBlock(
      vehicle,
      target.id,
      target.maxHealth + 10,
      vehicleTransform,
      debrisPool,
      activeDebris,
    );

    expect(detached).toBe(true);
    expect(target.currentHealth).toBe(0);
    expect(target.isDetached).toBe(true);
    expect(vehicle.durabilityPercentage).toBeLessThan(100);

    // Ejetou detrito balístico ativo
    expect(activeDebris.length).toBe(1);
    const debris = activeDebris[0];
    expect(debris.active).toBe(true);
    expect(debris.vy).toBeGreaterThan(0); // Impulso vertical para o ar
    expect(debris.life).toBeGreaterThan(0);
  });

  it('deve aplicar dano de impacto em colisões bruscas e priorizar para-choques/blindagens', () => {
    // Velocidade baixa (< 4.5) não causa dano
    const lowDamage = applyVehicleImpactDamage(
      vehicle,
      vehicleTransform,
      3.0,
      debrisPool,
      activeDebris,
    );
    expect(lowDamage).toBe(0);
    expect(calculateVehicleDurability(vehicle)).toBe(100);

    // Velocidade alta (> 4.5) causa dano e descola peça
    const highDamage = applyVehicleImpactDamage(
      vehicle,
      vehicleTransform,
      15.0,
      debrisPool,
      activeDebris,
    );
    expect(highDamage).toBeGreaterThan(0);
    expect(vehicle.durabilityPercentage).toBeLessThan(100);
  });

  it('deve simular gravidade, quique no solo e reciclar partículas expiradas no ObjectPool', () => {
    // Força o desprendimento de um bloco para criar um detrito
    applyDamageToBlock(
      vehicle,
      vehicle.blocks[0].id,
      100,
      vehicleTransform,
      debrisPool,
      activeDebris,
    );
    expect(activeDebris.length).toBe(1);

    const debris = activeDebris[0];
    const initialVy = debris.vy;

    // Atualiza simulação física
    updateDebrisSimulation(activeDebris, debrisPool, 0.1);
    expect(debris.vy).toBeLessThan(initialVy); // Gravidade atuou

    // Simula tempo suficiente para a partícula colidir com o chão
    for (let i = 0; i < 20; i++) {
      updateDebrisSimulation(activeDebris, debrisPool, 0.1);
    }
    expect(debris.bounces).toBeGreaterThan(0); // Quicou no chão de blocos

    // Simula expiração do tempo de vida
    debris.life = 0.05;
    updateDebrisSimulation(activeDebris, debrisPool, 0.1);

    // Partícula deve ter sido removida de activeDebris e devolvida ao debrisPool
    expect(activeDebris.length).toBe(0);
    expect(debrisPool.availableCount).toBeGreaterThan(0);
  });

  it('deve desmontar todos os blocos restantes e zerar a durabilidade com dismantleVehicle', () => {
    dismantleVehicle(vehicle, vehicleTransform, debrisPool, activeDebris);

    expect(vehicle.durabilityPercentage).toBe(0);
    expect(vehicle.blocks.every((b) => b.isDetached)).toBe(true);
    expect(vehicle.blocks.every((b) => b.currentHealth === 0)).toBe(true);
    expect(activeDebris.length).toBe(vehicle.blocks.length);
  });
});
