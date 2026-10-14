import {
  AfterViewInit,
  ChangeDetectionStrategy,
  Component,
  computed,
  ElementRef,
  Inject,
  NgZone,
  OnDestroy,
  PLATFORM_ID,
  signal,
  ViewChild,
} from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import * as THREE from 'three';
import { GameWorld } from '../../core/engine';

@Component({
  selector: 'app-game-viewport',
  standalone: true,
  templateUrl: './game-viewport.component.html',
  styleUrl: './game-viewport.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class GameViewportComponent implements AfterViewInit, OnDestroy {
  @ViewChild('viewportContainer', { static: true })
  public containerRef!: ElementRef<HTMLDivElement>;

  @ViewChild('renderCanvas', { static: true })
  public canvasRef!: ElementRef<HTMLCanvasElement>;

  // Sinais reativos para HUD
  public readonly speedKmh = signal(0);
  public readonly isDriving = signal(false);
  public readonly canInteract = signal(false);
  public readonly isDrifting = signal(false);
  public readonly speedPercentage = computed(() =>
    Math.min(100, Math.round((this.speedKmh() / 90) * 100)),
  );

  // Instância do mundo de física e regras de jogo (100% desacoplado de Three.js)
  public readonly world = new GameWorld();

  private scene: THREE.Scene | null = null;
  private camera: THREE.PerspectiveCamera | null = null;
  private renderer: THREE.WebGLRenderer | null = null;
  private heroGroup: THREE.Group | null = null;
  private vehicleGroup: THREE.Group | null = null;
  private wheelMeshes: THREE.Mesh[] = [];
  private studTexture: THREE.CanvasTexture | null = null;

  private animationFrameId: number | null = null;
  private resizeObserver: ResizeObserver | null = null;
  private isDestroyed = false;

  // Parâmetros orbitais da câmera adaptativa
  private targetTheta = Math.PI;
  private currentTheta = Math.PI;
  private targetPhi = Math.PI / 2.55;
  private currentPhi = Math.PI / 2.55;
  private targetRadius = 7.5;
  private currentRadius = 7.5;

  private lookAtX = 0;
  private lookAtY = 1.05;
  private lookAtZ = 0;

  private isDragging = false;
  private previousPointerX = 0;
  private previousPointerY = 0;
  private userManualCameraRotation = false;
  private idleTime = 0;
  private hudUpdateTimer = 0;

  // Listeners vinculados para desmontagem limpa
  private boundOnPointerDown = this.onPointerDown.bind(this);
  private boundOnPointerMove = this.onPointerMove.bind(this);
  private boundOnPointerUp = this.onPointerUp.bind(this);
  private boundOnWheel = this.onWheel.bind(this);
  private boundOnKeyDown = this.onKeyDown.bind(this);
  private boundOnKeyUp = this.onKeyUp.bind(this);

  constructor(
    private readonly ngZone: NgZone,
    @Inject(PLATFORM_ID) private readonly platformId: object,
  ) {}

  public ngAfterViewInit(): void {
    if (!isPlatformBrowser(this.platformId)) {
      return;
    }

    this.initializeThreeScene();
    this.setupResizeObserver();
    this.attachEventListeners();
    this.startGameLoop();
  }

  public ngOnDestroy(): void {
    this.isDestroyed = true;

    if (this.animationFrameId !== null) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }

    if (this.resizeObserver) {
      this.resizeObserver.disconnect();
      this.resizeObserver = null;
    }

    this.detachEventListeners();
    this.disposeThreeResources();
  }

  /**
   * Inicializa cena Three.js, iluminação, arena, herói e veículo arcade.
   */
  private initializeThreeScene(): void {
    const canvas = this.canvasRef?.nativeElement;
    const container = this.containerRef?.nativeElement;
    if (!canvas || !container) {
      return;
    }

    const width = container.clientWidth || 800;
    const height = container.clientHeight || 600;

    if (!this.isWebGLAvailable()) {
      return;
    }

    try {
      this.renderer = new THREE.WebGLRenderer({
        canvas,
        antialias: true,
        alpha: false,
        powerPreference: 'high-performance',
      });
      this.renderer.setSize(width, height, false);
      this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
      this.renderer.shadowMap.enabled = true;
      this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
      this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
      this.renderer.toneMappingExposure = 1.05;
    } catch (error) {
      console.warn('WebGLRenderer não pôde ser instanciado:', error);
      return;
    }

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x101622);
    this.scene.fog = new THREE.FogExp2(0x101622, 0.022);

    this.camera = new THREE.PerspectiveCamera(50, width / height, 0.1, 1000);
    this.targetTheta = this.world.heroTransform.rotationY + Math.PI;
    this.currentTheta = this.targetTheta;
    this.lookAtX = this.world.heroTransform.x;
    this.lookAtY = 1.05;
    this.lookAtZ = this.world.heroTransform.z;
    this.updateCameraPosition();

    this.setupLighting();
    this.createToyArena();
    this.createBlockHero();
    this.createBlockBuggy();
  }

  /**
   * Checa se o contexto WebGL está disponível no ambiente.
   */
  private isWebGLAvailable(): boolean {
    if (typeof window === 'undefined' || typeof document === 'undefined') {
      return false;
    }
    try {
      const canvas = document.createElement('canvas');
      return Boolean(
        window.WebGLRenderingContext &&
          (canvas.getContext('webgl') || canvas.getContext('experimental-webgl')),
      );
    } catch {
      return false;
    }
  }

  /**
   * Configura iluminação com Ambient suave e Directional com sombras.
   */
  private setupLighting(): void {
    if (!this.scene) return;

    const ambientLight = new THREE.AmbientLight(0xdde6ed, 0.55);
    this.scene.add(ambientLight);

    const hemiLight = new THREE.HemisphereLight(0x60a5fa, 0x1e293b, 0.45);
    hemiLight.position.set(0, 30, 0);
    this.scene.add(hemiLight);

    const dirLight = new THREE.DirectionalLight(0xffffff, 1.25);
    dirLight.position.set(12, 18, 10);
    dirLight.castShadow = true;

    dirLight.shadow.mapSize.width = 2048;
    dirLight.shadow.mapSize.height = 2048;
    dirLight.shadow.camera.near = 0.5;
    dirLight.shadow.camera.far = 60;

    const shadowExtent = 22;
    dirLight.shadow.camera.left = -shadowExtent;
    dirLight.shadow.camera.right = shadowExtent;
    dirLight.shadow.camera.top = shadowExtent;
    dirLight.shadow.camera.bottom = -shadowExtent;
    dirLight.shadow.bias = -0.0004;

    this.scene.add(dirLight);

    const rimLight = new THREE.DirectionalLight(0x38bdf8, 0.4);
    rimLight.position.set(-10, 8, -12);
    this.scene.add(rimLight);
  }

  /**
   * Cria piso de arena com grid e textura de blocos com pinos.
   */
  private createToyArena(): void {
    if (!this.scene) return;

    this.studTexture = this.generateStudTexture();

    const floorGeometry = new THREE.BoxGeometry(40, 0.8, 40);
    const floorMaterial = new THREE.MeshStandardMaterial({
      color: 0x1f2937,
      map: this.studTexture || undefined,
      roughness: 0.38,
      metalness: 0.15,
    });

    const floor = new THREE.Mesh(floorGeometry, floorMaterial);
    floor.position.set(0, -0.4, 0);
    floor.receiveShadow = true;
    this.scene.add(floor);

    const gridHelper = new THREE.GridHelper(40, 20, 0xfcd116, 0x3b82f6);
    gridHelper.position.set(0, 0.01, 0);
    if (gridHelper.material instanceof THREE.Material) {
      gridHelper.material.opacity = 0.25;
      gridHelper.material.transparent = true;
    }
    this.scene.add(gridHelper);

    this.createArenaBorders();
  }

  private generateStudTexture(): THREE.CanvasTexture | null {
    if (typeof document === 'undefined') return null;

    try {
      const canvas = document.createElement('canvas');
      canvas.width = 256;
      canvas.height = 256;
      const ctx = canvas.getContext('2d');
      if (!ctx) return null;

      ctx.fillStyle = '#1e293b';
      ctx.fillRect(0, 0, 256, 256);

      const tileSize = 64;
      const radius = 17;

      for (let x = 0; x < 4; x++) {
        for (let y = 0; y < 4; y++) {
          const cx = x * tileSize + tileSize / 2;
          const cy = y * tileSize + tileSize / 2;

          ctx.strokeStyle = '#0f172a';
          ctx.lineWidth = 2;
          ctx.strokeRect(x * tileSize, y * tileSize, tileSize, tileSize);

          ctx.beginPath();
          ctx.arc(cx, cy + 2, radius, 0, Math.PI * 2);
          ctx.fillStyle = 'rgba(0, 0, 0, 0.45)';
          ctx.fill();

          const grad = ctx.createRadialGradient(cx - 5, cy - 5, 2, cx, cy, radius);
          grad.addColorStop(0, '#475569');
          grad.addColorStop(0.8, '#334155');
          grad.addColorStop(1, '#1e293b');

          ctx.beginPath();
          ctx.arc(cx, cy, radius, 0, Math.PI * 2);
          ctx.fillStyle = grad;
          ctx.fill();

          ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
          ctx.lineWidth = 1.5;
          ctx.stroke();
        }
      }

      const texture = new THREE.CanvasTexture(canvas);
      texture.wrapS = THREE.RepeatWrapping;
      texture.wrapT = THREE.RepeatWrapping;
      texture.repeat.set(10, 10);
      return texture;
    } catch {
      return null;
    }
  }

  private createArenaBorders(): void {
    if (!this.scene) return;

    const borderMatYellow = new THREE.MeshStandardMaterial({
      color: 0xfcd116,
      roughness: 0.3,
      metalness: 0.1,
    });
    const borderMatRed = new THREE.MeshStandardMaterial({
      color: 0xe52521,
      roughness: 0.3,
      metalness: 0.1,
    });

    const wallThickness = 0.8;
    const wallHeight = 0.6;
    const arenaSize = 40;

    const wallSpecs = [
      { size: [arenaSize, wallHeight, wallThickness], pos: [0, wallHeight / 2, -arenaSize / 2], mat: borderMatYellow },
      { size: [arenaSize, wallHeight, wallThickness], pos: [0, wallHeight / 2, arenaSize / 2], mat: borderMatYellow },
      { size: [wallThickness, wallHeight, arenaSize], pos: [-arenaSize / 2, wallHeight / 2, 0], mat: borderMatRed },
      { size: [wallThickness, wallHeight, arenaSize], pos: [arenaSize / 2, wallHeight / 2, 0], mat: borderMatRed },
    ];

    for (const spec of wallSpecs) {
      const geo = new THREE.BoxGeometry(spec.size[0], spec.size[1], spec.size[2]);
      const mesh = new THREE.Mesh(geo, spec.mat);
      mesh.position.set(spec.pos[0], spec.pos[1], spec.pos[2]);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      this.scene.add(mesh);
    }
  }

  /**
   * Cria o herói de blocos com cabeça, tronco e membros estilizados.
   */
  private createBlockHero(): void {
    if (!this.scene) return;

    this.heroGroup = new THREE.Group();
    this.heroGroup.position.set(0, 0, 0);

    const headMat = new THREE.MeshStandardMaterial({ color: 0xfcd116, roughness: 0.35, metalness: 0.05 });
    const torsoMat = new THREE.MeshStandardMaterial({ color: 0xe52521, roughness: 0.3, metalness: 0.1 });
    const hipsMat = new THREE.MeshStandardMaterial({ color: 0x1f2937, roughness: 0.4, metalness: 0.1 });
    const legsMat = new THREE.MeshStandardMaterial({ color: 0x0055b8, roughness: 0.35, metalness: 0.1 });
    const visorMat = new THREE.MeshStandardMaterial({
      color: 0x00ffff,
      roughness: 0.15,
      metalness: 0.8,
      emissive: 0x0088aa,
      emissiveIntensity: 0.6,
    });
    const backpackMat = new THREE.MeshStandardMaterial({ color: 0x374151, roughness: 0.4, metalness: 0.2 });
    const energyCoreMat = new THREE.MeshStandardMaterial({
      color: 0x10b981,
      emissive: 0x10b981,
      emissiveIntensity: 0.8,
    });

    const legGeo = new THREE.BoxGeometry(0.38, 0.9, 0.45);
    const leftLeg = new THREE.Mesh(legGeo, legsMat);
    leftLeg.position.set(-0.25, 0.45, 0);
    leftLeg.castShadow = true;
    leftLeg.receiveShadow = true;
    this.heroGroup.add(leftLeg);

    const rightLeg = new THREE.Mesh(legGeo, legsMat);
    rightLeg.position.set(0.25, 0.45, 0);
    rightLeg.castShadow = true;
    rightLeg.receiveShadow = true;
    this.heroGroup.add(rightLeg);

    const footGeo = new THREE.BoxGeometry(0.38, 0.2, 0.2);
    const leftFoot = new THREE.Mesh(footGeo, legsMat);
    leftFoot.position.set(-0.25, 0.1, 0.3);
    leftFoot.castShadow = true;
    this.heroGroup.add(leftFoot);

    const rightFoot = new THREE.Mesh(footGeo, legsMat);
    rightFoot.position.set(0.25, 0.1, 0.3);
    rightFoot.castShadow = true;
    this.heroGroup.add(rightFoot);

    const hipsGeo = new THREE.BoxGeometry(0.92, 0.25, 0.5);
    const hips = new THREE.Mesh(hipsGeo, hipsMat);
    hips.position.set(0, 0.98, 0);
    hips.castShadow = true;
    this.heroGroup.add(hips);

    const torsoGeo = new THREE.BoxGeometry(1.0, 1.1, 0.6);
    const torso = new THREE.Mesh(torsoGeo, torsoMat);
    torso.position.set(0, 1.65, 0);
    torso.castShadow = true;
    torso.receiveShadow = true;
    this.heroGroup.add(torso);

    const headGeo = new THREE.CylinderGeometry(0.36, 0.36, 0.6, 20);
    const head = new THREE.Mesh(headGeo, headMat);
    head.position.set(0, 2.45, 0);
    head.castShadow = true;
    this.heroGroup.add(head);

    const studGeo = new THREE.CylinderGeometry(0.16, 0.16, 0.16, 16);
    const headStud = new THREE.Mesh(studGeo, headMat);
    headStud.position.set(0, 2.82, 0);
    headStud.castShadow = true;
    this.heroGroup.add(headStud);

    const visorGeo = new THREE.BoxGeometry(0.5, 0.16, 0.16);
    const visor = new THREE.Mesh(visorGeo, visorMat);
    visor.position.set(0, 2.48, 0.32);
    this.heroGroup.add(visor);

    const armGeo = new THREE.BoxGeometry(0.26, 0.85, 0.3);
    const handGeo = new THREE.CylinderGeometry(0.12, 0.12, 0.16, 12);

    const leftArm = new THREE.Mesh(armGeo, torsoMat);
    leftArm.position.set(-0.68, 1.65, 0);
    leftArm.rotation.z = 0.12;
    leftArm.castShadow = true;
    this.heroGroup.add(leftArm);

    const leftHand = new THREE.Mesh(handGeo, headMat);
    leftHand.position.set(-0.74, 1.15, 0.08);
    leftHand.rotation.x = Math.PI / 2;
    leftHand.castShadow = true;
    this.heroGroup.add(leftHand);

    const rightArm = new THREE.Mesh(armGeo, torsoMat);
    rightArm.position.set(0.68, 1.65, 0.05);
    rightArm.rotation.z = -0.12;
    rightArm.rotation.x = -0.2;
    rightArm.castShadow = true;
    this.heroGroup.add(rightArm);

    const rightHand = new THREE.Mesh(handGeo, headMat);
    rightHand.position.set(0.74, 1.15, 0.22);
    rightHand.rotation.x = Math.PI / 2;
    rightHand.castShadow = true;
    this.heroGroup.add(rightHand);

    const backpackGeo = new THREE.BoxGeometry(0.7, 0.75, 0.35);
    const backpack = new THREE.Mesh(backpackGeo, backpackMat);
    backpack.position.set(0, 1.65, -0.42);
    backpack.castShadow = true;
    this.heroGroup.add(backpack);

    const coreGeo = new THREE.CylinderGeometry(0.12, 0.12, 0.45, 12);
    const core = new THREE.Mesh(coreGeo, energyCoreMat);
    core.position.set(0, 1.65, -0.6);
    this.heroGroup.add(core);

    this.scene.add(this.heroGroup);
  }

  /**
   * Cria o modelo 3D do Veículo (Buggy Arcade de Blocos).
   * Chassi amarelo/preto, 4 rodas volumosas em cilindros pretos com calotas, santantônio e bancos.
   */
  private createBlockBuggy(): void {
    if (!this.scene) return;

    this.vehicleGroup = new THREE.Group();
    this.wheelMeshes = [];

    const bodyMatYellow = new THREE.MeshStandardMaterial({ color: 0xfcd116, roughness: 0.3, metalness: 0.1 });
    const chassisMatBlack = new THREE.MeshStandardMaterial({ color: 0x111827, roughness: 0.5, metalness: 0.2 });
    const rollCageMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.4, metalness: 0.6 });
    const tireMat = new THREE.MeshStandardMaterial({ color: 0x090d16, roughness: 0.8, metalness: 0.05 });
    const hubcapMat = new THREE.MeshStandardMaterial({ color: 0xe52521, roughness: 0.3, metalness: 0.2 });
    const seatMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.6, metalness: 0.1 });
    const headlightMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      emissive: 0xfef08a,
      emissiveIntensity: 0.9,
    });
    const taillightMat = new THREE.MeshStandardMaterial({
      color: 0xef4444,
      emissive: 0xef4444,
      emissiveIntensity: 0.8,
    });

    // 1. Chassi Inferior
    const chassisGeo = new THREE.BoxGeometry(1.9, 0.35, 3.4);
    const chassis = new THREE.Mesh(chassisGeo, chassisMatBlack);
    chassis.position.set(0, 0.4, 0);
    chassis.castShadow = true;
    chassis.receiveShadow = true;
    this.vehicleGroup.add(chassis);

    // 2. Carroceria Principal Amarela de Blocos
    const bodyFrontGeo = new THREE.BoxGeometry(1.6, 0.45, 1.4);
    const bodyFront = new THREE.Mesh(bodyFrontGeo, bodyMatYellow);
    bodyFront.position.set(0, 0.72, 0.9);
    bodyFront.castShadow = true;
    bodyFront.receiveShadow = true;
    this.vehicleGroup.add(bodyFront);

    // Bordo / Painel do Cockpit
    const bodyCockpitGeo = new THREE.BoxGeometry(1.6, 0.3, 1.2);
    const bodyCockpit = new THREE.Mesh(bodyCockpitGeo, bodyMatYellow);
    bodyCockpit.position.set(0, 0.65, -0.4);
    bodyCockpit.castShadow = true;
    this.vehicleGroup.add(bodyCockpit);

    // 3. Cockpit e Banco do Piloto
    const seatGeo = new THREE.BoxGeometry(0.8, 0.6, 0.7);
    const seat = new THREE.Mesh(seatGeo, seatMat);
    seat.position.set(0, 0.85, -0.3);
    seat.castShadow = true;
    this.vehicleGroup.add(seat);

    // Volante de Blocos
    const wheelColumnGeo = new THREE.CylinderGeometry(0.04, 0.04, 0.4, 8);
    const wheelColumn = new THREE.Mesh(wheelColumnGeo, chassisMatBlack);
    wheelColumn.position.set(0, 0.9, 0.3);
    wheelColumn.rotation.x = -Math.PI / 4;
    this.vehicleGroup.add(wheelColumn);

    const steeringGeo = new THREE.CylinderGeometry(0.2, 0.2, 0.05, 12);
    const steering = new THREE.Mesh(steeringGeo, hubcapMat);
    steering.position.set(0, 1.05, 0.16);
    steering.rotation.x = -Math.PI / 4;
    this.vehicleGroup.add(steering);

    // 4. Santantônio (Roll Cage) Tubular
    const cageBarGeo = new THREE.CylinderGeometry(0.06, 0.06, 1.1, 10);

    const cageLeft = new THREE.Mesh(cageBarGeo, rollCageMat);
    cageLeft.position.set(-0.75, 1.25, -0.3);
    cageLeft.castShadow = true;
    this.vehicleGroup.add(cageLeft);

    const cageRight = new THREE.Mesh(cageBarGeo, rollCageMat);
    cageRight.position.set(0.75, 1.25, -0.3);
    cageRight.castShadow = true;
    this.vehicleGroup.add(cageRight);

    const cageTopGeo = new THREE.CylinderGeometry(0.06, 0.06, 1.6, 10);
    const cageTop = new THREE.Mesh(cageTopGeo, rollCageMat);
    cageTop.position.set(0, 1.8, -0.3);
    cageTop.rotation.z = Math.PI / 2;
    cageTop.castShadow = true;
    this.vehicleGroup.add(cageTop);

    // 5. Faróis Dianteiros e Lanternas Traseiras
    const lightGeo = new THREE.BoxGeometry(0.3, 0.2, 0.12);
    const leftHeadlight = new THREE.Mesh(lightGeo, headlightMat);
    leftHeadlight.position.set(-0.6, 0.75, 1.62);
    this.vehicleGroup.add(leftHeadlight);

    const rightHeadlight = new THREE.Mesh(lightGeo, headlightMat);
    rightHeadlight.position.set(0.6, 0.75, 1.62);
    this.vehicleGroup.add(rightHeadlight);

    const leftTaillight = new THREE.Mesh(lightGeo, taillightMat);
    leftTaillight.position.set(-0.6, 0.65, -1.72);
    this.vehicleGroup.add(leftTaillight);

    const rightTaillight = new THREE.Mesh(lightGeo, taillightMat);
    rightTaillight.position.set(0.6, 0.65, -1.72);
    this.vehicleGroup.add(rightTaillight);

    // 6. Quatro Rodas Volumosas com Calotas em Cilindros Pretos
    const tireRadius = 0.52;
    const tireWidth = 0.44;
    const tireGeo = new THREE.CylinderGeometry(tireRadius, tireRadius, tireWidth, 20);
    const hubcapGeo = new THREE.CylinderGeometry(0.24, 0.24, tireWidth + 0.02, 16);

    const wheelPositions = [
      { x: -1.15, y: tireRadius, z: 1.15 },  // Dianteira Esquerda
      { x: 1.15, y: tireRadius, z: 1.15 },   // Dianteira Direita
      { x: -1.15, y: tireRadius, z: -1.15 }, // Traseira Esquerda
      { x: 1.15, y: tireRadius, z: -1.15 },  // Traseira Direita
    ];

    for (const pos of wheelPositions) {
      const wheelHolder = new THREE.Mesh(tireGeo, tireMat);
      wheelHolder.position.set(pos.x, pos.y, pos.z);
      wheelHolder.rotation.z = Math.PI / 2;
      wheelHolder.castShadow = true;
      wheelHolder.receiveShadow = true;

      const hubcap = new THREE.Mesh(hubcapGeo, hubcapMat);
      wheelHolder.add(hubcap);

      this.wheelMeshes.push(wheelHolder);
      this.vehicleGroup.add(wheelHolder);
    }

    // Posição inicial a partir do GameWorld
    this.vehicleGroup.position.set(
      this.world.vehicleTransform.x,
      0,
      this.world.vehicleTransform.z,
    );
    this.vehicleGroup.rotation.y = this.world.vehicleTransform.rotationY;

    this.scene.add(this.vehicleGroup);
  }

  /**
   * Atualiza a posição e o enquadramento da câmera adaptativa.
   */
  private updateCameraPosition(): void {
    if (!this.camera) return;

    const sinPhi = Math.sin(this.currentPhi);
    const cosPhi = Math.cos(this.currentPhi);
    const sinTheta = Math.sin(this.currentTheta);
    const cosTheta = Math.cos(this.currentTheta);

    this.camera.position.x = this.lookAtX + this.currentRadius * sinPhi * sinTheta;
    this.camera.position.y = this.lookAtY + this.currentRadius * cosPhi;
    this.camera.position.z = this.lookAtZ + this.currentRadius * sinPhi * cosTheta;

    this.camera.lookAt(this.lookAtX, this.lookAtY, this.lookAtZ);
  }

  private setupResizeObserver(): void {
    const container = this.containerRef?.nativeElement;
    if (!container || typeof ResizeObserver === 'undefined') {
      return;
    }

    this.resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        this.onResize(width, height);
      }
    });

    this.resizeObserver.observe(container);
  }

  private onResize(width: number, height: number): void {
    if (width <= 0 || height <= 0 || !this.camera || !this.renderer) {
      return;
    }

    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height, false);
  }

  /**
   * Registro de eventos de mouse, touch e teclado (WASD, Setas, Espaço, E).
   */
  private attachEventListeners(): void {
    const canvas = this.canvasRef?.nativeElement;
    if (canvas) {
      canvas.addEventListener('pointerdown', this.boundOnPointerDown);
      canvas.addEventListener('wheel', this.boundOnWheel, { passive: false });
    }

    if (typeof window !== 'undefined') {
      window.addEventListener('pointermove', this.boundOnPointerMove);
      window.addEventListener('pointerup', this.boundOnPointerUp);
      window.addEventListener('keydown', this.boundOnKeyDown);
      window.addEventListener('keyup', this.boundOnKeyUp);
    }
  }

  private detachEventListeners(): void {
    const canvas = this.canvasRef?.nativeElement;
    if (canvas) {
      canvas.removeEventListener('pointerdown', this.boundOnPointerDown);
      canvas.removeEventListener('wheel', this.boundOnWheel);
    }
    if (typeof window !== 'undefined') {
      window.removeEventListener('pointermove', this.boundOnPointerMove);
      window.removeEventListener('pointerup', this.boundOnPointerUp);
      window.removeEventListener('keydown', this.boundOnKeyDown);
      window.removeEventListener('keyup', this.boundOnKeyUp);
    }
  }

  private onKeyDown(event: KeyboardEvent): void {
    const code = event.code;

    if (code === 'KeyW' || code === 'ArrowUp') {
      this.world.setInput({ forward: true });
    } else if (code === 'KeyS' || code === 'ArrowDown') {
      this.world.setInput({ backward: true });
    } else if (code === 'KeyA' || code === 'ArrowLeft') {
      this.world.setInput({ left: true });
    } else if (code === 'KeyD' || code === 'ArrowRight') {
      this.world.setInput({ right: true });
    } else if (code === 'Space') {
      event.preventDefault();
      if (this.world.isDriving()) {
        this.world.setInput({ handbrake: true, jump: false });
      } else {
        this.world.setInput({ jump: true, handbrake: false });
      }
    } else if (code === 'KeyE') {
      if (!event.repeat) {
        this.world.triggerInteract();
        this.world.setInput({ jump: false, handbrake: false });
      }
    }
  }

  private onKeyUp(event: KeyboardEvent): void {
    const code = event.code;

    if (code === 'KeyW' || code === 'ArrowUp') {
      this.world.setInput({ forward: false });
    } else if (code === 'KeyS' || code === 'ArrowDown') {
      this.world.setInput({ backward: false });
    } else if (code === 'KeyA' || code === 'ArrowLeft') {
      this.world.setInput({ left: false });
    } else if (code === 'KeyD' || code === 'ArrowRight') {
      this.world.setInput({ right: false });
    } else if (code === 'Space') {
      this.world.setInput({ handbrake: false, jump: false });
    }
  }

  private onPointerDown(event: PointerEvent): void {
    this.isDragging = true;
    this.userManualCameraRotation = true;
    this.previousPointerX = event.clientX;
    this.previousPointerY = event.clientY;
    this.idleTime = 0;
  }

  private onPointerMove(event: PointerEvent): void {
    if (!this.isDragging) return;

    const deltaX = event.clientX - this.previousPointerX;
    const deltaY = event.clientY - this.previousPointerY;
    this.previousPointerX = event.clientX;
    this.previousPointerY = event.clientY;

    const rotationSpeed = 0.007;
    this.targetTheta -= deltaX * rotationSpeed;
    this.targetPhi = Math.max(0.2, Math.min(Math.PI / 2 - 0.08, this.targetPhi + deltaY * rotationSpeed));
    this.idleTime = 0;
  }

  private onPointerUp(): void {
    this.isDragging = false;
  }

  private onWheel(event: WheelEvent): void {
    event.preventDefault();
    const zoomSpeed = 0.004;
    this.targetRadius = Math.max(3.5, Math.min(18.0, this.targetRadius + event.deltaY * zoomSpeed));
    this.idleTime = 0;
  }

  /**
   * Game loop fluido mirando 60 FPS com Fixed Timestep acoplado.
   */
  private startGameLoop(): void {
    if (!this.renderer || !this.scene || !this.camera) {
      return;
    }

    this.ngZone.runOutsideAngular(() => {
      let previousTime = performance.now();

      const loop = (currentTime: number) => {
        if (this.isDestroyed) {
          return;
        }

        const delta = Math.min((currentTime - previousTime) / 1000, 0.1);
        previousTime = currentTime;

        this.updateGameLogic(delta, currentTime / 1000);
        this.renderer?.render(this.scene!, this.camera!);

        this.animationFrameId = requestAnimationFrame(loop);
      };

      this.animationFrameId = requestAnimationFrame(loop);
    });
  }

  /**
   * Atualiza lógica da simulação ECS, posições dos meshes 3D e câmera adaptativa.
   */
  private updateGameLogic(delta: number, time: number): void {
    // 1. Avança a simulação determinística do GameWorld
    this.world.step(delta);

    const isDriving = this.world.isDriving();
    const hero = this.world.heroTransform;
    const vehicle = this.world.vehicleTransform;
    const vehicleComp = this.world.vehicleComponent;

    // 2. Atualização dos Meshes 3D
    if (this.heroGroup) {
      if (isDriving) {
        // Herói sentado no cockpit do buggy
        this.heroGroup.position.set(vehicle.x, 0.45, vehicle.z);
        this.heroGroup.rotation.y = vehicle.rotationY;
        this.heroGroup.scale.set(0.85, 0.85, 0.85);
      } else {
        // Herói a pé
        let visualY = hero.y;

        if (hero.y <= 0.01) {
          if (this.world.heroController.isMoving) {
            // Animação de corrida (balanço heróico no solo)
            visualY += Math.abs(Math.sin(time * 12.0)) * 0.1;
          } else {
            // Respiração suave no solo
            visualY += Math.sin(time * 3.0) * 0.03;
          }
        }

        this.heroGroup.position.set(hero.x, visualY, hero.z);
        this.heroGroup.rotation.y = hero.rotationY;
        this.heroGroup.scale.set(1.0, 1.0, 1.0);
      }
    }

    if (this.vehicleGroup) {
      this.vehicleGroup.position.set(vehicle.x, 0, vehicle.z);
      this.vehicleGroup.rotation.y = vehicle.rotationY;

      // Animação das rodas girando com a velocidade
      const wheelSpin = vehicleComp.currentSpeed * delta * 2.2;
      for (const wheel of this.wheelMeshes) {
        wheel.rotation.x += wheelSpin;
      }

      // Efeito de rolagem de carroceria sutil em curvas e drift
      if (vehicleComp.isDrifting) {
        this.vehicleGroup.rotation.z = Math.sin(time * 20.0) * 0.04;
      } else {
        this.vehicleGroup.rotation.z = 0;
      }
    }

    // 3. Câmera em Terceira Pessoa Adaptativa
    const targetTargetRadius = isDriving ? 10.5 : 7.5;
    const targetTargetPhi = isDriving ? Math.PI / 2.55 : Math.PI / 2.55;

    const lerpFactor = Math.min(1, delta * 7.5);
    this.targetRadius += (targetTargetRadius - this.targetRadius) * (delta * 3.0);
    this.targetPhi += (targetTargetPhi - this.targetPhi) * (delta * 3.0);

    const targetLookAtX = isDriving ? vehicle.x : hero.x;
    const targetLookAtY = isDriving ? 0.85 : 1.05 + Math.max(0, hero.y * 0.45);
    const targetLookAtZ = isDriving ? vehicle.z : hero.z;

    this.lookAtX += (targetLookAtX - this.lookAtX) * lerpFactor;
    this.lookAtY += (targetLookAtY - this.lookAtY) * lerpFactor;
    this.lookAtZ += (targetLookAtZ - this.lookAtZ) * lerpFactor;

    if (!this.isDragging) {
      this.idleTime += delta;

      // Alinha suavemente a câmera com a traseira do veículo ou costas do herói
      const activeRotation = isDriving ? vehicle.rotationY : hero.rotationY;
      const behindEntityTheta = activeRotation + Math.PI;
      let thetaDiff = (behindEntityTheta - this.targetTheta) % (Math.PI * 2);
      if (thetaDiff > Math.PI) thetaDiff -= Math.PI * 2;
      if (thetaDiff < -Math.PI) thetaDiff += Math.PI * 2;

      const alignSpeed = isDriving ? 3.8 : 4.8;
      this.targetTheta += thetaDiff * Math.min(1, delta * alignSpeed);
    }

    this.currentTheta += (this.targetTheta - this.currentTheta) * lerpFactor;
    this.currentPhi += (this.targetPhi - this.currentPhi) * lerpFactor;
    this.currentRadius += (this.targetRadius - this.currentRadius) * lerpFactor;

    this.updateCameraPosition();

    // 4. Atualização dos Sinais Reativos do HUD (a cada ~60ms para performance)
    this.hudUpdateTimer += delta;
    if (this.hudUpdateTimer >= 0.06) {
      this.hudUpdateTimer = 0;

      const currentKmh = this.world.getSpeedKmh();
      const currentDriving = this.world.isDriving();
      const currentInteract = this.world.canInteract();
      const currentDrift = this.world.isDrifting();

      if (
        this.speedKmh() !== currentKmh ||
        this.isDriving() !== currentDriving ||
        this.canInteract() !== currentInteract ||
        this.isDrifting() !== currentDrift
      ) {
        this.ngZone.run(() => {
          this.speedKmh.set(currentKmh);
          this.isDriving.set(currentDriving);
          this.canInteract.set(currentInteract);
          this.isDrifting.set(currentDrift);
        });
      }
    }
  }

  /**
   * Limpeza exaustiva de geometrias, materiais, texturas e renderer Three.js.
   */
  private disposeThreeResources(): void {
    if (this.studTexture) {
      this.studTexture.dispose();
      this.studTexture = null;
    }

    if (this.scene) {
      this.scene.traverse((child) => {
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
      this.scene.clear();
      this.scene = null;
    }

    if (this.renderer) {
      this.renderer.dispose();
      this.renderer = null;
    }

    this.camera = null;
    this.heroGroup = null;
    this.vehicleGroup = null;
    this.wheelMeshes = [];
  }
}
