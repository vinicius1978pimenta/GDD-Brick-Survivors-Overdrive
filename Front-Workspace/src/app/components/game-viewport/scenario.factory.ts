import * as THREE from 'three';
import { ScenarioBuildResult, ScenarioThemeType } from './interfaces/scenario.interface';
import { CITY_OBSTACLES } from '../../core/engine/types/ecs.types';

/**
 * Fábrica de cenários temáticos 3D (Three.js) para a arena expandida de 140x140 metros.
 * Suporta:
 * 1. Co-op: Piso verde claro estilo grama vibrante LEGO com vilarejo/outpost e casas modulares.
 * 2. PvP: Piso cinza claro estilo cidade urbana com calçadas, faixas e prédios modulares de 2 e 3 andares com rampas e telhados acessíveis.
 */
export class ScenarioFactory {
  public static readonly ARENA_SIZE = 140;

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
      floorMesh = this.buildGrassOutpostFloor(group, studTexture);
      this.buildPerimeterWalls(group, structures, 0x16a34a, 0xfacc15);
      this.buildOutpostBuildings(group, structures);
      this.buildIndustrialContainers(group, structures);
      this.buildIndustrialBarricades(group, structures);
    } else {
      floorMesh = this.buildCityFloor(group);
      this.buildPerimeterWalls(group, structures, 0x475569, 0x38bdf8);
      this.buildCityBuildings(group, structures);
      this.buildCityStreetsAndMonuments(group, structures);
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

  // ==========================================
  // CENÁRIO 1: SOBREVIVÊNCIA CO-OP
  // Piso Verde Claro (Grama Vibrante LEGO) & Outpost Rural
  // ==========================================

  private static buildGrassOutpostFloor(
    parent: THREE.Group,
    studTexture?: THREE.CanvasTexture | null,
  ): THREE.Mesh {
    const size = this.ARENA_SIZE;
    const floorGeo = new THREE.BoxGeometry(size, 0.8, size);
    // Verde claro vibrante estilo grama LEGO
    const floorMat = new THREE.MeshStandardMaterial({
      color: 0x4ade80,
      roughness: 0.65,
      metalness: 0.05,
      ...(studTexture ? { map: studTexture } : {}),
    });
    const floor = new THREE.Mesh(floorGeo, floorMat);
    floor.position.set(0, -0.4, 0);
    floor.receiveShadow = true;
    parent.add(floor);

    // Grade sutil verde-escuro
    const grid = new THREE.GridHelper(size, 70, 0x15803d, 0x22c55e);
    grid.position.set(0, 0.01, 0);
    if (grid.material instanceof THREE.Material) {
      grid.material.opacity = 0.35;
      grid.material.transparent = true;
    }
    parent.add(grid);

    return floor;
  }

  // ==========================================
  // CENÁRIO 2: PVP DEATHMATCH
  // Piso Cinza Claro (Cidade Urbana/Asfalto) & Prédios de 2 e 3 Andares
  // ==========================================

  private static buildCityFloor(parent: THREE.Group): THREE.Mesh {
    const size = this.ARENA_SIZE;
    const floorGeo = new THREE.BoxGeometry(size, 0.8, size);
    // Asfalto cinza claro estilo cidade moderna
    const floorMat = new THREE.MeshStandardMaterial({
      color: 0x94a3b8,
      roughness: 0.45,
      metalness: 0.15,
    });
    const floor = new THREE.Mesh(floorGeo, floorMat);
    floor.position.set(0, -0.4, 0);
    floor.receiveShadow = true;
    parent.add(floor);

    // Grid urbano cinza e ciano
    const grid = new THREE.GridHelper(size, 70, 0xfacc15, 0x64748b);
    grid.position.set(0, 0.01, 0);
    if (grid.material instanceof THREE.Material) {
      grid.material.opacity = 0.4;
      grid.material.transparent = true;
    }
    parent.add(grid);

    return floor;
  }

  // ==========================================
  // MUROS PERIMETRAIS DA ARENA 140x140M
  // ==========================================

  private static buildPerimeterWalls(
    parent: THREE.Group,
    structures: THREE.Object3D[],
    wallColor: number,
    stripeColor: number,
  ): void {
    const size = this.ARENA_SIZE;
    const wallHeight = 2.0;
    const wallThickness = 1.4;

    const wallMat = new THREE.MeshStandardMaterial({
      color: wallColor,
      roughness: 0.4,
      metalness: 0.2,
    });
    const stripeMat = new THREE.MeshStandardMaterial({
      color: stripeColor,
      roughness: 0.3,
      metalness: 0.3,
    });

    const configs = [
      { size: [size, wallHeight, wallThickness], pos: [0, wallHeight / 2, -size / 2] },
      { size: [size, wallHeight, wallThickness], pos: [0, wallHeight / 2, size / 2] },
      { size: [wallThickness, wallHeight, size], pos: [-size / 2, wallHeight / 2, 0] },
      { size: [wallThickness, wallHeight, size], pos: [size / 2, wallHeight / 2, 0] },
    ];

    for (const c of configs) {
      const wallGroup = new THREE.Group();
      const wallMesh = new THREE.Mesh(new THREE.BoxGeometry(c.size[0], c.size[1], c.size[2]), wallMat);
      wallMesh.castShadow = true;
      wallMesh.receiveShadow = true;
      wallGroup.add(wallMesh);

      const isHorizontal = c.size[0] > c.size[2];
      const stripeGeo = new THREE.BoxGeometry(
        isHorizontal ? c.size[0] : c.size[0] + 0.1,
        0.35,
        isHorizontal ? c.size[2] + 0.1 : c.size[2],
      );
      const stripe = new THREE.Mesh(stripeGeo, stripeMat);
      stripe.position.y = 0.4;
      wallGroup.add(stripe);

      wallGroup.position.set(c.pos[0], c.pos[1], c.pos[2]);
      parent.add(wallGroup);
      structures.push(wallGroup);
    }
  }

  // ==========================================
  // PRÉDIOS E CASAS MODULARES DE 2 E 3 ANDARES
  // Com rampas e escadas para subir aos telhados!
  // ==========================================

  private static buildCityBuildings(parent: THREE.Group, structures: THREE.Object3D[]): void {
    const brickMatNavy = new THREE.MeshStandardMaterial({ color: 0x1e3a8a, roughness: 0.4, metalness: 0.1 });
    const brickMatAmber = new THREE.MeshStandardMaterial({ color: 0xb45309, roughness: 0.5, metalness: 0.1 });
    const brickMatTeal = new THREE.MeshStandardMaterial({ color: 0x0f766e, roughness: 0.4, metalness: 0.1 });
    const brickMatSlate = new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.5, metalness: 0.2 });
    const concreteRoofMat = new THREE.MeshStandardMaterial({ color: 0xe2e8f0, roughness: 0.3, metalness: 0.1 });
    const windowGlassMat = new THREE.MeshStandardMaterial({
      color: 0x38bdf8,
      roughness: 0.1,
      metalness: 0.9,
      emissive: 0x0284c7,
      emissiveIntensity: 0.4,
    });
    const rampMat = new THREE.MeshStandardMaterial({ color: 0xfacc15, roughness: 0.35, metalness: 0.2 });

    const buildingMaterials = [brickMatNavy, brickMatAmber, brickMatTeal, brickMatSlate];

    for (let i = 0; i < CITY_OBSTACLES.length; i++) {
      const obs = CITY_OBSTACLES[i];
      if (obs.id === 'monument_center') continue; // Tratado separadamente

      const width = obs.maxX - obs.minX;
      const depth = obs.maxZ - obs.minZ;
      const height = obs.roofHeight ?? 6.0;
      const centerX = (obs.minX + obs.maxX) / 2;
      const centerZ = (obs.minZ + obs.maxZ) / 2;

      const buildingGroup = new THREE.Group();
      buildingGroup.position.set(centerX, 0, centerZ);

      const mat = buildingMaterials[i % buildingMaterials.length];

      // 1. Corpo principal do Edifício de Blocos
      const bodyGeo = new THREE.BoxGeometry(width, height, depth);
      const bodyMesh = new THREE.Mesh(bodyGeo, mat);
      bodyMesh.position.y = height / 2;
      bodyMesh.castShadow = true;
      bodyMesh.receiveShadow = true;
      buildingGroup.add(bodyMesh);

      // 2. Telhado acessível com mureta de proteção balística
      const roofFloorGeo = new THREE.BoxGeometry(width + 0.3, 0.2, depth + 0.3);
      const roofFloor = new THREE.Mesh(roofFloorGeo, concreteRoofMat);
      roofFloor.position.y = height + 0.1;
      roofFloor.receiveShadow = true;
      buildingGroup.add(roofFloor);

      // Muretas perimetrais no telhado
      const parapetGeoX = new THREE.BoxGeometry(width + 0.3, 0.5, 0.3);
      const parapetNorth = new THREE.Mesh(parapetGeoX, concreteRoofMat);
      parapetNorth.position.set(0, height + 0.45, -depth / 2);
      buildingGroup.add(parapetNorth);

      const parapetSouth = new THREE.Mesh(parapetGeoX, concreteRoofMat);
      parapetSouth.position.set(0, height + 0.45, depth / 2);
      buildingGroup.add(parapetSouth);

      // 3. Janelas modulares de blocos azuis em múltiplos andares
      const floorsCount = Math.floor(height / 2.6);
      const windowsCountX = Math.max(2, Math.floor(width / 3.5));

      for (let f = 0; f < floorsCount; f++) {
        const floorY = 1.4 + f * 2.5;
        for (let w = 0; w < windowsCountX; w++) {
          const winX = -width / 2 + 1.2 + w * ((width - 2.4) / (windowsCountX - 1 || 1));
          const winMesh = new THREE.Mesh(new THREE.BoxGeometry(1.2, 1.0, 0.08), windowGlassMat);
          winMesh.position.set(winX, floorY, depth / 2 + 0.05);
          buildingGroup.add(winMesh);

          const winMeshBack = new THREE.Mesh(new THREE.BoxGeometry(1.2, 1.0, 0.08), windowGlassMat);
          winMeshBack.position.set(winX, floorY, -depth / 2 - 0.05);
          buildingGroup.add(winMeshBack);
        }
      }

      // 4. Rampa de Acesso ao Telhado (Escalabilidade Vertical para o Herói!)
      const rampLength = height * 1.8;
      const rampWidth = 2.4;
      const rampGeo = new THREE.BoxGeometry(rampWidth, 0.3, rampLength);
      const ramp = new THREE.Mesh(rampGeo, rampMat);
      const rampAngle = Math.atan2(height, rampLength);
      ramp.rotation.x = -rampAngle;
      ramp.position.set(width / 2 + rampWidth / 2 + 0.1, height / 2, 0);
      ramp.castShadow = true;
      ramp.receiveShadow = true;
      buildingGroup.add(ramp);

      parent.add(buildingGroup);
      structures.push(buildingGroup);
    }
  }

  // ==========================================
  // PRAÇAS, MONUMENTOS E RUAS URBANAS
  // ==========================================

  private static buildCityStreetsAndMonuments(parent: THREE.Group, structures: THREE.Object3D[]): void {
    const asphaltLineMat = new THREE.MeshStandardMaterial({
      color: 0xfef08a,
      roughness: 0.3,
      emissive: 0xfacc15,
      emissiveIntensity: 0.6,
    });
    const crosswalkMat = new THREE.MeshStandardMaterial({
      color: 0xf8fafc,
      roughness: 0.25,
      metalness: 0.1,
    });
    const monumentGoldMat = new THREE.MeshStandardMaterial({
      color: 0xf59e0b,
      roughness: 0.2,
      metalness: 0.85,
    });
    const monumentBaseMat = new THREE.MeshStandardMaterial({
      color: 0x0f172a,
      roughness: 0.4,
      metalness: 0.3,
    });

    // 1. Monumento da Praça Central
    const monGroup = new THREE.Group();
    monGroup.position.set(0, 0, -14.5);

    const monBase = new THREE.Mesh(new THREE.CylinderGeometry(4.2, 4.8, 0.8, 16), monumentBaseMat);
    monBase.position.y = 0.4;
    monBase.receiveShadow = true;
    monGroup.add(monBase);

    const monPillar = new THREE.Mesh(new THREE.BoxGeometry(1.6, 4.5, 1.6), monumentBaseMat);
    monPillar.position.y = 3.0;
    monPillar.castShadow = true;
    monGroup.add(monPillar);

    const monTrophy = new THREE.Mesh(new THREE.DodecahedronGeometry(1.4), monumentGoldMat);
    monTrophy.position.y = 5.8;
    monTrophy.castShadow = true;
    monGroup.add(monTrophy);

    parent.add(monGroup);
    structures.push(monGroup);

    // 2. Faixas de Trânsito Centrais
    const roadLineGeo = new THREE.BoxGeometry(0.3, 0.02, 110);
    const line1 = new THREE.Mesh(roadLineGeo, asphaltLineMat);
    line1.position.set(-18, 0.02, 0);
    parent.add(line1);

    const line2 = new THREE.Mesh(roadLineGeo, asphaltLineMat);
    line2.position.set(18, 0.02, 0);
    parent.add(line2);

    // 3. Faixas de Pedestres de Blocos (Crosswalk)
    for (let i = -4; i <= 4; i++) {
      const stripeMesh = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.03, 3.2), crosswalkMat);
      stripeMesh.position.set(i * 1.4, 0.02, 10);
      parent.add(stripeMesh);
    }
  }

  // ==========================================
  // CASAS E ARMAZÉNS DO OUTPOST (CO-OP)
  // ==========================================

  private static buildOutpostBuildings(parent: THREE.Group, structures: THREE.Object3D[]): void {
    const woodMat = new THREE.MeshStandardMaterial({ color: 0x78350f, roughness: 0.7 });
    const barnRoofMat = new THREE.MeshStandardMaterial({ color: 0xb91c1c, roughness: 0.4 });
    const metalMat = new THREE.MeshStandardMaterial({ color: 0x475569, roughness: 0.4, metalness: 0.5 });
    const rampMat = new THREE.MeshStandardMaterial({ color: 0xd97706, roughness: 0.5 });

    const outpostHouses = [
      { x: -35, z: -35, w: 12, h: 5.4, d: 10, rot: 0 },
      { x: 35, z: -35, w: 12, h: 5.4, d: 10, rot: 0 },
      { x: -35, z: 35, w: 14, h: 5.8, d: 11, rot: Math.PI / 4 },
      { x: 35, z: 35, w: 14, h: 5.8, d: 11, rot: -Math.PI / 4 },
    ];

    for (const h of outpostHouses) {
      const houseGroup = new THREE.Group();
      houseGroup.position.set(h.x, 0, h.z);
      houseGroup.rotation.y = h.rot;

      // Paredes de blocos rurais
      const houseMesh = new THREE.Mesh(new THREE.BoxGeometry(h.w, h.h, h.d), woodMat);
      houseMesh.position.y = h.h / 2;
      houseMesh.castShadow = true;
      houseMesh.receiveShadow = true;
      houseGroup.add(houseMesh);

      // Telhado estilo celeiro com plataforma
      const roofMesh = new THREE.Mesh(new THREE.BoxGeometry(h.w + 0.6, 0.4, h.d + 0.6), barnRoofMat);
      roofMesh.position.y = h.h + 0.2;
      roofMesh.receiveShadow = true;
      houseGroup.add(roofMesh);

      // Escada/Rampa lateral de acesso ao telhado
      const rampLen = h.h * 1.8;
      const rampGeo = new THREE.BoxGeometry(2.0, 0.25, rampLen);
      const ramp = new THREE.Mesh(rampGeo, rampMat);
      ramp.rotation.x = -Math.atan2(h.h, rampLen);
      ramp.position.set(h.w / 2 + 1.1, h.h / 2, 0);
      ramp.castShadow = true;
      houseGroup.add(ramp);

      parent.add(houseGroup);
      structures.push(houseGroup);
    }
  }

  private static buildIndustrialContainers(
    parent: THREE.Group,
    structures: THREE.Object3D[],
  ): void {
    const redMat = new THREE.MeshStandardMaterial({ color: 0xb91c1c, roughness: 0.35, metalness: 0.3 });
    const blueMat = new THREE.MeshStandardMaterial({ color: 0x1d4ed8, roughness: 0.35, metalness: 0.3 });
    const yellowMat = new THREE.MeshStandardMaterial({ color: 0xd97706, roughness: 0.35, metalness: 0.3 });

    const containerConfigs = [
      { x: -16, z: -18, rot: 0.2, mat: redMat },
      { x: 16, z: -18, rot: -0.2, mat: blueMat },
      { x: -16, z: 18, rot: -0.3, mat: yellowMat },
      { x: 16, z: 18, rot: 0.3, mat: redMat },
      { x: 0, z: 28, rot: Math.PI / 2, mat: blueMat },
    ];

    for (const c of containerConfigs) {
      const containerGroup = new THREE.Group();
      containerGroup.position.set(c.x, 0, c.z);
      containerGroup.rotation.y = c.rot;

      const bodyGeo = new THREE.BoxGeometry(2.4, 2.2, 5.2);
      const body = new THREE.Mesh(bodyGeo, c.mat);
      body.position.y = 1.1;
      body.castShadow = true;
      body.receiveShadow = true;
      containerGroup.add(body);

      parent.add(containerGroup);
      structures.push(containerGroup);
    }
  }

  private static buildIndustrialBarricades(
    parent: THREE.Group,
    structures: THREE.Object3D[],
  ): void {
    const barrierMat = new THREE.MeshStandardMaterial({ color: 0x475569, roughness: 0.6, metalness: 0.2 });
    const stripeMat = new THREE.MeshStandardMaterial({ color: 0xfacc15, roughness: 0.4 });

    const barricadePositions = [
      { x: -10, z: -8, rot: 0.4 },
      { x: 10, z: -8, rot: -0.4 },
      { x: -10, z: 8, rot: -0.4 },
      { x: 10, z: 8, rot: 0.4 },
    ];

    for (const b of barricadePositions) {
      const bGroup = new THREE.Group();
      bGroup.position.set(b.x, 0, b.z);
      bGroup.rotation.y = b.rot;

      const base = new THREE.Mesh(new THREE.BoxGeometry(3.6, 1.0, 0.7), barrierMat);
      base.position.y = 0.5;
      base.castShadow = true;
      bGroup.add(base);

      const topStripe = new THREE.Mesh(new THREE.BoxGeometry(3.6, 0.25, 0.72), stripeMat);
      topStripe.position.y = 0.85;
      bGroup.add(topStripe);

      parent.add(bGroup);
      structures.push(bGroup);
    }
  }
}
