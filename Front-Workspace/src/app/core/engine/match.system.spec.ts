import { describe, expect, it } from 'vitest';
import {
  advanceToNextWave,
  applyDamageToEnemyEntity,
  createDefaultMatchState,
  spawnWaveEnemies,
  startMatchCountdown,
  updateMatchSimulation,
} from './match.system';
import { DEFAULT_ARENA_BOUNDS } from './types/ecs.types';
import { MatchStateSnapshot } from './types/match.types';

describe('MatchSystem & Modos de Jogo (Fase 7)', () => {
  it('deve instanciar o estado inicial de partida no modo Sobrevivência Co-op', () => {
    const match = createDefaultMatchState('coop_survival');

    expect(match.mode).toBe('coop_survival');
    expect(match.state).toBe('waiting');
    expect(match.currentWave).toBe(1);
    expect(match.maxWaves).toBe(5);
    expect(match.enemies.length).toBe(0);
    expect(match.scores.length).toBeGreaterThan(0);
  });

  it('deve iniciar a contagem regressiva da partida com 3 segundos', () => {
    const match = createDefaultMatchState('coop_survival');
    startMatchCountdown(match);

    expect(match.state).toBe('countdown');
    expect(match.countdownSeconds).toBe(3);
  });

  it('deve transicionar de countdown para in_progress e spawnar inimigos da onda 1', () => {
    const match = createDefaultMatchState('coop_survival');
    startMatchCountdown(match);

    // Simula passagem de 3.1 segundos
    updateMatchSimulation(match, { x: 0, y: 0, z: 0 }, 3.1, DEFAULT_ARENA_BOUNDS);

    expect(match.state).toBe('in_progress');
    expect(match.enemies.length).toBeGreaterThan(0);
    expect(match.enemiesRemaining).toBe(match.enemies.length);
    expect(match.enemies.every((e) => e.active)).toBe(true);
  });

  it('deve spawnar inimigos dos arquétipos scout_block, swarm_buggy e brute_rammer conforme a onda avança', () => {
    const wave1 = spawnWaveEnemies(1, DEFAULT_ARENA_BOUNDS);
    expect(wave1.some((e) => e.type === 'scout_block')).toBe(true);

    const wave3 = spawnWaveEnemies(3, DEFAULT_ARENA_BOUNDS);
    expect(wave3.some((e) => e.type === 'scout_block')).toBe(true);
    expect(wave3.some((e) => e.type === 'swarm_buggy')).toBe(true);
    expect(wave3.some((e) => e.type === 'brute_rammer')).toBe(true);
  });

  it('deve perseguir o jogador no modo sobrevivência respeitando as posições relativas', () => {
    const match = createDefaultMatchState('coop_survival');
    match.state = 'in_progress';
    match.enemies = [
      {
        id: 'enemy_test_1',
        type: 'scout_block',
        x: 10,
        y: 0,
        z: 10,
        rotationY: 0,
        speed: 5.0,
        health: 30,
        maxHealth: 30,
        damage: 10,
        active: true,
      },
    ];

    const initialDist = Math.hypot(10, 10);
    // Jogador no centro (0, 0, 0)
    updateMatchSimulation(match, { x: 0, y: 0, z: 0 }, 0.5, DEFAULT_ARENA_BOUNDS);

    const currentDist = Math.hypot(match.enemies[0].x, match.enemies[0].z);
    expect(currentDist).toBeLessThan(initialDist); // Inimigo se aproximou
  });

  it('deve aplicar dano aos inimigos, atualizar placar e eliminá-los quando a vida zerar', () => {
    const match = createDefaultMatchState('coop_survival');
    match.enemies = [
      {
        id: 'enemy_target',
        type: 'brute_rammer',
        x: 0,
        y: 0,
        z: 0,
        rotationY: 0,
        speed: 2.0,
        health: 50,
        maxHealth: 50,
        damage: 20,
        active: true,
      },
    ];

    // Dano parcial (30 dano)
    const partialHit = applyDamageToEnemyEntity(
      match.enemies,
      'enemy_target',
      30,
      match.scores,
      'local_player',
    );
    expect(partialHit.killed).toBe(false);
    expect(match.enemies[0].health).toBe(20);
    expect(match.enemies[0].active).toBe(true);

    // Dano fatal (25 dano)
    const fatalHit = applyDamageToEnemyEntity(
      match.enemies,
      'enemy_target',
      25,
      match.scores,
      'local_player',
    );
    expect(fatalHit.killed).toBe(true);
    expect(match.enemies[0].health).toBe(0);
    expect(match.enemies[0].active).toBe(false);

    const localScore = match.scores.find((s) => s.playerId === 'local_player');
    expect(localScore?.kills).toBe(1);
    expect(localScore?.score).toBeGreaterThan(0);
  });

  it('deve entrar em wave_intermission com 3 opções de upgrade quando todos os inimigos da onda forem derrotados', () => {
    const match = createDefaultMatchState('coop_survival');
    match.state = 'in_progress';
    match.currentWave = 1;
    match.enemies = [
      {
        id: 'enemy_last',
        type: 'scout_block',
        x: 0,
        y: 0,
        z: 0,
        rotationY: 0,
        speed: 4.0,
        health: 0,
        maxHealth: 30,
        damage: 10,
        active: false, // Morto
      },
    ];

    updateMatchSimulation(match, { x: 0, y: 0, z: 0 }, 0.1, DEFAULT_ARENA_BOUNDS);

    expect(match.state).toBe('wave_intermission');
    expect(match.upgradeOptions?.length).toBe(3);
    expect(match.intermissionSeconds).toBeGreaterThan(0);
  });

  it('deve avançar para a próxima onda e regenerar inimigos com advanceToNextWave', () => {
    const match = createDefaultMatchState('coop_survival');
    match.state = 'wave_intermission';
    match.currentWave = 1;

    advanceToNextWave(match, DEFAULT_ARENA_BOUNDS);

    expect(match.state).toBe('in_progress');
    expect(match.currentWave).toBe(2);
    expect(match.enemies.length).toBeGreaterThan(0);
    expect(match.upgradeOptions?.length).toBe(0);
  });

  it('deve atingir victory quando a última onda (onda 5) for vencida', () => {
    const match = createDefaultMatchState('coop_survival');
    match.state = 'in_progress';
    match.currentWave = 5;
    match.maxWaves = 5;
    match.enemies = [
      {
        id: 'boss_enemy',
        type: 'brute_rammer',
        x: 0,
        y: 0,
        z: 0,
        rotationY: 0,
        speed: 2.0,
        health: 0,
        maxHealth: 150,
        damage: 30,
        active: false, // Morto
      },
    ];

    updateMatchSimulation(match, { x: 0, y: 0, z: 0 }, 0.1, DEFAULT_ARENA_BOUNDS);

    expect(match.state).toBe('victory');
  });
});
