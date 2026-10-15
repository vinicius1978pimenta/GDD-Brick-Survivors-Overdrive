/**
 * Tipos e interfaces para o Sistema Modular de Blocos e Destruição Estilo LEGO.
 * Camada pura de ECS e física arcade.
 */

export type BlockType = 'chassis' | 'armor' | 'bumper' | 'wing' | 'roof';

export interface Vector3D {
  x: number;
  y: number;
  z: number;
}

export interface BlockDimensions {
  w: number;
  h: number;
  d: number;
}

export interface ModularBlock {
  id: string;
  name: string;
  socketId: string;
  relativePos: Vector3D;
  size: BlockDimensions;
  blockType: BlockType;
  maxHealth: number;
  currentHealth: number;
  isDetached: boolean;
  colorHex: number;
}

export interface ModularVehicleComponent {
  blocks: ModularBlock[];
  durabilityPercentage: number;
  mass: number;
}

export interface DebrisParticle {
  id: number;
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  rotX: number;
  rotY: number;
  rotZ: number;
  vRotX: number;
  vRotY: number;
  size: BlockDimensions;
  colorHex: number;
  life: number;
  maxLife: number;
  active: boolean;
  bounces: number;
}
