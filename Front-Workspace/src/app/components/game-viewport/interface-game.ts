import * as THREE from 'three';

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