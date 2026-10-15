import * as THREE from 'three';
import { CharacterType, CHARACTER_PROFILES } from '../../core/engine/types/character.types';

export interface CharacterMeshResult {
  group: THREE.Group;
  leftLegPivot: THREE.Group;
  rightLegPivot: THREE.Group;
  leftArmPivot: THREE.Group;
  rightArmPivot: THREE.Group;
  head: THREE.Mesh;
  torso: THREE.Mesh;
}

/**
 * Fábrica procedural de modelos 3D dos 4 personagens selecionáveis do tema LEGO.
 * Garante hierarquia idêntica de pivôs para animações uniformes de caminhada, mira e condução.
 */
export class CharacterMeshFactory {
  public static createCharacterMesh(
    type: CharacterType = 'hobo_lego',
    isLocal = false,
  ): CharacterMeshResult {
    switch (type) {
      case 'hillbilly_girl':
        return this.createHillbillyGirl(isLocal);
      case 'funny_indigenous':
        return this.createFunnyIndigenous(isLocal);
      case 'black_shorts':
        return this.createBlackShorts(isLocal);
      case 'hobo_lego':
      default:
        return this.createHoboLego(isLocal);
    }
  }

  // ==========================================
  // 1. MENDIGO VESGO (hobo_lego)
  // Roupas remendadas, barba rala, olhos estrábicos
  // ==========================================
  private static createHoboLego(isLocal: boolean): CharacterMeshResult {
    const group = new THREE.Group();
    group.name = 'char_hobo_lego';

    const skinMat = new THREE.MeshStandardMaterial({ color: 0xfcd116, roughness: 0.4, metalness: 0.05 });
    const jacketMat = new THREE.MeshStandardMaterial({ color: 0x573c24, roughness: 0.6, metalness: 0.1 });
    const patchMat = new THREE.MeshStandardMaterial({ color: 0x475569, roughness: 0.6, metalness: 0.1 });
    const beardMat = new THREE.MeshStandardMaterial({ color: 0x3e2723, roughness: 0.8, metalness: 0.05 });
    const eyeWhiteMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.2 });
    const pupilMat = new THREE.MeshStandardMaterial({ color: 0x09090b, roughness: 0.1 });
    const pantsMat = new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.5, metalness: 0.1 });
    const kneePatchMat = new THREE.MeshStandardMaterial({ color: 0xb45309, roughness: 0.6, metalness: 0.1 });

    // Pernas com remendos
    const legGeo = new THREE.BoxGeometry(0.38, 0.9, 0.45);

    const leftLegPivot = new THREE.Group();
    leftLegPivot.position.set(-0.25, 0.9, 0);
    const leftLeg = new THREE.Mesh(legGeo, pantsMat);
    leftLeg.position.set(0, -0.45, 0);
    leftLeg.castShadow = true;
    leftLegPivot.add(leftLeg);

    // Remendo no joelho esquerdo
    const patchLeftGeo = new THREE.BoxGeometry(0.24, 0.24, 0.06);
    const patchLeft = new THREE.Mesh(patchLeftGeo, kneePatchMat);
    patchLeft.position.set(0, -0.45, 0.23);
    leftLegPivot.add(patchLeft);
    group.add(leftLegPivot);

    const rightLegPivot = new THREE.Group();
    rightLegPivot.position.set(0.25, 0.9, 0);
    const rightLeg = new THREE.Mesh(legGeo, pantsMat);
    rightLeg.position.set(0, -0.45, 0);
    rightLeg.castShadow = true;
    rightLegPivot.add(rightLeg);
    group.add(rightLegPivot);

    // Quadril
    const hipsGeo = new THREE.BoxGeometry(0.92, 0.25, 0.5);
    const hips = new THREE.Mesh(hipsGeo, jacketMat);
    hips.position.set(0, 0.98, 0);
    hips.castShadow = true;
    group.add(hips);

    // Tronco (Jaqueta com retalhos)
    const torsoGeo = new THREE.BoxGeometry(1.0, 1.1, 0.6);
    const torso = new THREE.Mesh(torsoGeo, jacketMat);
    torso.position.set(0, 1.65, 0);
    torso.castShadow = true;

    // Retalho de pano no peito
    const chestPatchGeo = new THREE.BoxGeometry(0.35, 0.35, 0.04);
    const chestPatch = new THREE.Mesh(chestPatchGeo, patchMat);
    chestPatch.position.set(0.2, 0.1, 0.31);
    torso.add(chestPatch);
    group.add(torso);

    // Cabeça
    const headGeo = new THREE.CylinderGeometry(0.36, 0.36, 0.6, 16);
    const head = new THREE.Mesh(headGeo, skinMat);
    head.position.set(0, 2.45, 0);
    head.castShadow = true;
    group.add(head);

    // Pino clássico LEGO no topo da cabeça
    const studGeo = new THREE.CylinderGeometry(0.16, 0.16, 0.16, 12);
    const headStud = new THREE.Mesh(studGeo, skinMat);
    headStud.position.set(0, 2.82, 0);
    headStud.castShadow = true;
    group.add(headStud);

    // Barba rala pontilhada no queixo
    const beardGeo = new THREE.BoxGeometry(0.5, 0.22, 0.18);
    const beard = new THREE.Mesh(beardGeo, beardMat);
    beard.position.set(0, 2.25, 0.26);
    group.add(beard);

    // Olhos Estrábicos (Vesgo)
    // Olho esquerdo apontando para dentro (para a direita do rosto)
    const eyeGeo = new THREE.BoxGeometry(0.14, 0.14, 0.04);
    const pupilGeo = new THREE.BoxGeometry(0.06, 0.06, 0.05);

    const leftEyeWhite = new THREE.Mesh(eyeGeo, eyeWhiteMat);
    leftEyeWhite.position.set(-0.16, 2.52, 0.35);
    group.add(leftEyeWhite);
    const leftPupil = new THREE.Mesh(pupilGeo, pupilMat);
    leftPupil.position.set(-0.13, 2.52, 0.36); // pupila deslocada para o centro
    group.add(leftPupil);

    // Olho direito apontando para fora/alto
    const rightEyeWhite = new THREE.Mesh(eyeGeo, eyeWhiteMat);
    rightEyeWhite.position.set(0.16, 2.52, 0.35);
    group.add(rightEyeWhite);
    const rightPupil = new THREE.Mesh(pupilGeo, pupilMat);
    rightPupil.position.set(0.19, 2.56, 0.36); // pupila deslocada para fora e cima
    group.add(rightPupil);

    // Braços
    const armGeo = new THREE.BoxGeometry(0.26, 0.85, 0.3);

    const leftArmPivot = new THREE.Group();
    leftArmPivot.position.set(-0.68, 2.05, 0);
    const leftArm = new THREE.Mesh(armGeo, jacketMat);
    leftArm.position.set(0, -0.4, 0);
    leftArm.castShadow = true;
    leftArmPivot.add(leftArm);
    group.add(leftArmPivot);

    const rightArmPivot = new THREE.Group();
    rightArmPivot.position.set(0.68, 2.05, 0);
    const rightArm = new THREE.Mesh(armGeo, jacketMat);
    rightArm.position.set(0, -0.4, 0);
    rightArm.castShadow = true;
    rightArmPivot.add(rightArm);
    group.add(rightArmPivot);

    group.userData = { leftLegPivot, rightLegPivot, leftArmPivot, rightArmPivot, head, torso };
    return { group, leftLegPivot, rightLegPivot, leftArmPivot, rightArmPivot, head, torso };
  }

  // ==========================================
  // 2. MENINA LOIRA CAIPIRA SEM DENTE (hillbilly_girl)
  // Maria-chiquinhas, chapéu de palha, macacão jeans, sorriso banguela
  // ==========================================
  private static createHillbillyGirl(isLocal: boolean): CharacterMeshResult {
    const group = new THREE.Group();
    group.name = 'char_hillbilly_girl';

    const skinMat = new THREE.MeshStandardMaterial({ color: 0xfef08a, roughness: 0.35, metalness: 0.05 });
    const hairMat = new THREE.MeshStandardMaterial({ color: 0xfde047, roughness: 0.4, metalness: 0.1 });
    const strawMat = new THREE.MeshStandardMaterial({ color: 0xfef3c7, roughness: 0.6, metalness: 0.1 });
    const strawRibbonMat = new THREE.MeshStandardMaterial({ color: 0xd97706, roughness: 0.4 });
    const overallsMat = new THREE.MeshStandardMaterial({ color: 0x1d4ed8, roughness: 0.4, metalness: 0.1 });
    const shirtMat = new THREE.MeshStandardMaterial({ color: 0xf97316, roughness: 0.5 });
    const bootsMat = new THREE.MeshStandardMaterial({ color: 0x78350f, roughness: 0.5 });
    const eyeMat = new THREE.MeshStandardMaterial({ color: 0x0284c7, roughness: 0.2 });
    const toothGapMat = new THREE.MeshStandardMaterial({ color: 0x18181b, roughness: 0.9 });
    const toothWhiteMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.2 });

    // Pernas (Macacão Jeans + Botinas)
    const legGeo = new THREE.BoxGeometry(0.38, 0.7, 0.45);
    const bootGeo = new THREE.BoxGeometry(0.4, 0.22, 0.5);

    const leftLegPivot = new THREE.Group();
    leftLegPivot.position.set(-0.25, 0.9, 0);
    const leftLeg = new THREE.Mesh(legGeo, overallsMat);
    leftLeg.position.set(0, -0.35, 0);
    leftLeg.castShadow = true;
    leftLegPivot.add(leftLeg);
    const leftBoot = new THREE.Mesh(bootGeo, bootsMat);
    leftBoot.position.set(0, -0.79, 0.03);
    leftLegPivot.add(leftBoot);
    group.add(leftLegPivot);

    const rightLegPivot = new THREE.Group();
    rightLegPivot.position.set(0.25, 0.9, 0);
    const rightLeg = new THREE.Mesh(legGeo, overallsMat);
    rightLeg.position.set(0, -0.35, 0);
    rightLeg.castShadow = true;
    rightLegPivot.add(rightLeg);
    const rightBoot = new THREE.Mesh(bootGeo, bootsMat);
    rightBoot.position.set(0, -0.79, 0.03);
    rightLegPivot.add(rightBoot);
    group.add(rightLegPivot);

    // Quadril
    const hipsGeo = new THREE.BoxGeometry(0.92, 0.25, 0.5);
    const hips = new THREE.Mesh(hipsGeo, overallsMat);
    hips.position.set(0, 0.98, 0);
    group.add(hips);

    // Tronco (Camisa Laranja sob Macacão Jeans com Alças)
    const torsoGeo = new THREE.BoxGeometry(1.0, 1.1, 0.6);
    const torso = new THREE.Mesh(torsoGeo, shirtMat);
    torso.position.set(0, 1.65, 0);
    torso.castShadow = true;

    // Alças do Macacão
    const strapGeo = new THREE.BoxGeometry(0.18, 1.12, 0.62);
    const strapL = new THREE.Mesh(strapGeo, overallsMat);
    strapL.position.set(-0.28, 0, 0);
    torso.add(strapL);
    const strapR = new THREE.Mesh(strapGeo, overallsMat);
    strapR.position.set(0.28, 0, 0);
    torso.add(strapR);

    // Babador do macacão
    const bibGeo = new THREE.BoxGeometry(0.65, 0.65, 0.06);
    const bib = new THREE.Mesh(bibGeo, overallsMat);
    bib.position.set(0, -0.15, 0.31);
    torso.add(bib);
    group.add(torso);

    // Cabeça
    const headGeo = new THREE.CylinderGeometry(0.36, 0.36, 0.6, 16);
    const head = new THREE.Mesh(headGeo, skinMat);
    head.position.set(0, 2.45, 0);
    head.castShadow = true;
    group.add(head);

    // Olhos alegres
    const eyeGeo = new THREE.BoxGeometry(0.08, 0.12, 0.04);
    const eyeL = new THREE.Mesh(eyeGeo, eyeMat);
    eyeL.position.set(-0.16, 2.52, 0.36);
    group.add(eyeL);
    const eyeR = new THREE.Mesh(eyeGeo, eyeMat);
    eyeR.position.set(0.16, 2.52, 0.36);
    group.add(eyeR);

    // Sorriso Banguela (Dente com falha no meio)
    const mouthBack = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.1, 0.03), toothGapMat);
    mouthBack.position.set(0, 2.32, 0.36);
    group.add(mouthBack);
    // Dente esquerdo
    const toothL = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.08, 0.04), toothWhiteMat);
    toothL.position.set(-0.08, 2.33, 0.37);
    group.add(toothL);
    // (Falta dente no meio: espaço vazio preto!)
    // Dente direito
    const toothR = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.08, 0.04), toothWhiteMat);
    toothR.position.set(0.08, 2.33, 0.37);
    group.add(toothR);

    // Maria-Chiquinhas Loiras (Tranças Laterais)
    const pigtailGeo = new THREE.CylinderGeometry(0.12, 0.08, 0.55, 8);
    const pigtailL = new THREE.Mesh(pigtailGeo, hairMat);
    pigtailL.position.set(-0.46, 2.3, 0);
    pigtailL.rotation.z = Math.PI / 8;
    group.add(pigtailL);

    const pigtailR = new THREE.Mesh(pigtailGeo, hairMat);
    pigtailR.position.set(0.46, 2.3, 0);
    pigtailR.rotation.z = -Math.PI / 8;
    group.add(pigtailR);

    // Chapéu de Palha de Blocos
    const brimGeo = new THREE.CylinderGeometry(0.72, 0.72, 0.08, 16);
    const brim = new THREE.Mesh(brimGeo, strawMat);
    brim.position.set(0, 2.76, 0);
    group.add(brim);

    const crownGeo = new THREE.CylinderGeometry(0.4, 0.44, 0.3, 14);
    const crown = new THREE.Mesh(crownGeo, strawMat);
    crown.position.set(0, 2.92, 0);
    group.add(crown);

    const ribbonGeo = new THREE.CylinderGeometry(0.42, 0.42, 0.08, 14);
    const ribbon = new THREE.Mesh(ribbonGeo, strawRibbonMat);
    ribbon.position.set(0, 2.82, 0);
    group.add(ribbon);

    // Braços
    const armGeo = new THREE.BoxGeometry(0.26, 0.85, 0.3);

    const leftArmPivot = new THREE.Group();
    leftArmPivot.position.set(-0.68, 2.05, 0);
    const leftArm = new THREE.Mesh(armGeo, shirtMat);
    leftArm.position.set(0, -0.4, 0);
    leftArm.castShadow = true;
    leftArmPivot.add(leftArm);
    group.add(leftArmPivot);

    const rightArmPivot = new THREE.Group();
    rightArmPivot.position.set(0.68, 2.05, 0);
    const rightArm = new THREE.Mesh(armGeo, shirtMat);
    rightArm.position.set(0, -0.4, 0);
    rightArm.castShadow = true;
    rightArmPivot.add(rightArm);
    group.add(rightArmPivot);

    group.userData = { leftLegPivot, rightLegPivot, leftArmPivot, rightArmPivot, head, torso };
    return { group, leftLegPivot, rightLegPivot, leftArmPivot, rightArmPivot, head, torso };
  }

  // ==========================================
  // 3. ÍNDIO ENGRAÇADO (funny_indigenous)
  // Cocar com penas coloridas, pintura tribal, tanga de blocos
  // ==========================================
  private static createFunnyIndigenous(isLocal: boolean): CharacterMeshResult {
    const group = new THREE.Group();
    group.name = 'char_funny_indigenous';

    const skinMat = new THREE.MeshStandardMaterial({ color: 0xd97706, roughness: 0.45, metalness: 0.05 });
    const loinclothMat = new THREE.MeshStandardMaterial({ color: 0x92400e, roughness: 0.6 });
    const redFeatherMat = new THREE.MeshStandardMaterial({ color: 0xef4444, roughness: 0.3 });
    const blueFeatherMat = new THREE.MeshStandardMaterial({ color: 0x3b82f6, roughness: 0.3 });
    const yellowFeatherMat = new THREE.MeshStandardMaterial({ color: 0xfacc15, roughness: 0.3 });
    const bandMat = new THREE.MeshStandardMaterial({ color: 0x78350f, roughness: 0.5 });
    const tribalRedMat = new THREE.MeshStandardMaterial({ color: 0xdc2626, roughness: 0.3 });
    const toothMat = new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.2 });

    // Pernas (Bronzeadas com tornozeleiras)
    const legGeo = new THREE.BoxGeometry(0.38, 0.9, 0.45);

    const leftLegPivot = new THREE.Group();
    leftLegPivot.position.set(-0.25, 0.9, 0);
    const leftLeg = new THREE.Mesh(legGeo, skinMat);
    leftLeg.position.set(0, -0.45, 0);
    leftLeg.castShadow = true;
    leftLegPivot.add(leftLeg);
    group.add(leftLegPivot);

    const rightLegPivot = new THREE.Group();
    rightLegPivot.position.set(0.25, 0.9, 0);
    const rightLeg = new THREE.Mesh(legGeo, skinMat);
    rightLeg.position.set(0, -0.45, 0);
    rightLeg.castShadow = true;
    rightLegPivot.add(rightLeg);
    group.add(rightLegPivot);

    // Tanga de Blocos Rústica
    const hipsGeo = new THREE.BoxGeometry(0.92, 0.32, 0.5);
    const hips = new THREE.Mesh(hipsGeo, loinclothMat);
    hips.position.set(0, 0.95, 0);
    group.add(hips);

    // Tronco Bronzeado com Pinturas Tribais
    const torsoGeo = new THREE.BoxGeometry(1.0, 1.1, 0.6);
    const torso = new THREE.Mesh(torsoGeo, skinMat);
    torso.position.set(0, 1.65, 0);
    torso.castShadow = true;

    // Colar de Dentes de Blocos
    const necklaceGeo = new THREE.TorusGeometry(0.32, 0.05, 6, 12);
    const necklace = new THREE.Mesh(necklaceGeo, toothMat);
    necklace.position.set(0, 0.46, 0.08);
    necklace.rotation.x = Math.PI / 2.3;
    torso.add(necklace);

    // Linhas de Pintura Vermelha no Peitoral
    const paintGeo = new THREE.BoxGeometry(0.7, 0.08, 0.04);
    const paint1 = new THREE.Mesh(paintGeo, tribalRedMat);
    paint1.position.set(0, 0.2, 0.31);
    torso.add(paint1);
    const paint2 = new THREE.Mesh(paintGeo, tribalRedMat);
    paint2.position.set(0, 0.02, 0.31);
    torso.add(paint2);
    group.add(torso);

    // Cabeça
    const headGeo = new THREE.CylinderGeometry(0.36, 0.36, 0.6, 16);
    const head = new THREE.Mesh(headGeo, skinMat);
    head.position.set(0, 2.45, 0);
    head.castShadow = true;
    group.add(head);

    // Pintura Facial Tribal (Bochechas Vermelhas)
    const facePaintGeo = new THREE.BoxGeometry(0.18, 0.06, 0.03);
    const fpL = new THREE.Mesh(facePaintGeo, tribalRedMat);
    fpL.position.set(-0.2, 2.42, 0.36);
    group.add(fpL);
    const fpR = new THREE.Mesh(facePaintGeo, tribalRedMat);
    fpR.position.set(0.2, 2.42, 0.36);
    group.add(fpR);

    // Faixa da Cabeça
    const headBandGeo = new THREE.CylinderGeometry(0.38, 0.38, 0.12, 16);
    const headBand = new THREE.Mesh(headBandGeo, bandMat);
    headBand.position.set(0, 2.7, 0);
    group.add(headBand);

    // Cocar de Penas Coloridas de Blocos (Vermelho, Amarelo, Azul)
    const featherGeo = new THREE.BoxGeometry(0.1, 0.45, 0.06);

    const feathers = [
      { mat: redFeatherMat, x: -0.25, rotZ: 0.2 },
      { mat: yellowFeatherMat, x: -0.12, rotZ: 0.1 },
      { mat: blueFeatherMat, x: 0, rotZ: 0 },
      { mat: yellowFeatherMat, x: 0.12, rotZ: -0.1 },
      { mat: redFeatherMat, x: 0.25, rotZ: -0.2 },
    ];

    for (const f of feathers) {
      const featherMesh = new THREE.Mesh(featherGeo, f.mat);
      featherMesh.position.set(f.x, 2.96, -0.05);
      featherMesh.rotation.z = f.rotZ;
      group.add(featherMesh);
    }

    // Braços
    const armGeo = new THREE.BoxGeometry(0.26, 0.85, 0.3);

    const leftArmPivot = new THREE.Group();
    leftArmPivot.position.set(-0.68, 2.05, 0);
    const leftArm = new THREE.Mesh(armGeo, skinMat);
    leftArm.position.set(0, -0.4, 0);
    leftArm.castShadow = true;
    leftArmPivot.add(leftArm);
    group.add(leftArmPivot);

    const rightArmPivot = new THREE.Group();
    rightArmPivot.position.set(0.68, 2.05, 0);
    const rightArm = new THREE.Mesh(armGeo, skinMat);
    rightArm.position.set(0, -0.4, 0);
    rightArm.castShadow = true;
    rightArmPivot.add(rightArm);
    group.add(rightArmPivot);

    group.userData = { leftLegPivot, rightLegPivot, leftArmPivot, rightArmPivot, head, torso };
    return { group, leftLegPivot, rightLegPivot, leftArmPivot, rightArmPivot, head, torso };
  }

  // ==========================================
  // 4. NEGRO DE SHORT (black_shorts)
  // Pele retinta, fade moderno, regata esportiva, bermuda e tênis cano alto
  // ==========================================
  private static createBlackShorts(isLocal: boolean): CharacterMeshResult {
    const group = new THREE.Group();
    group.name = 'char_black_shorts';

    const skinMat = new THREE.MeshStandardMaterial({ color: 0x3f2010, roughness: 0.45, metalness: 0.05 });
    const hairMat = new THREE.MeshStandardMaterial({ color: 0x111827, roughness: 0.7 });
    const tankTopMat = new THREE.MeshStandardMaterial({ color: 0xdc2626, roughness: 0.3, metalness: 0.1 });
    const trimMat = new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.2 });
    const shortsMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.45, metalness: 0.1 });
    const socksMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.3 });
    const sneakerMat = new THREE.MeshStandardMaterial({ color: 0xef4444, roughness: 0.2, metalness: 0.2 });

    // Pernas (Bermuda + Canela + Meias Altas + Tênis Esportivo)
    const thighGeo = new THREE.BoxGeometry(0.38, 0.45, 0.45);
    const calfGeo = new THREE.BoxGeometry(0.34, 0.3, 0.4);
    const shoeGeo = new THREE.BoxGeometry(0.4, 0.22, 0.54);

    const leftLegPivot = new THREE.Group();
    leftLegPivot.position.set(-0.25, 0.9, 0);
    const leftShort = new THREE.Mesh(thighGeo, shortsMat);
    leftShort.position.set(0, -0.22, 0);
    leftLegPivot.add(leftShort);
    const leftSock = new THREE.Mesh(calfGeo, socksMat);
    leftSock.position.set(0, -0.55, 0);
    leftLegPivot.add(leftSock);
    const leftShoe = new THREE.Mesh(shoeGeo, sneakerMat);
    leftShoe.position.set(0, -0.79, 0.05);
    leftShoe.castShadow = true;
    leftLegPivot.add(leftShoe);
    group.add(leftLegPivot);

    const rightLegPivot = new THREE.Group();
    rightLegPivot.position.set(0.25, 0.9, 0);
    const rightShort = new THREE.Mesh(thighGeo, shortsMat);
    rightShort.position.set(0, -0.22, 0);
    rightLegPivot.add(rightShort);
    const rightSock = new THREE.Mesh(calfGeo, socksMat);
    rightSock.position.set(0, -0.55, 0);
    rightLegPivot.add(rightSock);
    const rightShoe = new THREE.Mesh(shoeGeo, sneakerMat);
    rightShoe.position.set(0, -0.79, 0.05);
    rightShoe.castShadow = true;
    rightLegPivot.add(rightShoe);
    group.add(rightLegPivot);

    // Quadril (Bermuda)
    const hipsGeo = new THREE.BoxGeometry(0.92, 0.25, 0.5);
    const hips = new THREE.Mesh(hipsGeo, shortsMat);
    hips.position.set(0, 0.98, 0);
    group.add(hips);

    // Tronco (Regata Esportiva Vermelha com detalhes brancos)
    const torsoGeo = new THREE.BoxGeometry(1.0, 1.1, 0.6);
    const torso = new THREE.Mesh(torsoGeo, tankTopMat);
    torso.position.set(0, 1.65, 0);
    torso.castShadow = true;

    // Listra / Número Esportivo no Peito
    const numGeo = new THREE.BoxGeometry(0.28, 0.38, 0.04);
    const num = new THREE.Mesh(numGeo, trimMat);
    num.position.set(0, 0.1, 0.31);
    torso.add(num);
    group.add(torso);

    // Cabeça (Pele Retinta)
    const headGeo = new THREE.CylinderGeometry(0.36, 0.36, 0.6, 16);
    const head = new THREE.Mesh(headGeo, skinMat);
    head.position.set(0, 2.45, 0);
    head.castShadow = true;
    group.add(head);

    // Cabelo Fade Moderno de Blocos
    const hairGeo = new THREE.BoxGeometry(0.72, 0.22, 0.72);
    const hair = new THREE.Mesh(hairGeo, hairMat);
    hair.position.set(0, 2.76, 0);
    group.add(hair);

    const studGeo = new THREE.CylinderGeometry(0.16, 0.16, 0.16, 12);
    const headStud = new THREE.Mesh(studGeo, hairMat);
    headStud.position.set(0, 2.92, 0);
    group.add(headStud);

    // Olhos Expressivos
    const eyeWhiteGeo = new THREE.BoxGeometry(0.1, 0.08, 0.04);
    const eyeL = new THREE.Mesh(eyeWhiteGeo, trimMat);
    eyeL.position.set(-0.16, 2.5, 0.36);
    group.add(eyeL);
    const eyeR = new THREE.Mesh(eyeWhiteGeo, trimMat);
    eyeR.position.set(0.16, 2.5, 0.36);
    group.add(eyeR);

    // Braços (Ombros desnudos da regata + braço retinto)
    const armGeo = new THREE.BoxGeometry(0.26, 0.85, 0.3);

    const leftArmPivot = new THREE.Group();
    leftArmPivot.position.set(-0.68, 2.05, 0);
    const leftArm = new THREE.Mesh(armGeo, skinMat);
    leftArm.position.set(0, -0.4, 0);
    leftArm.castShadow = true;
    leftArmPivot.add(leftArm);
    group.add(leftArmPivot);

    const rightArmPivot = new THREE.Group();
    rightArmPivot.position.set(0.68, 2.05, 0);
    const rightArm = new THREE.Mesh(armGeo, skinMat);
    rightArm.position.set(0, -0.4, 0);
    rightArm.castShadow = true;
    rightArmPivot.add(rightArm);
    group.add(rightArmPivot);

    group.userData = { leftLegPivot, rightLegPivot, leftArmPivot, rightArmPivot, head, torso };
    return { group, leftLegPivot, rightLegPivot, leftArmPivot, rightArmPivot, head, torso };
  }
}
