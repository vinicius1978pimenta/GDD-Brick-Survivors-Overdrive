import * as THREE from 'three';

/**
 * Tipos de cenários temáticos suportados pela arena 100x100.
 */
export type ScenarioThemeType = 'industrial_outpost' | 'neon_cyber';

/**
 * Resultado da construção de um cenário temático 3D (Three.js).
 */
export interface ScenarioBuildResult {
  readonly group: THREE.Group;
  readonly theme: ScenarioThemeType;
  readonly floorMesh: THREE.Mesh;
  readonly structures: THREE.Object3D[];
}
