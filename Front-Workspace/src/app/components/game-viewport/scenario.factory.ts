import * as THREE from 'three';
import { ScenarioBuildResult, ScenarioThemeType } from './interfaces/scenario.interface';

/**
 * Fábrica de cenários temáticos 3D (Three.js) para a arena expandida de 100x100 metros.
 * Suporta transformação dinâmica entre 'Outpost Industrial de Blocos' e 'Neon Cyber Arena'.
 */
export class ScenarioFactory {
  /**
   * Constrói o cenário temático selecionado.
   */
  public static buildScenario(
    theme: ScenarioThemeType,
    studTexture?: THREE.CanvasTexture | null,
  ): ScenarioBuildResult {
    const group = new THREE.Group();
    group.name = `scenario_${theme}`;
    const structures: THREE.Object3D[] = [];

    let floorMesh: THREE.Mesh;

    if (theme === 'industrial_outpost') {
      floorMesh = this.buildIndustrialFloor(group, studTexture);
      this.buildIndustrialBoundaries(group, structures);
      this.buildIndustrialWatchtowers(group, structures);
      this.buildIndustrialContainers(group, structures);
      this.buildIndustrialBarricades(group, structures);
    } else {
      floorMesh = this.buildNeonCyberFloor(group);
      this.buildNeonCyberBoundaries(group, structures);
      this.buildNeonCyberObelisks(group, structures);
      this.buildNeonCyberRamps(group, structures);
      this.buildNeonCyberPillars(group, structures);
    }

    return {
      group,
      theme,
      floorMesh,
      structures,
    };
  }

