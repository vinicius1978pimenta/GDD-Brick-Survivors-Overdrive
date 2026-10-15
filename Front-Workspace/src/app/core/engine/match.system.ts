import { ArenaBounds } from './types/ecs.types';
import { Vector3D } from './modular-block.types';
import {
  EnemyEntity,
  EnemyType,
  GameModeType,
  MatchState,
  MatchStateSnapshot,
  PlayerMatchScore,
  UpgradeOption,
} from './types/match.types';
import { getRandomUpgrades } from './match.catalog';

/**
 * Cria o estado inicial de uma partida.
 */
export function createDefaultMatchState(mode: GameModeType = 'coop_survival'): MatchStateSnapshot {
  return {
    mode,
    state: 'waiting',
    currentWave: 1,
    maxWaves: 5,
    enemiesRemaining: 0,
    countdownSeconds: 3,
    intermissionSeconds: 10,
    enemies: [],
    scores: [
      {
        playerId: 'local_player',
        name: 'Hero Player',
        kills: 0,
        deaths: 0,
        score: 0,
      },
      {
        playerId: 'bot_rival_1',
        name: 'Cyber Brick',
        kills: 0,
        deaths: 0,
        score: 0,
      },
    ],
    upgradeOptions: [],
  };
}

/**
 * Inicia a contagem regressiva da partida.
 */
export function startMatchCountdown(match: MatchStateSnapshot): void {
  match.state = 'countdown';
  match.countdownSeconds = 3;
}

/**
 * Gera os inimigos da onda especificada no modo sobrevivência.
 */
export function spawnWaveEnemies(wave: number, bounds: ArenaBounds): EnemyEntity[] {
  const enemies: EnemyEntity[] = [];
  const waveConfigs: Record<number, { scout: number; buggy: number; brute: number }> = {
    1: { scout: 4, buggy: 0, brute: 0 },
    2: { scout: 4, buggy: 2, brute: 0 },
    3: { scout: 3, buggy: 3, brute: 2 },
    4: { scout: 4, buggy: 4, brute: 2 },
    5: { scout: 5, buggy: 4, brute: 3 },
  };

  const config = waveConfigs[wave] ?? {
    scout: 3 + wave,
    buggy: 2 + Math.floor(wave / 2),
    brute: Math.floor(wave / 2),
  };

  let idCounter = 0;

  const spawnTypes: { type: EnemyType; count: number }[] = [
    { type: 'scout_block', count: config.scout },
    { type: 'swarm_buggy', count: config.buggy },
    { type: 'brute_rammer', count: config.brute },
  ];

  for (const group of spawnTypes) {
    for (let i = 0; i < group.count; i++) {
      idCounter++;
      // Gera spawn nas bordas da arena
      const angle = Math.random() * Math.PI * 2;
      const radius = Math.min(bounds.maxX, bounds.maxZ) * 0.85;
      const x = Math.cos(angle) * radius;
      const z = Math.sin(angle) * radius;

      let speed = 4.5;
      let health = 30;
      let damage = 10;

      if (group.type === 'swarm_buggy') {
        speed = 3.8;
        health = 55;
        damage = 15;
      } else if (group.type === 'brute_rammer') {
        speed = 2.4;
        health = 110;
        damage = 25;
      }

      enemies.push({
        id: `enemy_${wave}_${idCounter}`,
        type: group.type,
        x,
        y: group.type === 'scout_block' ? 0.35 : 0,
        z,
        rotationY: Math.atan2(-x, -z),
        speed,
        health,
        maxHealth: health,
        damage,
        active: true,
      });
    }
  }

  return enemies;
}

/**
 * Atualiza a simulação das regras da partida e inteligência artificial dos inimigos.
 */
