import * as THREE from 'three';
import { EnemyType } from './interfaces/match.interface';

/**
 * Cria malhas 3D no tema LEGO/blocos para os inimigos da Fase 7.
 */
export function createEnemyMesh(type: EnemyType): THREE.Group {
  const root = new THREE.Group();

  switch (type) {
    case 'scout_block':
      buildScoutBlockMesh(root);
      break;
    case 'brute_rammer':
      buildBruteRammerMesh(root);
      break;
    case 'swarm_buggy':
      buildSwarmBuggyMesh(root);
      break;
  }

  return root;
}

/**
 * Scout Block: Cubo aerodinâmico ágil com visor holográfico vermelho e propulsores.
 */
function buildScoutBlockMesh(group: THREE.Group): void {
  // Corpo cúbico de bloco LEGO vermelho/laranja
  const bodyGeo = new THREE.BoxGeometry(0.85, 0.85, 0.85);
  const bodyMat = new THREE.MeshStandardMaterial({
    color: 0xef4444,
    roughness: 0.3,
    metalness: 0.1,
  });
  const bodyMesh = new THREE.Mesh(bodyGeo, bodyMat);
  bodyMesh.position.y = 0.55;
  bodyMesh.castShadow = true;
  bodyMesh.receiveShadow = true;
  group.add(bodyMesh);

  // 4 Pinos (studs LEGO) no topo
  const studGeo = new THREE.CylinderGeometry(0.12, 0.12, 0.12, 12);
  const studMat = new THREE.MeshStandardMaterial({
    color: 0xdc2626,
    roughness: 0.35,
    metalness: 0.1,
  });

  const studOffsets = [
    [-0.22, 0.22],
    [0.22, 0.22],
    [-0.22, -0.22],
    [0.22, -0.22],
  ];

  for (const [ox, oz] of studOffsets) {
    const stud = new THREE.Mesh(studGeo, studMat);
    stud.position.set(ox, 1.02, oz);
    stud.castShadow = true;
    group.add(stud);
  }

  // Visor holográfico vermelho neon emissivo na face frontal (+Z)
  const visorGeo = new THREE.BoxGeometry(0.65, 0.2, 0.08);
  const visorMat = new THREE.MeshStandardMaterial({
    color: 0xff0044,
    emissive: 0xff0055,
    emissiveIntensity: 1.8,
    roughness: 0.2,
  });
  const visorMesh = new THREE.Mesh(visorGeo, visorMat);
  visorMesh.position.set(0, 0.6, 0.45);
  group.add(visorMesh);

  // Propulsores duplos na traseira (-Z)
  const thrusterGeo = new THREE.CylinderGeometry(0.12, 0.14, 0.3, 12);
  const thrusterMat = new THREE.MeshStandardMaterial({
    color: 0x334155,
    roughness: 0.4,
    metalness: 0.5,
  });
  const glowGeo = new THREE.CylinderGeometry(0.08, 0.08, 0.06, 12);
  const glowMat = new THREE.MeshStandardMaterial({
    color: 0x00f5ff,
    emissive: 0x00f5ff,
    emissiveIntensity: 2.2,
  });

  for (const ox of [-0.24, 0.24]) {
    const thruster = new THREE.Mesh(thrusterGeo, thrusterMat);
    thruster.rotation.x = Math.PI / 2;
    thruster.position.set(ox, 0.55, -0.5);
    thruster.castShadow = true;
    group.add(thruster);

    const glow = new THREE.Mesh(glowGeo, glowMat);
    glow.rotation.x = Math.PI / 2;
    glow.position.set(ox, 0.55, -0.65);
    group.add(glow);
  }
}

/**
 * Brute Rammer: Mecha/tanque pesado de blocos com aríete frontal pontiagudo e blindagem escura.
 */
