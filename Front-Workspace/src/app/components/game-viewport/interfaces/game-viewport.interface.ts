import * as THREE from 'three';

/**
 * Representação visual e interpolação de jogadores remotos no Three.js.
 */
export interface RemotePlayerVisual {
  mesh: THREE.Group;
  currentX: number;
  currentY: number;
  currentZ: number;
  currentRotationY: number;
  targetX: number;
  targetY: number;
  targetZ: number;
  targetRotationY: number;
  name: string;
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
