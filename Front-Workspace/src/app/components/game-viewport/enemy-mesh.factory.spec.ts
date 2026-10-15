import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { createEnemyMesh } from './enemy-mesh.factory';

describe('EnemyMeshFactory (Modelagem 3D de Inimigos LEGO)', () => {
  it('deve instanciar o modelo 3D do scout_block com studs, visor holográfico e propulsores', () => {
    const mesh = createEnemyMesh('scout_block');

    expect(mesh).toBeInstanceOf(THREE.Group);
    expect(mesh.children.length).toBeGreaterThanOrEqual(5);

    // Deve conter meshes com materiais
    const meshes: THREE.Mesh[] = [];
    mesh.traverse((c) => {
      if (c instanceof THREE.Mesh) meshes.push(c);
    });
    expect(meshes.length).toBeGreaterThan(0);

    // Deve ter malha com emissive (visor holográfico e glow)
    const hasEmissive = meshes.some((m) => {
      const mat = m.material as THREE.MeshStandardMaterial;
      return mat && mat.emissive && mat.emissive.getHex() > 0;
    });
    expect(hasEmissive).toBe(true);
  });

  it('deve instanciar o modelo 3D do brute_rammer com aríete frontal e blindagem escura', () => {
    const mesh = createEnemyMesh('brute_rammer');

    expect(mesh).toBeInstanceOf(THREE.Group);
    expect(mesh.children.length).toBeGreaterThanOrEqual(4);

    const meshes: THREE.Mesh[] = [];
    mesh.traverse((c) => {
      if (c instanceof THREE.Mesh) meshes.push(c);
    });
    expect(meshes.length).toBeGreaterThan(0);

    // Deve conter peças com sombra habilitada
    expect(meshes.some((m) => m.castShadow)).toBe(true);
  });

  it('deve instanciar o modelo 3D do swarm_buggy com chassi, rodas pretas e cano de disparo', () => {
    const mesh = createEnemyMesh('swarm_buggy');

    expect(mesh).toBeInstanceOf(THREE.Group);
    expect(mesh.children.length).toBeGreaterThanOrEqual(6);

    const meshes: THREE.Mesh[] = [];
    mesh.traverse((c) => {
      if (c instanceof THREE.Mesh) meshes.push(c);
    });
    expect(meshes.length).toBeGreaterThanOrEqual(8);
  });
});