function buildBruteRammerMesh(group: THREE.Group): void {
  // Chassi pesado de blocos chumbo/grafite
  const baseGeo = new THREE.BoxGeometry(1.6, 0.9, 1.8);
  const baseMat = new THREE.MeshStandardMaterial({
    color: 0x1e293b,
    roughness: 0.4,
    metalness: 0.25,
  });
  const baseMesh = new THREE.Mesh(baseGeo, baseMat);
  baseMesh.position.y = 0.55;
  baseMesh.castShadow = true;
  baseMesh.receiveShadow = true;
  group.add(baseMesh);

  // Placas de blindagem lateral nos ombros
  const armorGeo = new THREE.BoxGeometry(0.25, 0.7, 1.4);
  const armorMat = new THREE.MeshStandardMaterial({
    color: 0x0f172a,
    roughness: 0.35,
    metalness: 0.3,
  });

  const leftArmor = new THREE.Mesh(armorGeo, armorMat);
  leftArmor.position.set(-0.9, 0.65, 0);
  leftArmor.castShadow = true;
  group.add(leftArmor);

  const rightArmor = new THREE.Mesh(armorGeo, armorMat);
  rightArmor.position.set(0.9, 0.65, 0);
  rightArmor.castShadow = true;
  group.add(rightArmor);

  // Torre superior reforçada com luzes de advertência
  const turretGeo = new THREE.BoxGeometry(0.9, 0.5, 0.9);
  const turretMat = new THREE.MeshStandardMaterial({
    color: 0x334155,
    roughness: 0.35,
    metalness: 0.2,
  });
  const turret = new THREE.Mesh(turretGeo, turretMat);
  turret.position.set(0, 1.25, -0.15);
  turret.castShadow = true;
  group.add(turret);

  // Luz de perigo amarela/âmbar no topo da torre
  const beaconGeo = new THREE.CylinderGeometry(0.12, 0.12, 0.15, 8);
  const beaconMat = new THREE.MeshStandardMaterial({
    color: 0xf59e0b,
    emissive: 0xf59e0b,
    emissiveIntensity: 1.6,
  });
  const beacon = new THREE.Mesh(beaconGeo, beaconMat);
  beacon.position.set(0, 1.55, -0.15);
  group.add(beacon);

  // Aríete frontal pontiagudo estilo cunha/rammer LEGO (+Z)
  const rammerGeo = new THREE.ConeGeometry(0.45, 0.85, 4);
  const rammerMat = new THREE.MeshStandardMaterial({
    color: 0x94a3b8,
    roughness: 0.25,
    metalness: 0.6,
  });
  const rammer = new THREE.Mesh(rammerGeo, rammerMat);
  rammer.rotation.x = Math.PI / 2;
  rammer.rotation.y = Math.PI / 4;
  rammer.position.set(0, 0.55, 1.3);
  rammer.castShadow = true;
  group.add(rammer);

  // Pinos de fixação no teto da blindagem
  const studGeo = new THREE.CylinderGeometry(0.14, 0.14, 0.12, 10);
  const studMat = new THREE.MeshStandardMaterial({ color: 0x475569 });
  for (const ox of [-0.4, 0.4]) {
    for (const oz of [-0.6, 0.4]) {
      const stud = new THREE.Mesh(studGeo, studMat);
      stud.position.set(ox, 1.05, oz);
      stud.castShadow = true;
      group.add(stud);
    }
  }
}

/**
 * Swarm Buggy: Buggy leve hostil de blocos com rodas pretas e cano de disparo.
 */
function buildSwarmBuggyMesh(group: THREE.Group): void {
  // Chassi de blocos roxo/magenta hostil
  const chassisGeo = new THREE.BoxGeometry(1.1, 0.45, 1.5);
  const chassisMat = new THREE.MeshStandardMaterial({
    color: 0xa855f7,
    roughness: 0.3,
    metalness: 0.15,
  });
  const chassis = new THREE.Mesh(chassisGeo, chassisMat);
  chassis.position.y = 0.4;
  chassis.castShadow = true;
  chassis.receiveShadow = true;
  group.add(chassis);

  // Cabine / Cockpit reforçado translúcido escuro
  const cabinGeo = new THREE.BoxGeometry(0.75, 0.4, 0.7);
  const cabinMat = new THREE.MeshStandardMaterial({
    color: 0x18181b,
    roughness: 0.2,
    metalness: 0.4,
  });
  const cabin = new THREE.Mesh(cabinGeo, cabinMat);
  cabin.position.set(0, 0.75, -0.1);
  cabin.castShadow = true;
  group.add(cabin);

  // Cano duplo de disparo hostil no teto (+Z)
  const barrelGeo = new THREE.CylinderGeometry(0.06, 0.06, 0.65, 8);
  const barrelMat = new THREE.MeshStandardMaterial({
    color: 0x27272a,
    metalness: 0.7,
    roughness: 0.3,
  });

  for (const ox of [-0.18, 0.18]) {
    const barrel = new THREE.Mesh(barrelGeo, barrelMat);
    barrel.rotation.x = Math.PI / 2;
    barrel.position.set(ox, 0.85, 0.45);
    barrel.castShadow = true;
    group.add(barrel);
  }

  // 4 Rodas pretas de blocos com aros cinzas
  const wheelGeo = new THREE.CylinderGeometry(0.24, 0.24, 0.18, 14);
  const wheelMat = new THREE.MeshStandardMaterial({
    color: 0x09090b,
    roughness: 0.7,
    metalness: 0.1,
  });
  const rimGeo = new THREE.CylinderGeometry(0.12, 0.12, 0.19, 10);
  const rimMat = new THREE.MeshStandardMaterial({
    color: 0x71717a,
    roughness: 0.3,
    metalness: 0.5,
  });

  const wheelPositions = [
    [-0.62, 0.25, 0.5],
    [0.62, 0.25, 0.5],
    [-0.62, 0.25, -0.5],
    [0.62, 0.25, -0.5],
  ];

  for (const [wx, wy, wz] of wheelPositions) {
    const wheel = new THREE.Mesh(wheelGeo, wheelMat);
    wheel.rotation.z = Math.PI / 2;
    wheel.position.set(wx, wy, wz);
    wheel.castShadow = true;
    group.add(wheel);

    const rim = new THREE.Mesh(rimGeo, rimMat);
    rim.rotation.z = Math.PI / 2;
    rim.position.set(wx, wy, wz);
    group.add(rim);
  }
}