  /**
   * Limpa exaustivamente recursos Three.js do cenário (geometrias, materiais).
   */
  public static disposeScenario(result: ScenarioBuildResult): void {
    result.group.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        if (child.geometry) {
          child.geometry.dispose();
        }
        if (Array.isArray(child.material)) {
          child.material.forEach((mat) => mat.dispose());
        } else if (child.material) {
          child.material.dispose();
        }
      }
    });
    result.group.clear();
    result.structures.length = 0;
  }

  // --- CENÁRIO 1: OUTPOST INDUSTRIAL DE BLOCOS ---

  private static buildIndustrialFloor(
    parent: THREE.Group,
    studTexture?: THREE.CanvasTexture | null,
  ): THREE.Mesh {
    const floorGeo = new THREE.BoxGeometry(100, 0.8, 100);
    const floorMat = new THREE.MeshStandardMaterial({
      color: 0x3d362e,
      roughness: 0.7,
      metalness: 0.1,
      ...(studTexture ? { map: studTexture } : {}),
    });
    const floor = new THREE.Mesh(floorGeo, floorMat);
    floor.position.set(0, -0.4, 0);
    floor.receiveShadow = true;
    parent.add(floor);

    const grid = new THREE.GridHelper(100, 50, 0xfacc15, 0x57534e);
    grid.position.set(0, 0.01, 0);
    if (grid.material instanceof THREE.Material) {
      grid.material.opacity = 0.28;
      grid.material.transparent = true;
    }
    parent.add(grid);

    return floor;
  }

  private static buildIndustrialBoundaries(
    parent: THREE.Group,
    structures: THREE.Object3D[],
  ): void {
    const yellowMat = new THREE.MeshStandardMaterial({
      color: 0xfacc15,
      roughness: 0.4,
      metalness: 0.2,
    });
    const blackMat = new THREE.MeshStandardMaterial({
      color: 0x18181b,
      roughness: 0.5,
      metalness: 0.2,
    });

    const arenaSize = 100;
    const wallHeight = 1.6;
    const wallThickness = 1.2;

    const wallsConfig = [
      { size: [arenaSize, wallHeight, wallThickness], pos: [0, wallHeight / 2, -arenaSize / 2] },
      { size: [arenaSize, wallHeight, wallThickness], pos: [0, wallHeight / 2, arenaSize / 2] },
      { size: [wallThickness, wallHeight, arenaSize], pos: [-arenaSize / 2, wallHeight / 2, 0] },
      { size: [wallThickness, wallHeight, arenaSize], pos: [arenaSize / 2, wallHeight / 2, 0] },
    ];

    for (const config of wallsConfig) {
      const wallGroup = new THREE.Group();
      const wallGeo = new THREE.BoxGeometry(config.size[0], config.size[1], config.size[2]);
      const wallMesh = new THREE.Mesh(wallGeo, blackMat);
      wallMesh.castShadow = true;
      wallMesh.receiveShadow = true;
      wallGroup.add(wallMesh);

      // Listras de advertência industriais
      const stripeGeo = new THREE.BoxGeometry(
        config.size[0] > config.size[2] ? config.size[0] : config.size[0] + 0.05,
        0.35,
        config.size[2] > config.size[0] ? config.size[2] : config.size[2] + 0.05,
      );
      const stripe = new THREE.Mesh(stripeGeo, yellowMat);
      stripe.position.y = 0.25;
      wallGroup.add(stripe);

      wallGroup.position.set(config.pos[0], config.pos[1], config.pos[2]);
      parent.add(wallGroup);
      structures.push(wallGroup);
    }
  }

  private static buildIndustrialWatchtowers(
    parent: THREE.Group,
    structures: THREE.Object3D[],
  ): void {
    const towerPillarMat = new THREE.MeshStandardMaterial({
      color: 0x27272a,
      roughness: 0.45,
      metalness: 0.4,
    });
    const platformMat = new THREE.MeshStandardMaterial({
      color: 0x52525b,
      roughness: 0.5,
      metalness: 0.3,
    });
    const yellowRailingMat = new THREE.MeshStandardMaterial({
      color: 0xfacc15,
      roughness: 0.3,
    });
    const spotlightMat = new THREE.MeshStandardMaterial({
      color: 0xfef08a,
      emissive: 0xfef08a,
      emissiveIntensity: 1.8,
    });

    const towerPositions = [
      { x: -35, z: -35 },
      { x: 35, z: -35 },
      { x: -35, z: 35 },
      { x: 35, z: 35 },
    ];

    for (const pos of towerPositions) {
      const towerGroup = new THREE.Group();
      towerGroup.position.set(pos.x, 0, pos.z);

      // 4 Pilares estruturais de blocos (6.5m de altura)
      const pilarGeo = new THREE.BoxGeometry(0.5, 6.5, 0.5);
      const pOffsets = [
        [-1.6, -1.6],
        [1.6, -1.6],
        [-1.6, 1.6],
        [1.6, 1.6],
      ];
      for (const [px, pz] of pOffsets) {
        const pillar = new THREE.Mesh(pilarGeo, towerPillarMat);
        pillar.position.set(px, 3.25, pz);
        pillar.castShadow = true;
        towerGroup.add(pillar);
      }

      // Plataforma de observação
      const platGeo = new THREE.BoxGeometry(4.2, 0.4, 4.2);
      const platform = new THREE.Mesh(platGeo, platformMat);
      platform.position.set(0, 6.5, 0);
      platform.castShadow = true;
      towerGroup.add(platform);

      // Parapeito de segurança amarelo
      const railGeo = new THREE.BoxGeometry(4.2, 0.7, 0.15);
      const railFront = new THREE.Mesh(railGeo, yellowRailingMat);
      railFront.position.set(0, 7.0, 2.0);
      towerGroup.add(railFront);

      const railBack = new THREE.Mesh(railGeo, yellowRailingMat);
      railBack.position.set(0, 7.0, -2.0);
      towerGroup.add(railBack);

      // Holofote de vigia
      const spotHousingGeo = new THREE.CylinderGeometry(0.3, 0.4, 0.5, 12);
      const spotHousing = new THREE.Mesh(spotHousingGeo, towerPillarMat);
      spotHousing.rotation.x = Math.PI / 3;
      spotHousing.position.set(0, 7.4, 0);
      towerGroup.add(spotHousing);

      const spotLensGeo = new THREE.CylinderGeometry(0.25, 0.25, 0.1, 12);
      const spotLens = new THREE.Mesh(spotLensGeo, spotlightMat);
      spotLens.rotation.x = Math.PI / 3;
      spotLens.position.set(0, 7.25, 0.2);
      towerGroup.add(spotLens);

      parent.add(towerGroup);
      structures.push(towerGroup);
    }
  }

  private static buildIndustrialContainers(
    parent: THREE.Group,
    structures: THREE.Object3D[],
  ): void {
    const containerColors = [
      0xd92626, // Vermelho LEGO
      0x2563eb, // Azul LEGO
      0xf59e0b, // Amarelo LEGO
      0x16a34a, // Verde LEGO
      0x374151, // Cinza escuro
    ];

    const clusters = [
      // Cluster Noroeste
      { x: -24, z: -18, rot: 0.15, stacks: [0, 1, 2] },
      // Cluster Nordeste
      { x: 22, z: -22, rot: -0.3, stacks: [3, 4, 0] },
      // Cluster Sudoeste
      { x: -26, z: 20, rot: 0.4, stacks: [1, 2, 4] },
      // Cluster Sudeste
      { x: 24, z: 18, rot: -0.2, stacks: [2, 0, 3] },
    ];

    for (const cluster of clusters) {
      const clusterGroup = new THREE.Group();
      clusterGroup.position.set(cluster.x, 0, cluster.z);
      clusterGroup.rotation.y = cluster.rot;

      for (let i = 0; i < cluster.stacks.length; i++) {
        const color = containerColors[cluster.stacks[i] % containerColors.length];
        const containerMat = new THREE.MeshStandardMaterial({
          color,
          roughness: 0.45,
          metalness: 0.25,
        });

        const cGeo = new THREE.BoxGeometry(4.8, 2.2, 2.2);
        const container = new THREE.Mesh(cGeo, containerMat);
        container.castShadow = true;
        container.receiveShadow = true;

        if (i === 2) {
          // Container empilhado no topo
          container.position.set(0.4, 3.3, 0);
          container.rotation.y = 0.08;
        } else {
          container.position.set(i === 0 ? -1.3 : 1.3, 1.1, 0);
        }

        // Studs no teto do container LEGO
        const studGeo = new THREE.CylinderGeometry(0.12, 0.12, 0.1, 8);
        for (let sx = -1.8; sx <= 1.8; sx += 0.9) {
          for (let sz = -0.6; sz <= 0.6; sz += 0.6) {
            const stud = new THREE.Mesh(studGeo, containerMat);
            stud.position.set(sx, 1.15, sz);
            container.add(stud);
          }
        }

        clusterGroup.add(container);
      }

      parent.add(clusterGroup);
      structures.push(clusterGroup);
    }
  }

  private static buildIndustrialBarricades(
    parent: THREE.Group,
    structures: THREE.Object3D[],
  ): void {
    const barrierMat = new THREE.MeshStandardMaterial({
      color: 0x475569,
      roughness: 0.6,
      metalness: 0.2,
    });
    const stripeMat = new THREE.MeshStandardMaterial({
      color: 0xfacc15,
      roughness: 0.4,
    });

    const barricadePositions = [
      { x: -10, z: -10, rot: 0.5 },
      { x: 10, z: -10, rot: -0.5 },
      { x: -10, z: 10, rot: -0.5 },
      { x: 10, z: 10, rot: 0.5 },
      { x: 0, z: -25, rot: 0 },
      { x: 0, z: 25, rot: 0 },
    ];

    for (const b of barricadePositions) {
      const bGroup = new THREE.Group();
      bGroup.position.set(b.x, 0, b.z);
      bGroup.rotation.y = b.rot;

      const baseGeo = new THREE.BoxGeometry(3.6, 1.0, 0.7);
      const baseMesh = new THREE.Mesh(baseGeo, barrierMat);
      baseMesh.position.y = 0.5;
      baseMesh.castShadow = true;
      baseMesh.receiveShadow = true;
      bGroup.add(baseMesh);

      const topStripeGeo = new THREE.BoxGeometry(3.6, 0.25, 0.72);
      const stripeMesh = new THREE.Mesh(topStripeGeo, stripeMat);
      stripeMesh.position.y = 0.85;
      bGroup.add(stripeMesh);

      parent.add(bGroup);
      structures.push(bGroup);
    }
  }

  // --- CENÁRIO 2: NEON CYBER ARENA (PVP DEATHMATCH) ---

  private static buildNeonCyberFloor(parent: THREE.Group): THREE.Mesh {
    const floorGeo = new THREE.BoxGeometry(100, 0.8, 100);
    const floorMat = new THREE.MeshStandardMaterial({
      color: 0x05070f,
      roughness: 0.18,
      metalness: 0.85,
    });
    const floor = new THREE.Mesh(floorGeo, floorMat);
    floor.position.set(0, -0.4, 0);
    floor.receiveShadow = true;
    parent.add(floor);

    // Grid cibernético neon
    const grid = new THREE.GridHelper(100, 50, 0x00f0ff, 0x831843);
    grid.position.set(0, 0.01, 0);
    if (grid.material instanceof THREE.Material) {
      grid.material.opacity = 0.35;
      grid.material.transparent = true;
    }
    parent.add(grid);

    // Faixas geométricas de neon ciano e magenta no solo
    const cyanNeonMat = new THREE.MeshStandardMaterial({
      color: 0x00f0ff,
      emissive: 0x00f0ff,
      emissiveIntensity: 2.2,
      roughness: 0.1,
    });
    const magentaNeonMat = new THREE.MeshStandardMaterial({
      color: 0xf43f5e,
      emissive: 0xf43f5e,
      emissiveIntensity: 2.2,
      roughness: 0.1,
    });

    // Cruz de combate central no piso
    const lineXGeo = new THREE.BoxGeometry(80, 0.02, 0.4);
    const lineX = new THREE.Mesh(lineXGeo, cyanNeonMat);
    lineX.position.set(0, 0.02, 0);
    parent.add(lineX);

    const lineZGeo = new THREE.BoxGeometry(0.4, 0.02, 80);
    const lineZ = new THREE.Mesh(lineZGeo, magentaNeonMat);
    lineZ.position.set(0, 0.02, 0);
    parent.add(lineZ);

    // Anel octogonal central
    const ringGeo = new THREE.RingGeometry(8, 8.4, 8);
    const ringMat = new THREE.MeshBasicMaterial({
      color: 0x00f0ff,
      side: THREE.DoubleSide,
    });
    const ring = new THREE.Mesh(ringGeo, ringMat);
    ring.rotation.x = -Math.PI / 2;
    ring.position.set(0, 0.03, 0);
    parent.add(ring);

    return floor;
  }

  private static buildNeonCyberBoundaries(
    parent: THREE.Group,
    structures: THREE.Object3D[],
  ): void {
    const wallMat = new THREE.MeshStandardMaterial({
      color: 0x090d16,
      roughness: 0.3,
      metalness: 0.7,
    });
    const neonCyanMat = new THREE.MeshStandardMaterial({
      color: 0x00f0ff,
      emissive: 0x00f0ff,
      emissiveIntensity: 2.5,
    });
    const neonMagentaMat = new THREE.MeshStandardMaterial({
      color: 0xf43f5e,
      emissive: 0xf43f5e,
      emissiveIntensity: 2.5,
    });

    const arenaSize = 100;
    const wallHeight = 2.2;
    const wallThickness = 1.0;

    const walls = [
      { size: [arenaSize, wallHeight, wallThickness], pos: [0, wallHeight / 2, -arenaSize / 2], mat: neonCyanMat },
      { size: [arenaSize, wallHeight, wallThickness], pos: [0, wallHeight / 2, arenaSize / 2], mat: neonCyanMat },
      { size: [wallThickness, wallHeight, arenaSize], pos: [-arenaSize / 2, wallHeight / 2, 0], mat: neonMagentaMat },
      { size: [wallThickness, wallHeight, arenaSize], pos: [arenaSize / 2, wallHeight / 2, 0], mat: neonMagentaMat },
    ];

    for (const w of walls) {
      const g = new THREE.Group();
      const baseGeo = new THREE.BoxGeometry(w.size[0], w.size[1], w.size[2]);
      const baseMesh = new THREE.Mesh(baseGeo, wallMat);
      baseMesh.castShadow = true;
      baseMesh.receiveShadow = true;
      g.add(baseMesh);

      // Tubo de neon no topo
      const tubeGeo = new THREE.BoxGeometry(
        w.size[0] > w.size[2] ? w.size[0] : 0.2,
        0.2,
        w.size[2] > w.size[0] ? w.size[2] : 0.2,
      );
      const tubeMesh = new THREE.Mesh(tubeGeo, w.mat);
      tubeMesh.position.y = wallHeight / 2 + 0.1;
      g.add(tubeMesh);

      g.position.set(w.pos[0], w.pos[1], w.pos[2]);
      parent.add(g);
      structures.push(g);
    }
  }

  private static buildNeonCyberObelisks(
    parent: THREE.Group,
    structures: THREE.Object3D[],
  ): void {
    const obeliskMat = new THREE.MeshStandardMaterial({
      color: 0x0f172a,
      roughness: 0.25,
      metalness: 0.8,
    });
    const neonMat = new THREE.MeshStandardMaterial({
      color: 0x00f0ff,
      emissive: 0x00f0ff,
      emissiveIntensity: 2.8,
    });
    const coreMat = new THREE.MeshStandardMaterial({
      color: 0xf43f5e,
      emissive: 0xf43f5e,
      emissiveIntensity: 3.0,
    });

    // 4 Obeliscos nos quadrantes centrais
    const obeliskCoords = [
      { x: -16, z: -16 },
      { x: 16, z: -16 },
      { x: -16, z: 16 },
      { x: 16, z: 16 },
    ];

    for (const pos of obeliskCoords) {
      const obeliskGroup = new THREE.Group();
      obeliskGroup.position.set(pos.x, 0, pos.z);

      // Coluna principal (7.5m de altura)
      const colGeo = new THREE.BoxGeometry(2.4, 7.5, 2.4);
      const colMesh = new THREE.Mesh(colGeo, obeliskMat);
      colMesh.position.y = 3.75;
      colMesh.castShadow = true;
      colMesh.receiveShadow = true;
      obeliskGroup.add(colMesh);

      // Ranhuras verticais de neon
      const slotGeo = new THREE.BoxGeometry(0.3, 6.8, 2.45);
      const slotMesh = new THREE.Mesh(slotGeo, neonMat);
      slotMesh.position.y = 3.75;
      obeliskGroup.add(slotMesh);

      // Anéis horizontais
      const ringGeo = new THREE.BoxGeometry(2.5, 0.25, 2.5);
      const ring1 = new THREE.Mesh(ringGeo, coreMat);
      ring1.position.y = 2.5;
      obeliskGroup.add(ring1);

      const ring2 = new THREE.Mesh(ringGeo, coreMat);
      ring2.position.y = 5.2;
      obeliskGroup.add(ring2);

      parent.add(obeliskGroup);
      structures.push(obeliskGroup);
    }

    // Monólito Central (Núcleo)
    const centralGroup = new THREE.Group();
    centralGroup.position.set(0, 0, 0);

    const coreGeo = new THREE.CylinderGeometry(1.4, 1.8, 8.5, 8);
    const centralCore = new THREE.Mesh(coreGeo, obeliskMat);
    centralCore.position.y = 4.25;
    centralCore.castShadow = true;
    centralGroup.add(centralCore);

    const pulsarGeo = new THREE.CylinderGeometry(0.7, 0.7, 9.0, 16);
    const pulsar = new THREE.Mesh(pulsarGeo, coreMat);
    pulsar.position.y = 4.25;
    centralGroup.add(pulsar);

    parent.add(centralGroup);
    structures.push(centralGroup);
  }

  private static buildNeonCyberRamps(
    parent: THREE.Group,
    structures: THREE.Object3D[],
  ): void {
    const rampMat = new THREE.MeshStandardMaterial({
      color: 0x1e293b,
      roughness: 0.3,
      metalness: 0.6,
    });
    const chevronMat = new THREE.MeshStandardMaterial({
      color: 0x00f0ff,
      emissive: 0x00f0ff,
      emissiveIntensity: 2.2,
    });

    const ramps = [
      { x: 0, z: -28, rotY: 0 },
      { x: 0, z: 28, rotY: Math.PI },
      { x: -28, z: 0, rotY: -Math.PI / 2 },
      { x: 28, z: 0, rotY: Math.PI / 2 },
    ];

    for (const r of ramps) {
      const rampGroup = new THREE.Group();
      rampGroup.position.set(r.x, 0, r.z);
      rampGroup.rotation.y = r.rotY;

      // Rampa angulada de blocos
      const rampGeo = new THREE.BoxGeometry(4.0, 0.4, 6.0);
      const rampMesh = new THREE.Mesh(rampGeo, rampMat);
      rampMesh.rotation.x = -0.22;
      rampMesh.position.set(0, 0.65, 0);
      rampMesh.castShadow = true;
      rampMesh.receiveShadow = true;
      rampGroup.add(rampMesh);

      // Setas de aceleração luminosa (Chevrons)
      for (let cz = -1.8; cz <= 1.8; cz += 1.2) {
        const chevGeo = new THREE.BoxGeometry(2.4, 0.08, 0.35);
        const chev = new THREE.Mesh(chevGeo, chevronMat);
        chev.rotation.x = -0.22;
        chev.position.set(0, 0.7 + (cz + 1.8) * 0.22, cz);
        rampGroup.add(chev);
      }

      parent.add(rampGroup);
      structures.push(rampGroup);
    }
  }

  private static buildNeonCyberPillars(
    parent: THREE.Group,
    structures: THREE.Object3D[],
  ): void {
    const pillarMat = new THREE.MeshStandardMaterial({
      color: 0x111827,
      roughness: 0.35,
      metalness: 0.7,
    });
    const neonPink = new THREE.MeshStandardMaterial({
      color: 0xf43f5e,
      emissive: 0xf43f5e,
      emissiveIntensity: 2.5,
    });

    const pillars = [
      { x: -38, z: -18 },
      { x: -38, z: 18 },
      { x: 38, z: -18 },
      { x: 38, z: 18 },
    ];

    for (const p of pillars) {
      const pGroup = new THREE.Group();
      pGroup.position.set(p.x, 0, p.z);

      const colGeo = new THREE.CylinderGeometry(0.8, 1.0, 5.5, 12);
      const colMesh = new THREE.Mesh(colGeo, pillarMat);
      colMesh.position.y = 2.75;
      colMesh.castShadow = true;
      pGroup.add(colMesh);

      const capGeo = new THREE.CylinderGeometry(1.2, 1.2, 0.3, 12);
      const capMesh = new THREE.Mesh(capGeo, neonPink);
      capMesh.position.y = 5.5;
      pGroup.add(capMesh);

      parent.add(pGroup);
      structures.push(pGroup);
    }
  }
}