export function updateMatchSimulation(
  match: MatchStateSnapshot,
  playerPos: Vector3D,
  dt: number,
  bounds: ArenaBounds,
  onEnemyKilled?: (enemy: EnemyEntity) => void,
): void {
  // 1. Estado de Contagem Regressiva
  if (match.state === 'countdown') {
    match.countdownSeconds -= dt;
    if (match.countdownSeconds <= 0) {
      match.state = 'in_progress';
      match.countdownSeconds = 0;
      if (match.mode === 'coop_survival') {
        match.enemies = spawnWaveEnemies(match.currentWave, bounds);
        match.enemiesRemaining = match.enemies.length;
      }
    }
    return;
  }

  // 2. Estado de Intermissão entre Ondas (Roguelite Upgrades)
  if (match.state === 'wave_intermission') {
    match.intermissionSeconds -= dt;
    if (match.intermissionSeconds <= 0) {
      advanceToNextWave(match, bounds);
    }
    return;
  }

  // 3. Estado em Andamento (In Progress)
  if (match.state === 'in_progress') {
    if (match.mode === 'coop_survival') {
      // Atualiza movimentação dos inimigos perseguindo o jogador
      for (const enemy of match.enemies) {
        if (!enemy.active) continue;

        const dx = playerPos.x - enemy.x;
        const dz = playerPos.z - enemy.z;
        const dist = Math.hypot(dx, dz);

        if (dist > 0.4) {
          enemy.rotationY = Math.atan2(dx, dz);
          enemy.x += Math.sin(enemy.rotationY) * enemy.speed * dt;
          enemy.z += Math.cos(enemy.rotationY) * enemy.speed * dt;
        }

        // Restringe aos limites da arena
        enemy.x = Math.max(bounds.minX + 0.5, Math.min(bounds.maxX - 0.5, enemy.x));
        enemy.z = Math.max(bounds.minZ + 0.5, Math.min(bounds.maxZ - 0.5, enemy.z));
      }

      // Conta inimigos ativos
      const aliveEnemies = match.enemies.filter((e) => e.active && e.health > 0);
      match.enemiesRemaining = aliveEnemies.length;

      // Se todos os inimigos foram eliminados
      if (aliveEnemies.length === 0 && match.enemies.length > 0) {
        if (match.currentWave >= match.maxWaves) {
          match.state = 'victory';
        } else {
          // Entra em wave intermission e oferece 3 upgrades roguelite
          match.state = 'wave_intermission';
          match.intermissionSeconds = 12;
          match.upgradeOptions = getRandomUpgrades(3);
        }
      }
    } else if (match.mode === 'pvp_deathmatch') {
      // Simulação de bots no PvP
      // Se algum jogador atingir a pontuação limite (ex: 10 kills), vitória
      for (const score of match.scores) {
        if (score.kills >= 10) {
          match.state = score.playerId === 'local_player' ? 'victory' : 'game_over';
          break;
        }
      }
    }
  }
}

/**
 * Avança para a próxima onda e limpa as opções de upgrade.
 */
export function advanceToNextWave(match: MatchStateSnapshot, bounds: ArenaBounds): void {
  match.currentWave++;
  match.state = 'in_progress';
  match.upgradeOptions = [];
  match.enemies = spawnWaveEnemies(match.currentWave, bounds);
  match.enemiesRemaining = match.enemies.length;
}

/**
 * Aplica dano a um inimigo por ID e retorna true se o inimigo foi eliminado.
 */
export function applyDamageToEnemyEntity(
  enemies: EnemyEntity[],
  enemyId: string,
  damage: number,
  scores?: PlayerMatchScore[],
  shooterId: string = 'local_player',
): { killed: boolean; enemy?: EnemyEntity } {
  const enemy = enemies.find((e) => e.id === enemyId && e.active);
  if (!enemy) {
    return { killed: false };
  }

  enemy.health = Math.max(0, enemy.health - damage);
  if (enemy.health <= 0) {
    enemy.active = false;

    // Atualiza placar
    if (scores) {
      const scorer = scores.find((s) => s.playerId === shooterId);
      if (scorer) {
        scorer.kills++;
        scorer.score += enemy.type === 'brute_rammer' ? 250 : enemy.type === 'swarm_buggy' ? 150 : 100;
      }
    }

    return { killed: true, enemy };
  }

  return { killed: false, enemy };
}
