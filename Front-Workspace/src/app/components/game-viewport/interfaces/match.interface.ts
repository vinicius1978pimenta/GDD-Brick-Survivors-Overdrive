import * as THREE from 'three';
import {
  EnemyEntity,
  EnemyType,
  GameModeType,
  MatchState,
  PlayerMatchScore,
  UpgradeOption,
  UpgradeStat,
} from '../../../core/engine/types/match.types';

export * from '../../../core/engine/types/match.types';

/**
 * Representação visual e interpolação de inimigos de blocos na cena Three.js.
 */
export interface EnemyVisual {
  readonly id: string;
  readonly type: EnemyType;
  readonly mesh: THREE.Group;
  currentX: number;
  currentY: number;
  currentZ: number;
  currentRotationY: number;
  targetX: number;
  targetY: number;
  targetZ: number;
  targetRotationY: number;
  health: number;
  maxHealth: number;
  isDead?: boolean;
}
