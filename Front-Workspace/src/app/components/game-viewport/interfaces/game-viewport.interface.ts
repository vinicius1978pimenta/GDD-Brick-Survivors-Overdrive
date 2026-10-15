import * as THREE from 'three';

/**
 * Representação visual e interpolação de jogadores remotos no Three.js.
 */
export interface RemotePlayerVisual {
  mesh: THREE.Group;
  leftLegPivot?: THREE.Group;
  rightLegPivot?: THREE.Group;
  leftArmPivot?: THREE.Group;
  rightArmPivot?: THREE.Group;
  isMoving?: boolean;
  currentX: number;
  currentY: number;
  currentZ: number;
  currentRotationY: number;
  targetX: number;
  targetY: number;
  targetZ: number;
  targetRotationY: number;
  name: string;
  health: number;
  maxHealth: number;
}

/**
 * Representação de número de dano flutuante (Floating Combat Text).
 */
export interface FloatingCombatText {
  id: number;
  text: string;
  x: number;
  y: number;
  z: number;
  color: string;
  life: number;
  maxLife: number;
  scale: number;
  screenX: number;
  screenY: number;
  opacity: number;
  visible: boolean;
}

/**
 * Malha visual de projétil renderizado na cena Three.js.
 */
export interface ProjectileVisual {
  id: string;
  mesh: THREE.Object3D;
  weaponType: 'stud_blaster' | 'scatter_shot' | 'spring_mine';
}

/**
 * Tag flutuante de identificação e barra de HP do personagem (Overhead Tag).
 */
export interface PlayerOverheadTag {
  id: string;
  name: string;
  isLocal: boolean;
  health: number;
  maxHealth: number;
  healthPercent: number;
  color: string;
  screenX: number;
  screenY: number;
  visible: boolean;
}

/**
 * Fases temporais do ciclo dinâmico dia e noite.
 */
export type TimeOfDayPhase = 'day' | 'sunset' | 'night' | 'sunrise';

/**
 * Estado instantâneo do ciclo dia e noite.
 */
export interface DayNightCycleState {
  timeOfDay: number; // Fração normalizada (0 a 1)
  phase: TimeOfDayPhase;
  sunElevation: number; // -1 a +1
  isNight: boolean;
}
