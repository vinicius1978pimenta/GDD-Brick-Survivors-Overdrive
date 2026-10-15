/**
 * Tipos e modelos estritos para a Fase 7: Modos de Jogo (Sobrevivência Co-op & Combate PvP).
 */

export type GameModeType = 'coop_survival' | 'pvp_deathmatch';

export type MatchState =
  | 'waiting'
  | 'countdown'
  | 'in_progress'
  | 'wave_intermission'
  | 'game_over'
  | 'victory';

export type EnemyType = 'scout_block' | 'brute_rammer' | 'swarm_buggy';

export interface EnemyEntity {
  id: string;
  type: EnemyType;
  x: number;
  y: number;
  z: number;
  rotationY: number;
  speed: number;
  health: number;
  maxHealth: number;
  damage: number;
  active: boolean;
}

export type UpgradeStat =
  | 'damage'
  | 'fire_rate'
  | 'move_speed'
  | 'max_health'
  | 'bullet_spread'
  | 'armor';

export interface UpgradeOption {
  id: string;
  title: string;
  description: string;
  stat: UpgradeStat;
  multiplier: number;
  icon: string;
}

export interface PlayerMatchScore {
  playerId: string;
  name: string;
  kills: number;
  deaths: number;
  score: number;
}

export interface MatchStateSnapshot {
  mode: GameModeType;
  state: MatchState;
  currentWave: number;
  maxWaves: number;
  enemiesRemaining: number;
  countdownSeconds: number;
  intermissionSeconds: number;
  enemies: EnemyEntity[];
  scores: PlayerMatchScore[];
  upgradeOptions?: UpgradeOption[];
}
