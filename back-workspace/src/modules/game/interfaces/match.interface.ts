export type GameModeType = 'coop_survival' | 'pvp_deathmatch';

export type MatchState =
  | 'waiting'
  | 'countdown'
  | 'in_progress'
  | 'wave_intermission'
  | 'game_over'
  | 'victory';

export type EnemyType = 'scout_block' | 'brute_rammer' | 'swarm_buggy';

export type UpgradeStat =
  | 'move_speed'
  | 'max_health'
  | 'damage_multiplier'
  | 'cooldown_reduction'
  | 'bullet_speed';

export interface UpgradeOption {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly stat: UpgradeStat;
  readonly value: number;
  readonly rarity: 'common' | 'rare' | 'epic';
}

export interface EnemyEntity {
  readonly id: string;
  readonly type: EnemyType;
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  rotationY: number;
  health: number;
  maxHealth: number;
  speed: number;
  damage: number;
  scoreValue: number;
  radius: number;
  targetPlayerId: string | null;
  attackCooldown: number;
}

export interface EnemySnapshot {
  readonly id: string;
  readonly type: EnemyType;
  readonly x: number;
  readonly y: number;
  readonly z: number;
  readonly rotationY: number;
  readonly health: number;
  readonly maxHealth: number;
}

export interface PlayerMatchScore {
  readonly playerId: string;
  readonly playerName: string;
  kills: number;
  deaths: number;
  score: number;
  upgrades: string[];
  invulnerableUntil: number;
}

export interface MatchStateSnapshot {
  readonly mode: GameModeType;
  readonly state: MatchState;
  readonly timeRemaining: number;
  readonly countdownSeconds: number;
  readonly currentWave: number;
  readonly maxWaves: number;
  readonly totalScore: number;
  readonly enemies: EnemySnapshot[];
  readonly upgradeOptions: UpgradeOption[];
  readonly scores: PlayerMatchScore[];
  readonly winnerId: string | null;
  readonly intermissionTimeRemaining: number;
}

export interface EnemyConfig {
  readonly type: EnemyType;
  readonly name: string;
  readonly health: number;
  readonly speed: number;
  readonly damage: number;
  readonly radius: number;
  readonly scoreValue: number;
  readonly attackCooldownSec: number;
}

export interface WaveConfig {
  readonly waveNumber: number;
  readonly enemyCounts: Record<EnemyType, number>;
}

export const ENEMY_CONFIGS: Record<EnemyType, EnemyConfig> = {
  scout_block: {
    type: 'scout_block',
    name: 'Scout Block',
    health: 30,
    speed: 5.5,
    damage: 10,
    radius: 0.6,
    scoreValue: 50,
    attackCooldownSec: 1.0,
  },
  brute_rammer: {
    type: 'brute_rammer',
    name: 'Brute Rammer',
    health: 90,
    speed: 3.2,
    damage: 25,
    radius: 1.1,
    scoreValue: 150,
    attackCooldownSec: 1.5,
  },
  swarm_buggy: {
    type: 'swarm_buggy',
    name: 'Swarm Buggy',
    health: 20,
    speed: 7.0,
    damage: 8,
    radius: 0.5,
    scoreValue: 75,
    attackCooldownSec: 0.8,
  },
};

export const COOP_CONFIG = {
  maxWaves: 5,
  intermissionDurationSec: 10,
  countdownDurationSec: 3,
  waves: [
    {
      waveNumber: 1,
      enemyCounts: { scout_block: 4, brute_rammer: 0, swarm_buggy: 0 },
    },
    {
      waveNumber: 2,
      enemyCounts: { scout_block: 4, brute_rammer: 1, swarm_buggy: 3 },
    },
    {
      waveNumber: 3,
      enemyCounts: { scout_block: 6, brute_rammer: 2, swarm_buggy: 5 },
    },
    {
      waveNumber: 4,
      enemyCounts: { scout_block: 8, brute_rammer: 3, swarm_buggy: 8 },
    },
    {
      waveNumber: 5,
      enemyCounts: { scout_block: 10, brute_rammer: 5, swarm_buggy: 12 },
    },
  ] as readonly WaveConfig[],
} as const;

export const PVP_CONFIG = {
  matchDurationSec: 180,
  targetKills: 10,
  countdownDurationSec: 3,
  invulnerabilityDurationMs: 2000,
} as const;

export const UPGRADE_CATALOG: readonly UpgradeOption[] = [
  {
    id: 'upg-speed-1',
    name: 'Turbo Boosters',
    description: '+15% velocidade de movimento',
    stat: 'move_speed',
    value: 0.15,
    rarity: 'common',
  },
  {
    id: 'upg-health-1',
    name: 'Reinforced Chassis',
    description: '+30 vida máxima',
    stat: 'max_health',
    value: 30,
    rarity: 'common',
  },
  {
    id: 'upg-damage-1',
    name: 'High-Caliber Studs',
    description: '+20% de dano com todas as armas',
    stat: 'damage_multiplier',
    value: 0.2,
    rarity: 'rare',
  },
  {
    id: 'upg-cooldown-1',
    name: 'Rapid Reloader',
    description: '-20% tempo de recarga / cooldown',
    stat: 'cooldown_reduction',
    value: 0.2,
    rarity: 'rare',
  },
  {
    id: 'upg-bullet-1',
    name: 'Rail Accelerator',
    description: '+25% velocidade dos projéteis',
    stat: 'bullet_speed',
    value: 0.25,
    rarity: 'common',
  },
  {
    id: 'upg-damage-2',
    name: 'Overdrive Core',
    description: '+40% de dano extremo',
    stat: 'damage_multiplier',
    value: 0.4,
    rarity: 'epic',
  },
] as const;
