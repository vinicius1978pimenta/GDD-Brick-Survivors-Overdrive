import {
  AfterViewInit,
  ChangeDetectionStrategy,
  Component,
  computed,
  CUSTOM_ELEMENTS_SCHEMA,
  ElementRef,
  Inject,
  NgZone,
  OnDestroy,
  PLATFORM_ID,
  signal,
  ViewChild,
} from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import 'iconify-icon';
import * as THREE from 'three';
import {
  GameWorld,
  ProjectileEntity,
  Vector3D,
  WEAPON_CATALOG,
  WeaponType,
} from '../../core/engine';
import { NetworkService, WorldStateSnapshot } from '../../core/network';
import { FloatingCombatText, RemotePlayerVisual } from './interfaces/game-viewport.interface';
import {
  EnemyEntity,
  EnemyType,
  EnemyVisual,
  GameModeType,
  MatchState,
  PlayerMatchScore,
  UpgradeOption,
} from './interfaces/match.interface';
import { createEnemyMesh } from './enemy-mesh.factory';

@Component({
  selector: 'app-game-viewport',
  standalone: true,
  templateUrl: './game-viewport.component.html',
  styleUrl: './game-viewport.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
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
  public readonly durabilityPercentage = signal(100);
  public readonly speedPercentage = computed(() =>
    Math.min(100, Math.round((this.speedKmh() / 90) * 100)),
  );
  public readonly canDismount = computed(
    () => this.isDriving() && this.speedKmh() === 0,
  );

  // Sinais de combate e arsenal LEGO
  public readonly equippedWeapon = signal<WeaponType>('stud_blaster');
  public readonly equippedWeaponName = computed(() => WEAPON_CATALOG[this.equippedWeapon()].name);
  public readonly weaponCooldownProgress = signal(0);
  public readonly floatingTexts = signal<FloatingCombatText[]>([]);
  public readonly isShootingRecoil = signal(false);

  // Mira Dinâmica no Mouse & Combate 3D
  public readonly crosshairX = signal<number>(
    typeof window !== 'undefined' ? window.innerWidth / 2 : 400,
  );
  public readonly crosshairY = signal<number>(
    typeof window !== 'undefined' ? window.innerHeight / 2 : 300,
  );

  // Sinais de Modos de Jogo e Partida (Fase 7: Sobrevivência Co-op & PvP Deathmatch)
  public readonly gameMode = signal<GameModeType>('coop_survival');
  public readonly matchState = signal<MatchState>('waiting');
  public readonly currentWave = signal(1);
  public readonly maxWaves = signal(5);
  public readonly enemiesRemaining = signal(0);
  public readonly countdownSeconds = signal(3);
  public readonly intermissionSeconds = signal(10);
  public readonly upgradeOptions = signal<UpgradeOption[]>([]);
  public readonly playerScores = signal<PlayerMatchScore[]>([]);
  public readonly isPlayerReady = signal(false);

  // Instância do mundo de física e regras de jogo (100% desacoplado de Three.js)
  public readonly world = new GameWorld();

  private readonly enemyVisuals = new Map<string, EnemyVisual>();
  private readonly raycaster = new THREE.Raycaster();
  private readonly mouseNDC = new THREE.Vector2();
  private readonly groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
  private readonly aimTarget3D = new THREE.Vector3(0, 0, 5);

  private scene: THREE.Scene | null = null;
  private camera: THREE.PerspectiveCamera | null = null;
  private renderer: THREE.WebGLRenderer | null = null;
  private heroGroup: THREE.Group | null = null;
  private heroLeftLegPivot: THREE.Group | null = null;
  private heroRightLegPivot: THREE.Group | null = null;
  private heroLeftArmPivot: THREE.Group | null = null;
  private heroRightArmPivot: THREE.Group | null = null;
  private rightHandWeaponSocket: THREE.Group | null = null;
  private currentWeaponMeshInHand: THREE.Object3D | null = null;
  private shootRecoilTimer = 0;
  private vehicleGroup: THREE.Group | null = null;
  private wheelMeshes: THREE.Mesh[] = [];
  private modularBlockMeshes = new Map<string, THREE.Mesh>();
  private debrisMeshes = new Map<number, THREE.Mesh>();
  private projectileMeshes = new Map<string, THREE.Object3D>();
  private floatingCombatTexts: FloatingCombatText[] = [];
  private nextFloatingId = 1;
  private studTexture: THREE.CanvasTexture | null = null;

  private animationFrameId: number | null = null;
  private resizeObserver: ResizeObserver | null = null;
  private isDestroyed = false;

  // Parâmetros orbitais da câmera adaptativa
  private targetTheta = Math.PI;
  private currentTheta = Math.PI;
  private targetPhi = Math.PI / 2.85;
  private currentPhi = Math.PI / 2.85;
  private targetRadius = 8.0;
  private currentRadius = 8.0;

  private lookAtX = 0;
  private lookAtY = 1.45;
  private lookAtZ = 0;

  private wasDriving = false;
  private lastVehicleRotationY = 0;

  private isDragging = false;
  private previousPointerX = 0;
  private previousPointerY = 0;
  private userManualCameraRotation = false;
  private idleTime = 0;
  private hudUpdateTimer = 0;

  // Gerenciamento de entidades e visualização de jogadores remotos no mundo
  private readonly remotePlayerVisuals = new Map<string, RemotePlayerVisual>();
  private unsubscribeSnapshots: (() => void) | null = null;

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
    public readonly networkService: NetworkService,
  ) {}

  public ngAfterViewInit(): void {
    if (!isPlatformBrowser(this.platformId)) {
      return;
    }

    this.initializeThreeScene();
    this.setupResizeObserver();
    this.attachEventListeners();
    this.startGameLoop();

    // Inicia comunicação de rede com o Gateway NestJS
    this.networkService.connect();
    this.networkService.joinGame('Hero Player');

    this.unsubscribeSnapshots = this.networkService.onSnapshot((snapshot) => {
      this.handleServerSnapshot(snapshot);
    });
  }

  public ngOnDestroy(): void {
    this.isDestroyed = true;

    if (this.unsubscribeSnapshots) {
      this.unsubscribeSnapshots();
      this.unsubscribeSnapshots = null;
    }
    this.networkService.disconnect();

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

    this.camera = new THREE.PerspectiveCamera(65, width / height, 0.1, 1000);
    this.targetTheta = this.world.heroTransform.rotationY + Math.PI;
    this.currentTheta = this.targetTheta;
    this.targetRadius = 8.0;
    this.currentRadius = 8.0;
    this.lookAtX = this.world.heroTransform.x;
    this.lookAtY = 1.45;
    this.lookAtZ = this.world.heroTransform.z;
    this.wasDriving = this.world.isDriving();
    this.lastVehicleRotationY = this.world.vehicleTransform.rotationY;
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
   * Cria o herói de blocos com visual ultra moderno Cyber-Overdrive Mech:
   * Capacete cyber-tático com viseira holográfica e crista, exoesqueleto peitoral com Arc Core,
   * ombreiras táticas nos braços, jetpack de turbinas gêmeas com plasma ativo e grevas reforçadas.
   */
  private createBlockHero(): void {
    if (!this.scene) return;

    this.heroGroup = new THREE.Group();
    this.heroGroup.position.set(0, 0, 0);

    // Paleta de Materiais PBR Cyber-Táticos de Alta Fidelidade
    const armorDarkMat = new THREE.MeshStandardMaterial({
      color: 0x111827,
      roughness: 0.22,
      metalness: 0.8,
    });
    const armorCobaltMat = new THREE.MeshStandardMaterial({
      color: 0x0284c7,
      roughness: 0.2,
      metalness: 0.7,
    });
    const armorGoldMat = new THREE.MeshStandardMaterial({
      color: 0xf59e0b,
      roughness: 0.25,
      metalness: 0.85,
    });
    const visorHoloMat = new THREE.MeshStandardMaterial({
      color: 0x00ffff,
      roughness: 0.08,
      metalness: 0.9,
      emissive: 0x00e5ff,
      emissiveIntensity: 1.1,
    });
    const arcReactorMat = new THREE.MeshStandardMaterial({
      color: 0x38bdf8,
      emissive: 0x00f0ff,
      emissiveIntensity: 2.0,
      roughness: 0.1,
    });
    const thrusterPlasmaMat = new THREE.MeshStandardMaterial({
      color: 0x06b6d4,
      emissive: 0x22d3ee,
      emissiveIntensity: 2.2,
      roughness: 0.15,
    });
    const sensorNeonMat = new THREE.MeshStandardMaterial({
      color: 0xef4444,
      emissive: 0xef4444,
      emissiveIntensity: 1.5,
    });

    const legGeo = new THREE.BoxGeometry(0.38, 0.9, 0.45);
    const footGeo = new THREE.BoxGeometry(0.4, 0.22, 0.38);
    const kneePadGeo = new THREE.BoxGeometry(0.42, 0.24, 0.12);

    // 1. Pivô da Perna Esquerda (com grevas e botas magnéticas)
    this.heroLeftLegPivot = new THREE.Group();
    this.heroLeftLegPivot.position.set(-0.25, 0.9, 0);

    const leftLeg = new THREE.Mesh(legGeo, armorCobaltMat);
    leftLeg.position.set(0, -0.45, 0);
    leftLeg.castShadow = true;
    leftLeg.receiveShadow = true;
    this.heroLeftLegPivot.add(leftLeg);

    // Joelheira tática reforçada
    const leftKneePad = new THREE.Mesh(kneePadGeo, armorGoldMat);
    leftKneePad.position.set(0, -0.38, 0.25);
    leftKneePad.castShadow = true;
    this.heroLeftLegPivot.add(leftKneePad);

    // Bota blindada com solado magnético escuro
    const leftFoot = new THREE.Mesh(footGeo, armorDarkMat);
    leftFoot.position.set(0, -0.8, 0.08);
    leftFoot.castShadow = true;
    this.heroLeftLegPivot.add(leftFoot);
    this.heroGroup.add(this.heroLeftLegPivot);

    // 2. Pivô da Perna Direita (com grevas e botas magnéticas)
    this.heroRightLegPivot = new THREE.Group();
    this.heroRightLegPivot.position.set(0.25, 0.9, 0);

    const rightLeg = new THREE.Mesh(legGeo, armorCobaltMat);
    rightLeg.position.set(0, -0.45, 0);
    rightLeg.castShadow = true;
    rightLeg.receiveShadow = true;
    this.heroRightLegPivot.add(rightLeg);

    // Joelheira tática reforçada
    const rightKneePad = new THREE.Mesh(kneePadGeo, armorGoldMat);
    rightKneePad.position.set(0, -0.38, 0.25);
    rightKneePad.castShadow = true;
    this.heroRightLegPivot.add(rightKneePad);

    // Bota blindada
    const rightFoot = new THREE.Mesh(footGeo, armorDarkMat);
    rightFoot.position.set(0, -0.8, 0.08);
    rightFoot.castShadow = true;
    this.heroRightLegPivot.add(rightFoot);
    this.heroGroup.add(this.heroRightLegPivot);

    // 3. Cinturão & Pélvis Tática (Tactical Belt & Pelvis)
    const hipsGeo = new THREE.BoxGeometry(0.96, 0.28, 0.52);
    const hips = new THREE.Mesh(hipsGeo, armorDarkMat);
    hips.position.set(0, 0.98, 0);
    hips.castShadow = true;
    this.heroGroup.add(hips);

    const buckleGeo = new THREE.BoxGeometry(0.28, 0.2, 0.56);
    const buckle = new THREE.Mesh(buckleGeo, armorGoldMat);
    buckle.position.set(0, 0.98, 0.02);
    this.heroGroup.add(buckle);

    // 4. Exoesqueleto / Armadura Peitoral (Layered Armor)
    const torsoGeo = new THREE.BoxGeometry(1.04, 1.12, 0.62);
    const torso = new THREE.Mesh(torsoGeo, armorCobaltMat);
    torso.position.set(0, 1.65, 0);
    torso.castShadow = true;
    torso.receiveShadow = true;
    this.heroGroup.add(torso);

    // Placas de blindagem peitoral angular sobreposta
    const chestPlateGeo = new THREE.BoxGeometry(0.96, 0.58, 0.12);
    const chestPlate = new THREE.Mesh(chestPlateGeo, armorDarkMat);
    chestPlate.position.set(0, 1.76, 0.32);
    chestPlate.castShadow = true;
    this.heroGroup.add(chestPlate);

    // Reator Arc Core central com anel de contenção
    const reactorRingGeo = new THREE.CylinderGeometry(0.18, 0.18, 0.14, 20);
    const reactorRing = new THREE.Mesh(reactorRingGeo, armorGoldMat);
    reactorRing.rotation.x = Math.PI / 2;
    reactorRing.position.set(0, 1.76, 0.39);
    this.heroGroup.add(reactorRing);

    const reactorCoreGeo = new THREE.CylinderGeometry(0.12, 0.12, 0.16, 16);
    const reactorCore = new THREE.Mesh(reactorCoreGeo, arcReactorMat);
    reactorCore.rotation.x = Math.PI / 2;
    reactorCore.position.set(0, 1.76, 0.4);
    this.heroGroup.add(reactorCore);

    // 5. Capacete Cyber-Tático (Cyber-Tactical Helmet)
    const headGeo = new THREE.CylinderGeometry(0.38, 0.42, 0.62, 20);
    const head = new THREE.Mesh(headGeo, armorDarkMat);
    head.position.set(0, 2.45, 0);
    head.castShadow = true;
    this.heroGroup.add(head);

    // Crista Aerodinâmica no topo do capacete
    const crestFinGeo = new THREE.BoxGeometry(0.08, 0.22, 0.58);
    const crestFin = new THREE.Mesh(crestFinGeo, armorGoldMat);
    crestFin.position.set(0, 2.82, 0.02);
    crestFin.castShadow = true;
    this.heroGroup.add(crestFin);

    // Stud superior do capacete LEGO mecha
    const studGeo = new THREE.CylinderGeometry(0.16, 0.16, 0.14, 16);
    const headStud = new THREE.Mesh(studGeo, armorCobaltMat);
    headStud.position.set(0, 2.86, -0.05);
    this.heroGroup.add(headStud);

    // Viseira Holográfica Chanfrada
    const visorGeo = new THREE.BoxGeometry(0.54, 0.2, 0.22);
    const visor = new THREE.Mesh(visorGeo, visorHoloMat);
    visor.position.set(0, 2.5, 0.33);
    this.heroGroup.add(visor);

    // Respirador Tático Angular
    const respiratorGeo = new THREE.BoxGeometry(0.38, 0.18, 0.18);
    const respirator = new THREE.Mesh(respiratorGeo, armorDarkMat);
    respirator.position.set(0, 2.28, 0.35);
    this.heroGroup.add(respirator);

    // Sensor Tático / Headset com LED
    const headsetGeo = new THREE.CylinderGeometry(0.08, 0.08, 0.08, 12);
    const headset = new THREE.Mesh(headsetGeo, armorGoldMat);
    headset.rotation.z = Math.PI / 2;
    headset.position.set(0.44, 2.48, 0.05);
    this.heroGroup.add(headset);

    const sensorLedGeo = new THREE.BoxGeometry(0.04, 0.04, 0.1);
    const sensorLed = new THREE.Mesh(sensorLedGeo, sensorNeonMat);
    sensorLed.position.set(0.46, 2.48, 0.16);
    this.heroGroup.add(sensorLed);

    // 6. Braços Articulados com Ombreiras Táticas (Shoulder Pauldrons)
    const armGeo = new THREE.BoxGeometry(0.28, 0.85, 0.32);
    const handGeo = new THREE.CylinderGeometry(0.13, 0.13, 0.18, 12);
    const pauldronGeo = new THREE.BoxGeometry(0.42, 0.32, 0.44);

    // Pivô do Braço Esquerdo
    this.heroLeftArmPivot = new THREE.Group();
    this.heroLeftArmPivot.position.set(-0.68, 2.1, 0);

    const leftArm = new THREE.Mesh(armGeo, armorCobaltMat);
    leftArm.position.set(0, -0.45, 0);
    leftArm.castShadow = true;
    this.heroLeftArmPivot.add(leftArm);

    // Ombreira tática esquerda acoplada ao pivô do braço
    const leftPauldron = new THREE.Mesh(pauldronGeo, armorDarkMat);
    leftPauldron.position.set(-0.06, 0.06, 0);
    leftPauldron.castShadow = true;
    this.heroLeftArmPivot.add(leftPauldron);

    const leftPauldronTrim = new THREE.Mesh(
      new THREE.BoxGeometry(0.44, 0.08, 0.46),
      armorGoldMat,
    );
    leftPauldronTrim.position.set(-0.06, 0.16, 0);
    this.heroLeftArmPivot.add(leftPauldronTrim);

    const leftHand = new THREE.Mesh(handGeo, armorDarkMat);
    leftHand.position.set(0, -0.9, 0.08);
    leftHand.rotation.x = Math.PI / 2;
    leftHand.castShadow = true;
    this.heroLeftArmPivot.add(leftHand);
    this.heroGroup.add(this.heroLeftArmPivot);

    // Pivô do Braço Direito com Socket de Arma
    this.heroRightArmPivot = new THREE.Group();
    this.heroRightArmPivot.position.set(0.68, 2.1, 0);

    const rightArm = new THREE.Mesh(armGeo, armorCobaltMat);
    rightArm.position.set(0, -0.45, 0);
    rightArm.castShadow = true;
    this.heroRightArmPivot.add(rightArm);

    // Ombreira tática direita acoplada ao pivô do braço
    const rightPauldron = new THREE.Mesh(pauldronGeo, armorDarkMat);
    rightPauldron.position.set(0.06, 0.06, 0);
    rightPauldron.castShadow = true;
    this.heroRightArmPivot.add(rightPauldron);

    const rightPauldronTrim = new THREE.Mesh(
      new THREE.BoxGeometry(0.44, 0.08, 0.46),
      armorGoldMat,
    );
    rightPauldronTrim.position.set(0.06, 0.16, 0);
    this.heroRightArmPivot.add(rightPauldronTrim);

    const rightHand = new THREE.Mesh(handGeo, armorDarkMat);
    rightHand.position.set(0, -0.9, 0.08);
    rightHand.rotation.x = Math.PI / 2;
    rightHand.castShadow = true;
    this.heroRightArmPivot.add(rightHand);

    // Socket de acoplamento de armas na mão direita
    this.rightHandWeaponSocket = new THREE.Group();
    this.rightHandWeaponSocket.position.set(0, -0.9, 0.2);
    this.heroRightArmPivot.add(this.rightHandWeaponSocket);
    this.heroGroup.add(this.heroRightArmPivot);

    // 7. Jetpack com Turbinas Gêmeas e Cones de Plasma (Twin-Thruster Backpack)
    const backpackGeo = new THREE.BoxGeometry(0.78, 0.85, 0.32);
    const backpack = new THREE.Mesh(backpackGeo, armorDarkMat);
    backpack.position.set(0, 1.65, -0.42);
    backpack.castShadow = true;
    this.heroGroup.add(backpack);

    const thrusterGeo = new THREE.CylinderGeometry(0.12, 0.15, 0.65, 16);
    const nozzleGeo = new THREE.CylinderGeometry(0.16, 0.13, 0.12, 16);
    const plasmaConeGeo = new THREE.ConeGeometry(0.11, 0.35, 12);

    // Turbina Esquerda
    const leftThruster = new THREE.Mesh(thrusterGeo, armorCobaltMat);
    leftThruster.position.set(-0.28, 1.65, -0.54);
    leftThruster.castShadow = true;
    this.heroGroup.add(leftThruster);

    const leftNozzle = new THREE.Mesh(nozzleGeo, armorGoldMat);
    leftNozzle.position.set(-0.28, 1.28, -0.54);
    this.heroGroup.add(leftNozzle);

    const leftPlasma = new THREE.Mesh(plasmaConeGeo, thrusterPlasmaMat);
    leftPlasma.rotation.x = Math.PI;
    leftPlasma.position.set(-0.28, 1.05, -0.54);
    this.heroGroup.add(leftPlasma);

    // Turbina Direita
    const rightThruster = new THREE.Mesh(thrusterGeo, armorCobaltMat);
    rightThruster.position.set(0.28, 1.65, -0.54);
    rightThruster.castShadow = true;
    this.heroGroup.add(rightThruster);

    const rightNozzle = new THREE.Mesh(nozzleGeo, armorGoldMat);
    rightNozzle.position.set(0.28, 1.28, -0.54);
    this.heroGroup.add(rightNozzle);

    const rightPlasma = new THREE.Mesh(plasmaConeGeo, thrusterPlasmaMat);
    rightPlasma.rotation.x = Math.PI;
    rightPlasma.position.set(0.28, 1.05, -0.54);
    this.heroGroup.add(rightPlasma);

    // Acopla a arma equipada inicial na mão
    this.updateHandWeaponVisual(this.world.getEquippedWeapon());

    this.scene.add(this.heroGroup);
  }

  /**
   * Atualiza a malha 3D da arma visível empunhada na mão direita do herói.
   */
  public updateHandWeaponVisual(weaponType: WeaponType): void {
    if (!this.rightHandWeaponSocket) return;

    if (this.currentWeaponMeshInHand) {
      this.rightHandWeaponSocket.remove(this.currentWeaponMeshInHand);
      this.disposeObject3D(this.currentWeaponMeshInHand);
      this.currentWeaponMeshInHand = null;
    }

    const weaponMesh = this.createHandWeaponMesh(weaponType);
    this.rightHandWeaponSocket.add(weaponMesh);
    this.currentWeaponMeshInHand = weaponMesh;
  }

  /**
   * Cria o modelo 3D em blocos da arma empunhada na mão do herói.
   */
  private createHandWeaponMesh(weaponType: WeaponType): THREE.Object3D {
    const group = new THREE.Group();

    if (weaponType === 'stud_blaster') {
      // Punho
      const gripGeo = new THREE.BoxGeometry(0.08, 0.22, 0.1);
      const gripMat = new THREE.MeshStandardMaterial({ color: 0x111827, roughness: 0.5 });
      const grip = new THREE.Mesh(gripGeo, gripMat);
      grip.position.set(0, -0.06, 0);
      group.add(grip);

      // Corpo Amarelo LEGO
      const bodyGeo = new THREE.BoxGeometry(0.14, 0.16, 0.38);
      const bodyMat = new THREE.MeshStandardMaterial({ color: 0xfcd116, roughness: 0.3, metalness: 0.2 });
      const body = new THREE.Mesh(bodyGeo, bodyMat);
      body.position.set(0, 0.05, 0.1);
      group.add(body);

      // Cano Metálico Dourado
      const barrelGeo = new THREE.CylinderGeometry(0.055, 0.055, 0.24, 10);
      const barrelMat = new THREE.MeshStandardMaterial({
        color: 0xf59e0b,
        emissive: 0xd97706,
        emissiveIntensity: 0.6,
        metalness: 0.8,
      });
      const barrel = new THREE.Mesh(barrelGeo, barrelMat);
      barrel.rotation.x = Math.PI / 2;
      barrel.position.set(0, 0.05, 0.34);
      group.add(barrel);

      // Stud luminoso frontal
      const tipGeo = new THREE.CylinderGeometry(0.04, 0.04, 0.06, 8);
      const tipMat = new THREE.MeshStandardMaterial({
        color: 0xfef08a,
        emissive: 0xfef08a,
        emissiveIntensity: 1.6,
      });
      const tip = new THREE.Mesh(tipGeo, tipMat);
      tip.rotation.x = Math.PI / 2;
      tip.position.set(0, 0.05, 0.48);
      group.add(tip);
    } else if (weaponType === 'scatter_shot') {
      // Punho e coronha
      const stockGeo = new THREE.BoxGeometry(0.1, 0.22, 0.2);
      const stockMat = new THREE.MeshStandardMaterial({ color: 0x1f2937, roughness: 0.6 });
      const stock = new THREE.Mesh(stockGeo, stockMat);
      stock.position.set(0, -0.04, -0.05);
      group.add(stock);

      // Câmara Robusta
      const chamberGeo = new THREE.BoxGeometry(0.2, 0.2, 0.42);
      const chamberMat = new THREE.MeshStandardMaterial({ color: 0x0284c7, roughness: 0.3, metalness: 0.3 });
      const chamber = new THREE.Mesh(chamberGeo, chamberMat);
      chamber.position.set(0, 0.06, 0.15);
      group.add(chamber);

      // 3 Canos Frontais Curtos
      const pipeGeo = new THREE.CylinderGeometry(0.038, 0.038, 0.22, 8);
      const pipeMat = new THREE.MeshStandardMaterial({
        color: 0x38bdf8,
        emissive: 0x0284c7,
        emissiveIntensity: 1.0,
      });

      const pipe1 = new THREE.Mesh(pipeGeo, pipeMat);
      pipe1.rotation.x = Math.PI / 2;
      pipe1.position.set(-0.06, 0.06, 0.42);
      group.add(pipe1);

      const pipe2 = new THREE.Mesh(pipeGeo, pipeMat);
      pipe2.rotation.x = Math.PI / 2;
      pipe2.position.set(0.06, 0.06, 0.42);
      group.add(pipe2);

      const pipe3 = new THREE.Mesh(pipeGeo, pipeMat);
      pipe3.rotation.x = Math.PI / 2;
      pipe3.position.set(0, 0.12, 0.42);
      group.add(pipe3);
    } else if (weaponType === 'spring_mine') {
      // Disco da mina empunhada na mão
      const discGeo = new THREE.CylinderGeometry(0.22, 0.24, 0.08, 14);
      const discMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.4, metalness: 0.7 });
      const disc = new THREE.Mesh(discGeo, discMat);
      disc.rotation.x = Math.PI / 4;
      disc.position.set(0, 0.04, 0.15);
      group.add(disc);

      // Sensor central vermelho pulsante
      const sensorGeo = new THREE.CylinderGeometry(0.08, 0.08, 0.1, 10);
      const sensorMat = new THREE.MeshStandardMaterial({
        color: 0xef4444,
        emissive: 0xdc2626,
        emissiveIntensity: 2.2,
      });
      const sensor = new THREE.Mesh(sensorGeo, sensorMat);
      sensor.rotation.x = Math.PI / 4;
      sensor.position.set(0, 0.08, 0.18);
      group.add(sensor);
    }

    return group;
  }

  /**
   * Executa animações procedurais fluidas a 60 FPS nos membros articulados do herói.
   */
  private animateHeroProcedural(delta: number, time: number): void {
    if (
      !this.heroLeftLegPivot ||
      !this.heroRightLegPivot ||
      !this.heroLeftArmPivot ||
      !this.heroRightArmPivot
    ) {
      return;
    }

    const isDriving = this.world.isDriving();
    const heroController = this.world.heroController;
    const hero = this.world.heroTransform;

    if (isDriving) {
      // Postura de Pilotagem no Cockpit do Buggy
      this.heroLeftLegPivot.rotation.x = -Math.PI / 2.3;
      this.heroRightLegPivot.rotation.x = -Math.PI / 2.3;
      this.heroLeftLegPivot.rotation.z = 0.05;
      this.heroRightLegPivot.rotation.z = -0.05;

      this.heroLeftArmPivot.rotation.x = -Math.PI / 3.2;
      this.heroLeftArmPivot.rotation.z = 0.25;
      this.heroRightArmPivot.rotation.x = -Math.PI / 3.2;
      this.heroRightArmPivot.rotation.z = -0.25;

      if (this.rightHandWeaponSocket) {
        this.rightHandWeaponSocket.visible = false;
      }
      return;
    }

    // A pé: arma visível
    if (this.rightHandWeaponSocket) {
      this.rightHandWeaponSocket.visible = true;
    }

    // 1. Tratamento do Recuo de Tiro (Recoil) com mira 3D
    let isRecoilActive = false;
    const aimDx = this.aimTarget3D.x - hero.x;
    const aimDy = this.aimTarget3D.y - (hero.y + 1.2);
    const aimDz = this.aimTarget3D.z - hero.z;
    const aimPitch = Math.atan2(aimDy, Math.hypot(aimDx, aimDz));

    if (this.shootRecoilTimer > 0) {
      this.shootRecoilTimer = Math.max(0, this.shootRecoilTimer - delta);
      isRecoilActive = true;
      const progress = this.shootRecoilTimer / 0.22; // 1 -> 0

      // Braço direito sobe mirando com base no pitch 3D e recua com coice
      this.heroRightArmPivot.rotation.x = -Math.PI / 2.05 - aimPitch + progress * 0.42;
      this.heroRightArmPivot.rotation.y = 0.12;
      this.heroRightArmPivot.rotation.z = -0.05;
    }

    // 2. Animação de Pulo / Queda
    const isGrounded = hero.y <= 0.01 && (heroController.isGrounded ?? true);
    if (!isGrounded) {
      // Pernas dobram levemente para trás
      this.heroLeftLegPivot.rotation.x = -0.4;
      this.heroRightLegPivot.rotation.x = -0.28;
      this.heroLeftLegPivot.rotation.z = 0.06;
      this.heroRightLegPivot.rotation.z = -0.06;

      // Braço esquerdo abre em equilíbrio
      this.heroLeftArmPivot.rotation.z = 0.45;
      this.heroLeftArmPivot.rotation.x = -0.25;

      if (!isRecoilActive) {
        this.heroRightArmPivot.rotation.z = -0.45;
        this.heroRightArmPivot.rotation.x = -0.25;
        this.heroRightArmPivot.rotation.y = 0;
      }
      return;
    }

    // 3. Animação de Corrida / Andar no Solo (Walk Cycle)
    if (heroController.isMoving) {
      const walkFreq = 12.0;
      const legSwing = Math.sin(time * walkFreq) * 0.65;

      this.heroLeftLegPivot.rotation.x = legSwing;
      this.heroRightLegPivot.rotation.x = -legSwing;
      this.heroLeftLegPivot.rotation.z = 0;
      this.heroRightLegPivot.rotation.z = 0;

      this.heroLeftArmPivot.rotation.x = -legSwing * 0.75;
      this.heroLeftArmPivot.rotation.z = 0.12;

      if (!isRecoilActive) {
        this.heroRightArmPivot.rotation.x = legSwing * 0.75;
        this.heroRightArmPivot.rotation.y = 0;
        this.heroRightArmPivot.rotation.z = -0.12;
      }
      return;
    }

    // 4. Parado no Solo (Idle) - Postura ereta firme e respiração suave
    const idleLerp = Math.min(1, delta * 10.0);
    this.heroLeftLegPivot.rotation.x += (0 - this.heroLeftLegPivot.rotation.x) * idleLerp;
    this.heroRightLegPivot.rotation.x += (0 - this.heroRightLegPivot.rotation.x) * idleLerp;
    this.heroLeftLegPivot.rotation.z = 0;
    this.heroRightLegPivot.rotation.z = 0;

    const breathe = Math.sin(time * 3.0) * 0.04;
    this.heroLeftArmPivot.rotation.x += (0 - this.heroLeftArmPivot.rotation.x) * idleLerp;
    this.heroLeftArmPivot.rotation.z = 0.12 + breathe;

    if (!isRecoilActive) {
      this.heroRightArmPivot.rotation.x += (0 - this.heroRightArmPivot.rotation.x) * idleLerp;
      this.heroRightArmPivot.rotation.y += (0 - this.heroRightArmPivot.rotation.y) * idleLerp;
      this.heroRightArmPivot.rotation.z = -0.12 - breathe;
    }
  }

  /**
   * Cria uma malha 3D de herói de blocos para representar jogadores remotos (Multiplayer).
   */
  public createRemoteHeroMesh(colorHex = 0x10b981): THREE.Group {
    const group = new THREE.Group();

    const headMat = new THREE.MeshStandardMaterial({ color: 0xfcd116, roughness: 0.35, metalness: 0.05 });
    const torsoMat = new THREE.MeshStandardMaterial({ color: colorHex, roughness: 0.3, metalness: 0.1 });
    const hipsMat = new THREE.MeshStandardMaterial({ color: 0x1f2937, roughness: 0.4, metalness: 0.1 });
    const legsMat = new THREE.MeshStandardMaterial({ color: 0x0284c7, roughness: 0.35, metalness: 0.1 });
    const visorMat = new THREE.MeshStandardMaterial({
      color: 0x38bdf8,
      roughness: 0.15,
      metalness: 0.8,
      emissive: 0x0284c7,
      emissiveIntensity: 0.6,
    });

    const legGeo = new THREE.BoxGeometry(0.38, 0.9, 0.45);
    const leftLeg = new THREE.Mesh(legGeo, legsMat);
    leftLeg.position.set(-0.25, 0.45, 0);
    leftLeg.castShadow = true;
    group.add(leftLeg);

    const rightLeg = new THREE.Mesh(legGeo, legsMat);
    rightLeg.position.set(0.25, 0.45, 0);
    rightLeg.castShadow = true;
    group.add(rightLeg);

    const hipsGeo = new THREE.BoxGeometry(0.92, 0.25, 0.5);
    const hips = new THREE.Mesh(hipsGeo, hipsMat);
    hips.position.set(0, 0.98, 0);
    hips.castShadow = true;
    group.add(hips);

    const torsoGeo = new THREE.BoxGeometry(1.0, 1.1, 0.6);
    const torso = new THREE.Mesh(torsoGeo, torsoMat);
    torso.position.set(0, 1.65, 0);
    torso.castShadow = true;
    group.add(torso);

    const headGeo = new THREE.CylinderGeometry(0.36, 0.36, 0.6, 20);
    const head = new THREE.Mesh(headGeo, headMat);
    head.position.set(0, 2.45, 0);
    head.castShadow = true;
    group.add(head);

    const studGeo = new THREE.CylinderGeometry(0.16, 0.16, 0.16, 16);
    const headStud = new THREE.Mesh(studGeo, headMat);
    headStud.position.set(0, 2.82, 0);
    headStud.castShadow = true;
    group.add(headStud);

    const visorGeo = new THREE.BoxGeometry(0.5, 0.16, 0.16);
    const visor = new THREE.Mesh(visorGeo, visorMat);
    visor.position.set(0, 2.48, 0.32);
    group.add(visor);

    const armGeo = new THREE.BoxGeometry(0.26, 0.85, 0.3);
    const leftArm = new THREE.Mesh(armGeo, torsoMat);
    leftArm.position.set(-0.68, 1.65, 0);
    leftArm.castShadow = true;
    group.add(leftArm);

    const rightArm = new THREE.Mesh(armGeo, torsoMat);
    rightArm.position.set(0.68, 1.65, 0);
    rightArm.castShadow = true;
    group.add(rightArm);

    return group;
  }

  /**
   * Processa snapshots autoritativos recebidos do servidor NestJS:
   * 1. Reconciliação do jogador local.
   * 2. Criação/atualização/remoção das malhas dos jogadores remotos.
   */
  public handleServerSnapshot(snapshot: WorldStateSnapshot): void {
    const localId = this.networkService.localPlayerId();
    if (localId) {
      this.world.reconcileServerSnapshot(snapshot, localId);
    }

    const currentRemoteIds = new Set<string>();

    for (const player of snapshot.players) {
      if (player.id === localId) {
        continue;
      }

      currentRemoteIds.add(player.id);
      let visual = this.remotePlayerVisuals.get(player.id);

      if (!visual && this.scene) {
        const mesh = this.createRemoteHeroMesh();
        mesh.position.set(player.x, player.y, player.z);
        mesh.rotation.y = player.rotationY;
        this.scene.add(mesh);

        visual = {
          mesh,
          currentX: player.x,
          currentY: player.y,
          currentZ: player.z,
          currentRotationY: player.rotationY,
          targetX: player.x,
          targetY: player.y,
          targetZ: player.z,
          targetRotationY: player.rotationY,
          name: player.name,
        };
        this.remotePlayerVisuals.set(player.id, visual);
      } else if (visual) {
        visual.targetX = player.x;
        visual.targetY = player.y;
        visual.targetZ = player.z;
        visual.targetRotationY = player.rotationY;
      }
    }

    // Limpa jogadores remotos desconectados da partida
    for (const [id, visual] of this.remotePlayerVisuals.entries()) {
      if (!currentRemoteIds.has(id)) {
        if (this.scene) {
          this.scene.remove(visual.mesh);
        }
        this.disposeObject3D(visual.mesh);
        this.remotePlayerVisuals.delete(id);
      }
    }
  }

  private disposeObject3D(obj: THREE.Object3D): void {
    obj.traverse((child) => {
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
  }

  /**
   * Equipa uma arma do arsenal fictício.
   */
  public equipWeapon(type: WeaponType): void {
    this.world.setEquippedWeapon(type);
    this.equippedWeapon.set(type);
    this.updateHandWeaponVisual(type);
  }

  /**
   * Altera o modo de jogo selecionado (Sobrevivência Co-op ou PvP Deathmatch).
   */
  public selectGameMode(mode: GameModeType): void {
    this.gameMode.set(mode);
    this.world.setGameMode(mode);
    this.networkService.setGameMode(mode);
  }

  /**
   * Alterna o estado de "Pronto" do jogador e inicia a partida.
   */
  public toggleReady(): void {
    const nextReady = !this.isPlayerReady();
    this.isPlayerReady.set(nextReady);
    this.networkService.setPlayerReady(nextReady);
    if (nextReady) {
      this.world.startMatch();
      this.matchState.set(this.world.matchState.state);
      this.currentWave.set(this.world.matchState.currentWave);
    }
  }

  /**
   * Seleciona um upgrade roguelite durante a wave_intermission e avança para a próxima onda.
   */
  public chooseUpgrade(upgradeId: string): void {
    this.world.selectUpgrade(upgradeId);
    this.networkService.selectUpgrade(upgradeId);
    this.matchState.set(this.world.matchState.state);
    this.currentWave.set(this.world.matchState.currentWave);
    this.upgradeOptions.set([]);
  }

  /**
   * Reinicia a partida para jogar novamente após vitória ou derrota.
   */
  public restartMatch(): void {
    this.world.resetMatch();
    this.matchState.set('waiting');
    this.isPlayerReady.set(false);
    this.networkService.setPlayerReady(false);
    this.currentWave.set(1);
    this.enemiesRemaining.set(0);
    this.upgradeOptions.set([]);
  }

  /**
   * Dispara a arma atual do jogador orientada pelo ponto 3D apontado pelo mouse na arena.
   */
  public handleShoot(): void {
    const isDriving = this.world.isDriving();
    const origin: Vector3D = isDriving
      ? {
          x: this.world.vehicleTransform.x,
          y: this.world.vehicleTransform.y + 0.6,
          z: this.world.vehicleTransform.z,
        }
      : {
          x: this.world.heroTransform.x,
          y: this.world.heroTransform.y + 1.2,
          z: this.world.heroTransform.z,
        };

    const dx = this.aimTarget3D.x - origin.x;
    const dy = this.aimTarget3D.y - origin.y;
    const dz = this.aimTarget3D.z - origin.z;
    const dist3D = Math.hypot(dx, dy, dz);

    let direction: Vector3D;
    if (dist3D > 0.05) {
      direction = { x: dx / dist3D, y: dy / dist3D, z: dz / dist3D };
    } else {
      const angle = isDriving
        ? this.world.vehicleTransform.rotationY
        : this.world.heroTransform.rotationY;
      direction = { x: Math.sin(angle), y: 0, z: Math.cos(angle) };
    }

    // Quando a pé, gira o corpo na direção horizontal da mira estilo Twin-Stick Shooter
    const distHorizontal = Math.hypot(dx, dz);
    if (!isDriving && distHorizontal > 0.05) {
      const aimAngle = Math.atan2(dx, dz);
      this.world.heroTransform.rotationY = aimAngle;
      if (this.heroGroup) {
        this.heroGroup.rotation.y = aimAngle;
      }
    }

    // Ajusta a inclinação do braço do herói conforme o ângulo de pitch 3D
    if (this.heroRightArmPivot && !isDriving) {
      const pitch = Math.atan2(dy, Math.hypot(dx, dz));
      this.heroRightArmPivot.rotation.x = -Math.PI / 2.05 - pitch;
    }

    const shootResult = this.world.shootCurrentWeapon(origin, direction);
    if (shootResult.success) {
      this.shootRecoilTimer = 0.22;
      this.isShootingRecoil.set(true);
      window.setTimeout(() => this.isShootingRecoil.set(false), 120);

      if (this.networkService.isConnected()) {
        this.networkService.shoot(
          shootResult.weaponType,
          shootResult.origin,
          shootResult.direction,
        );
      }
    }
  }

  /**
   * Cria o mesh 3D estilizado no tema LEGO para o projétil correspondente.
   */
  private createProjectileMesh(type: WeaponType): THREE.Object3D {
    const group = new THREE.Group();

    if (type === 'stud_blaster') {
      const cylGeo = new THREE.CylinderGeometry(0.18, 0.18, 0.35, 12);
      const cylMat = new THREE.MeshStandardMaterial({
        color: 0xfbbf24,
        emissive: 0xf59e0b,
        emissiveIntensity: 1.4,
        roughness: 0.2,
        metalness: 0.4,
      });
      const cyl = new THREE.Mesh(cylGeo, cylMat);
      cyl.rotation.x = Math.PI / 2;
      cyl.castShadow = true;
      group.add(cyl);

      // Stud frontal
      const studGeo = new THREE.CylinderGeometry(0.08, 0.08, 0.08, 8);
      const stud = new THREE.Mesh(studGeo, cylMat);
      stud.position.z = 0.2;
      stud.rotation.x = Math.PI / 2;
      group.add(stud);
    } else if (type === 'scatter_shot') {
      const boxGeo = new THREE.BoxGeometry(0.24, 0.24, 0.24);
      const colors = [0x38bdf8, 0xef4444, 0x10b981, 0xf59e0b];
      const randomColor = colors[Math.floor(Math.random() * colors.length)];
      const boxMat = new THREE.MeshStandardMaterial({
        color: randomColor,
        emissive: randomColor,
        emissiveIntensity: 1.2,
        roughness: 0.3,
      });
      const box = new THREE.Mesh(boxGeo, boxMat);
      box.castShadow = true;
      group.add(box);
    } else if (type === 'spring_mine') {
      // Base metálica de disco
      const baseGeo = new THREE.CylinderGeometry(0.42, 0.46, 0.1, 16);
      const baseMat = new THREE.MeshStandardMaterial({
        color: 0x1e293b,
        roughness: 0.4,
        metalness: 0.7,
      });
      const base = new THREE.Mesh(baseGeo, baseMat);
      base.position.y = 0.05;
      base.castShadow = true;
      base.receiveShadow = true;
      group.add(base);

      // Mola / Stud luminoso pulsante
      const lightGeo = new THREE.CylinderGeometry(0.14, 0.14, 0.16, 12);
      const lightMat = new THREE.MeshStandardMaterial({
        color: 0xef4444,
        emissive: 0xdc2626,
        emissiveIntensity: 2.2,
        roughness: 0.2,
      });
      const light = new THREE.Mesh(lightGeo, lightMat);
      light.position.y = 0.16;
      group.add(light);
    }

    return group;
  }

  /**
   * Sincroniza malhas Three.js dos projéteis ativos na simulação.
   */
  private syncProjectilesVisuals(): void {
    if (!this.scene) return;

    const activeIds = new Set<string>();

    for (const p of this.world.activeProjectiles) {
      activeIds.add(p.id);
      let mesh = this.projectileMeshes.get(p.id);

      if (!mesh) {
        mesh = this.createProjectileMesh(p.weaponType);
        this.scene.add(mesh);
        this.projectileMeshes.set(p.id, mesh);
      }

      mesh.position.set(p.x, p.y, p.z);
      if (!p.isMine && (p.vx !== 0 || p.vy !== 0 || p.vz !== 0)) {
        mesh.lookAt(p.x + p.vx, p.y + p.vy, p.z + p.vz);
      }
    }

    // Desaloca malhas de projéteis inativos/reciclados
    for (const [id, mesh] of this.projectileMeshes.entries()) {
      if (!activeIds.has(id)) {
        this.scene.remove(mesh);
        this.disposeObject3D(mesh);
        this.projectileMeshes.delete(id);
      }
    }
  }

  /**
   * Sincroniza malhas Three.js e animações procedurais dos inimigos LEGO ativos.
   */
  private syncEnemyVisuals(delta: number, time: number): void {
    if (!this.scene) return;

    const match = this.networkService.currentMatch() ?? this.world.matchState;
    const activeEnemyIds = new Set<string>();
    const lerpSpeed = Math.min(1, delta * 14.0);

    for (const enemy of match.enemies) {
      if (!enemy.active || enemy.health <= 0) continue;

      activeEnemyIds.add(enemy.id);
      let visual = this.enemyVisuals.get(enemy.id);

      if (!visual) {
        const mesh = createEnemyMesh(enemy.type);
        mesh.position.set(enemy.x, enemy.y, enemy.z);
        mesh.rotation.y = enemy.rotationY;
        this.scene.add(mesh);

        visual = {
          id: enemy.id,
          type: enemy.type,
          mesh,
          currentX: enemy.x,
          currentY: enemy.y,
          currentZ: enemy.z,
          currentRotationY: enemy.rotationY,
          targetX: enemy.x,
          targetY: enemy.y,
          targetZ: enemy.z,
          targetRotationY: enemy.rotationY,
          health: enemy.health,
          maxHealth: enemy.maxHealth,
        };
        this.enemyVisuals.set(enemy.id, visual);
      }

      visual.targetX = enemy.x;
      visual.targetY = enemy.y;
      visual.targetZ = enemy.z;
      visual.targetRotationY = enemy.rotationY;
      visual.health = enemy.health;

      // Interpolação suave
      visual.currentX += (visual.targetX - visual.currentX) * lerpSpeed;
      visual.currentY += (visual.targetY - visual.currentY) * lerpSpeed;
      visual.currentZ += (visual.targetZ - visual.currentZ) * lerpSpeed;

      let rotDiff = (visual.targetRotationY - visual.currentRotationY) % (Math.PI * 2);
      if (rotDiff > Math.PI) rotDiff -= Math.PI * 2;
      if (rotDiff < -Math.PI) rotDiff += Math.PI * 2;
      visual.currentRotationY += rotDiff * lerpSpeed;

      // Animações procedurais específicas por arquétipo
      let posY = visual.currentY;
      if (visual.type === 'scout_block') {
        const seed = parseInt(enemy.id.replace(/\D/g, '') || '0', 10);
        posY += Math.sin(time * 6.0 + seed) * 0.08;
      }

      visual.mesh.position.set(visual.currentX, posY, visual.currentZ);
      visual.mesh.rotation.y = visual.currentRotationY;
    }

    // Desaloca inimigos eliminados / inativos
    for (const [id, visual] of this.enemyVisuals.entries()) {
      if (!activeEnemyIds.has(id)) {
        this.scene.remove(visual.mesh);
        this.disposeObject3D(visual.mesh);
        this.enemyVisuals.delete(id);
      }
    }
  }

  /**
   * Registra um novo Floating Combat Text ao causar ou receber dano.
   */
  public addFloatingCombatText(
    x: number,
    y: number,
    z: number,
    amount: number,
    weaponType: WeaponType,
  ): void {
    let text = `-${Math.round(amount)}`;
    let color = '#fbbf24';
    let scale = 1.0;

    if (weaponType === 'spring_mine' || amount >= 45) {
      text = `💥 BOOM! -${Math.round(amount)}`;
      color = '#ef4444';
      scale = 1.35;
    } else if (weaponType === 'scatter_shot') {
      text = `-${Math.round(amount)}`;
      color = '#38bdf8';
      scale = 0.95;
    }

    this.floatingCombatTexts.push({
      id: this.nextFloatingId++,
      text,
      x,
      y: y + 0.4,
      z,
      color,
      life: 0,
      maxLife: 1.1,
      scale,
      screenX: 0,
      screenY: 0,
      opacity: 1,
      visible: true,
    });

    if (this.floatingCombatTexts.length > 25) {
      this.floatingCombatTexts.shift();
    }

    this.floatingTexts.set([...this.floatingCombatTexts]);
  }

  /**
   * Atualiza a elevação, fade-out e projeção 3D->2D dos Floating Combat Texts.
   */
  private updateFloatingTexts(delta: number): void {
    const container = this.containerRef?.nativeElement;
    const width = container?.clientWidth || 800;
    const height = container?.clientHeight || 600;

    for (let i = this.floatingCombatTexts.length - 1; i >= 0; i--) {
      const item = this.floatingCombatTexts[i];
      item.life += delta;
      if (item.life >= item.maxLife) {
        this.floatingCombatTexts.splice(i, 1);
        continue;
      }

      item.y += delta * 1.6;
      item.opacity = Math.max(0, 1 - item.life / item.maxLife);

      if (this.camera) {
        const v = new THREE.Vector3(item.x, item.y, item.z);
        v.project(this.camera);
        item.screenX = Math.round((v.x * 0.5 + 0.5) * width);
        item.screenY = Math.round((-(v.y * 0.5) + 0.5) * height);
        item.visible = v.z < 1;
      }
    }

    this.floatingTexts.set([...this.floatingCombatTexts]);
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

    // 7. Blocos Modulares Destrutíveis da Lataria (Lego-style Modular Blocks)
    this.modularBlockMeshes.clear();
    for (const block of this.world.modularVehicle.blocks) {
      const blockGeo = new THREE.BoxGeometry(block.size.w, block.size.h, block.size.d);
      const blockMat = new THREE.MeshStandardMaterial({
        color: block.colorHex,
        roughness: 0.35,
        metalness: 0.15,
      });

      const blockMesh = new THREE.Mesh(blockGeo, blockMat);
      blockMesh.position.set(block.relativePos.x, block.relativePos.y, block.relativePos.z);
      blockMesh.castShadow = true;
      blockMesh.receiveShadow = true;

      // Pino central decorativo (stud) no topo do bloco modular
      const studGeo = new THREE.CylinderGeometry(0.14, 0.14, 0.08, 12);
      const studMesh = new THREE.Mesh(studGeo, blockMat);
      studMesh.position.set(0, block.size.h / 2 + 0.04, 0);
      studMesh.castShadow = true;
      blockMesh.add(studMesh);

      this.modularBlockMeshes.set(block.id, blockMesh);
      this.vehicleGroup.add(blockMesh);
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
    this.camera.position.y = Math.max(0.4, this.lookAtY + this.currentRadius * cosPhi);
    this.camera.position.z = this.lookAtZ + this.currentRadius * sinPhi * cosTheta;

    let targetLookAtY = this.lookAtY;
    if (this.currentPhi > Math.PI / 2) {
      const skyAngle = this.currentPhi - Math.PI / 2;
      targetLookAtY += skyAngle * 7.0;
    }

    this.camera.lookAt(this.lookAtX, targetLookAtY, this.lookAtZ);
  }

  /**
   * Atualiza a mira 3D (aimTarget3D) e a orientação do herói a partir do raycaster da câmera.
   * Quando o mouse aponta para o chão perto dos pés ou atrás do herói, o alvo é projetado
   * no chão à frente do personagem, impedindo inversão de 180° e travamento ao andar com W.
   */
  private updateAimTarget(): void {
    if (!this.camera) {
      return;
    }

    this.raycaster.setFromCamera(this.mouseNDC, this.camera);
    const hitPoint = new THREE.Vector3();
    const hasGroundHit =
      this.raycaster.ray.direction.y < -0.02 &&
      Boolean(this.raycaster.ray.intersectPlane(this.groundPlane, hitPoint)) &&
      hitPoint.distanceTo(this.camera.position) < 100;

    const rayDirX = this.raycaster.ray.direction.x;
    const rayDirZ = this.raycaster.ray.direction.z;
    const rayHorizLen = Math.hypot(rayDirX, rayDirZ) || 0.001;
    const normDirX = rayDirX / rayHorizLen;
    const normDirZ = rayDirZ / rayHorizLen;

    const isDriving = this.world.isDriving();
    const refX = isDriving ? this.world.vehicleTransform.x : this.world.heroTransform.x;
    const refZ = isDriving ? this.world.vehicleTransform.z : this.world.heroTransform.z;

    if (hasGroundHit) {
      const toHitX = hitPoint.x - refX;
      const toHitZ = hitPoint.z - refZ;
      const forwardDist = toHitX * normDirX + toHitZ * normDirZ;

      // Se o impacto no chão estiver a pelo menos 2.0m à frente do personagem
      if (forwardDist >= 2.0) {
        this.aimTarget3D.copy(hitPoint);
      } else {
        // Se estiver muito próximo dos pés ou atrás do herói, projeta no chão à frente
        this.aimTarget3D.set(
          refX + normDirX * 3.5,
          0,
          refZ + normDirZ * 3.5,
        );
      }
    } else {
      // Ao apontar para o horizonte ou para o céu, projeta o ponto 3D no espaço a 50 unidades
      this.raycaster.ray.at(50, this.aimTarget3D);
    }

    // Se a pé, orienta a direção do herói sempre na direção em que o jogador está mirando
    if (!isDriving) {
      const aimAngle = Math.atan2(normDirX, normDirZ);
      this.world.heroTransform.rotationY = aimAngle;
      if (this.heroGroup) {
        this.heroGroup.rotation.y = aimAngle;
      }
    }
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
    } else if (code === 'KeyK') {
      if (!event.repeat && !this.world.isDriving() && this.world.vehicleTransform && this.world.getDurabilityPercentage() > 5) {
        this.world.forceDetachNextBlock();
      }
    } else if (code === 'KeyJ') {
      this.handleShoot();
    } else if (code === 'Digit1' || code === 'Numpad1') {
      this.equipWeapon('stud_blaster');
    } else if (code === 'Digit2' || code === 'Numpad2') {
      this.equipWeapon('scatter_shot');
    } else if (code === 'Digit3' || code === 'Numpad3') {
      this.equipWeapon('spring_mine');
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

    // Disparo primário via botão esquerdo do mouse
    if (event.button === 0) {
      this.handleShoot();
    }
  }

  private onPointerMove(event: PointerEvent): void {
    // 1. Atualiza coordenadas 2D da mira na tela
    const container = this.containerRef?.nativeElement;
    if (container) {
      const rect = container.getBoundingClientRect();
      this.crosshairX.set(event.clientX - rect.left);
      this.crosshairY.set(event.clientY - rect.top);
    } else {
      this.crosshairX.set(event.clientX);
      this.crosshairY.set(event.clientY);
    }

    // 2. Raycasting 3D no plano da arena ou projeção para o céu aberto
    const canvas = this.canvasRef?.nativeElement;
    if (canvas && this.camera) {
      const rect = canvas.getBoundingClientRect();
      const width = rect.width || window.innerWidth || 800;
      const height = rect.height || window.innerHeight || 600;

      this.mouseNDC.x = ((event.clientX - rect.left) / width) * 2 - 1;
      this.mouseNDC.y = -((event.clientY - rect.top) / height) * 2 + 1;

      this.updateAimTarget();
    }

    // 3. Rotação orbital suave da câmera
    if (this.previousPointerX === 0 && this.previousPointerY === 0) {
      this.previousPointerX = event.clientX;
      this.previousPointerY = event.clientY;
      return;
    }

    const deltaX = event.clientX - this.previousPointerX;
    const deltaY = event.clientY - this.previousPointerY;
    this.previousPointerX = event.clientX;
    this.previousPointerY = event.clientY;

    if (Math.abs(deltaX) > 120 || Math.abs(deltaY) > 120) {
      return;
    }

    this.userManualCameraRotation = true;
    const rotationSpeed = 0.005;
    this.targetTheta -= deltaX * rotationSpeed;
    this.targetPhi = Math.max(0.2, Math.min(Math.PI * 0.62, this.targetPhi - deltaY * rotationSpeed));
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
    // Envia o input local e enfileira no buffer de predição do cliente
    if (this.networkService.isConnected()) {
      const seq = this.networkService.sendInput({
        forward: this.world.inputState.forward,
        backward: this.world.inputState.backward,
        left: this.world.inputState.left,
        right: this.world.inputState.right,
        handbrake: this.world.inputState.handbrake,
        jump: Boolean(this.world.inputState.jump),
        interact: this.world.inputState.interact,
        dt: delta,
      });
      this.world.enqueuePendingInput(seq, this.world.inputState, delta);
    }

    // Se a pé, orienta a direção do herói para onde o mouse aponta na arena (twin-stick / strafe)
    if (!this.world.isDriving()) {
      if (this.camera) {
        this.updateAimTarget();
      } else {
        const dx = this.aimTarget3D.x - this.world.heroTransform.x;
        const dz = this.aimTarget3D.z - this.world.heroTransform.z;
        if (Math.hypot(dx, dz) > 0.15) {
          this.world.heroTransform.rotationY = Math.atan2(dx, dz);
        }
      }
    }

    // 1. Avança a simulação determinística do GameWorld
    this.world.step(delta);

    const isDriving = this.world.isDriving();
    const hero = this.world.heroTransform;
    const vehicle = this.world.vehicleTransform;
    const vehicleComp = this.world.vehicleComponent;

    // Detecta transição de entrada/saída do veículo para focar imediatamente nas costas
    if (!this.wasDriving && isDriving) {
      // Ao entrar no carro: foca imediatamente nas costas do veículo
      const behindVehicleTheta = vehicle.rotationY + Math.PI;
      this.targetTheta = behindVehicleTheta;
      this.currentTheta = behindVehicleTheta;
      this.targetPhi = Math.PI / 2.85;
      this.currentPhi = Math.PI / 2.85;
      this.targetRadius = 11.5;
      this.currentRadius = 11.5;
      this.idleTime = 0;
      this.lastVehicleRotationY = vehicle.rotationY;
    } else if (this.wasDriving && !isDriving) {
      // Ao sair do carro: foca imediatamente nas costas do herói
      const behindHeroTheta = hero.rotationY + Math.PI;
      this.targetTheta = behindHeroTheta;
      this.currentTheta = behindHeroTheta;
      this.targetRadius = 8.0;
      this.idleTime = 0;
    }
    this.wasDriving = isDriving;

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
            visualY += Math.abs(Math.sin(time * 12.0)) * 0.06;
          }
        }

        this.heroGroup.position.set(hero.x, visualY, hero.z);
        this.heroGroup.rotation.y = hero.rotationY;
        this.heroGroup.scale.set(1.0, 1.0, 1.0);
      }

      // Animações procedurais dos membros articulados (andar, pular, atirar, pilotar)
      this.animateHeroProcedural(delta, time);
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
    const targetTargetRadius = isDriving ? 11.5 : 8.0;
    const lerpFactor = Math.min(1, delta * 7.5);
    this.targetRadius += (targetTargetRadius - this.targetRadius) * (delta * 3.0);

    // Retorna suavemente à inclinação padrão apenas após inatividade prolongada (> 4.0 segundos)
    if (this.idleTime > 4.0) {
      const defaultTargetPhi = Math.PI / 2.85;
      this.targetPhi += (defaultTargetPhi - this.targetPhi) * (delta * 1.5);
    }

    const targetLookAtX = isDriving ? vehicle.x : hero.x;
    const targetLookAtY = isDriving ? 1.05 : 1.45 + Math.max(0, hero.y * 0.45);
    const targetLookAtZ = isDriving ? vehicle.z : hero.z;

    this.lookAtX += (targetLookAtX - this.lookAtX) * lerpFactor;
    this.lookAtY += (targetLookAtY - this.lookAtY) * lerpFactor;
    this.lookAtZ += (targetLookAtZ - this.lookAtZ) * lerpFactor;

    this.idleTime += delta;

    if (isDriving) {
      // 1. Conforme o veículo vira (curvas / esterçamento), a câmera acompanha a rotação mantendo o foco nas costas
      let vehicleRotDelta = (vehicle.rotationY - this.lastVehicleRotationY) % (Math.PI * 2);
      if (vehicleRotDelta > Math.PI) vehicleRotDelta -= Math.PI * 2;
      if (vehicleRotDelta < -Math.PI) vehicleRotDelta += Math.PI * 2;

      this.targetTheta += vehicleRotDelta;
      this.currentTheta += vehicleRotDelta;
      this.lastVehicleRotationY = vehicle.rotationY;

      // 2. Se o jogador não estiver mexendo o mouse ativamente (idleTime > 0.5s), alinha suavemente diretamente atrás do veículo
      if (this.idleTime > 0.5) {
        const behindVehicleTheta = vehicle.rotationY + Math.PI;
        let thetaDiff = (behindVehicleTheta - this.targetTheta) % (Math.PI * 2);
        if (thetaDiff > Math.PI) thetaDiff -= Math.PI * 2;
        if (thetaDiff < -Math.PI) thetaDiff += Math.PI * 2;

        const returnSpeed = Math.abs(vehicleComp.currentSpeed) > 1.0 ? 4.5 : 2.5;
        this.targetTheta += thetaDiff * Math.min(1, delta * returnSpeed);
      }
    } else {
      this.lastVehicleRotationY = vehicle.rotationY;
    }

    this.currentTheta += (this.targetTheta - this.currentTheta) * lerpFactor;
    this.currentPhi += (this.targetPhi - this.currentPhi) * lerpFactor;
    this.currentRadius += (this.targetRadius - this.currentRadius) * lerpFactor;

    this.updateCameraPosition();

    // Sincroniza a visibilidade dos blocos modulares da lataria
    for (const block of this.world.modularVehicle.blocks) {
      const blockMesh = this.modularBlockMeshes.get(block.id);
      if (blockMesh) {
        blockMesh.visible = !block.isDetached;
      }
    }

    // Sincronização visual de peças de detritos desprendidas da lataria
    if (this.scene) {
      const activeIds = new Set<number>();

      for (const p of this.world.activeDebris) {
        activeIds.add(p.id);
        let mesh = this.debrisMeshes.get(p.id);

        if (!mesh) {
          const debrisGeo = new THREE.BoxGeometry(p.size.w, p.size.h, p.size.d);
          const debrisMat = new THREE.MeshStandardMaterial({
            color: p.colorHex,
            roughness: 0.35,
            metalness: 0.2,
          });
          mesh = new THREE.Mesh(debrisGeo, debrisMat);
          mesh.castShadow = true;
          mesh.receiveShadow = true;
          this.scene.add(mesh);
          this.debrisMeshes.set(p.id, mesh);
        }

        mesh.position.set(p.x, p.y, p.z);
        mesh.rotation.set(p.rotX, p.rotY, p.rotZ);
      }

      for (const [id, mesh] of this.debrisMeshes.entries()) {
        if (!activeIds.has(id)) {
          this.scene.remove(mesh);
          mesh.geometry.dispose();
          if (Array.isArray(mesh.material)) {
            mesh.material.forEach((m) => m.dispose());
          } else {
            mesh.material.dispose();
          }
          this.debrisMeshes.delete(id);
        }
      }
    }

    // 4. Sincronização visual de projéteis e arsenal LEGO
    this.syncProjectilesVisuals();

    // 4.5. Sincronização visual de Inimigos de Blocos (Fase 7)
    this.syncEnemyVisuals(delta, time);

    // 5. Coleta de eventos de dano locais para Floating Combat Text
    const localDamageEvents = this.world.flushRecentDamageEvents();
    for (const dmg of localDamageEvents) {
      this.addFloatingCombatText(dmg.x, dmg.y, dmg.z, dmg.amount, dmg.weaponType);
    }

    // 6. Atualização de animação e projeção dos números flutuantes de dano
    this.updateFloatingTexts(delta);

    // 7. Interpolação suave (lerp) das entidades remotas (Multiplayer Visual)
    const remoteLerpSpeed = Math.min(1, delta * 15.0);
    for (const visual of this.remotePlayerVisuals.values()) {
      visual.currentX += (visual.targetX - visual.currentX) * remoteLerpSpeed;
      visual.currentY += (visual.targetY - visual.currentY) * remoteLerpSpeed;
      visual.currentZ += (visual.targetZ - visual.currentZ) * remoteLerpSpeed;

      let rotDiff = (visual.targetRotationY - visual.currentRotationY) % (Math.PI * 2);
      if (rotDiff > Math.PI) rotDiff -= Math.PI * 2;
      if (rotDiff < -Math.PI) rotDiff += Math.PI * 2;
      visual.currentRotationY += rotDiff * remoteLerpSpeed;

      visual.mesh.position.set(visual.currentX, visual.currentY, visual.currentZ);
      visual.mesh.rotation.y = visual.currentRotationY;
    }

    // 8. Atualização dos Sinais Reativos do HUD (a cada ~60ms para performance)
    this.hudUpdateTimer += delta;
    if (this.hudUpdateTimer >= 0.06) {
      this.hudUpdateTimer = 0;

      const currentKmh = this.world.getSpeedKmh();
      const currentDriving = this.world.isDriving();
      const currentInteract = this.world.canInteract();
      const currentDrift = this.world.isDrifting();
      const currentDurability = this.world.getDurabilityPercentage();
      const currentWeapon = this.world.getEquippedWeapon();
      const currentCooldownProgress = Math.round(this.world.getWeaponCooldownRatio() * 100);
      const match = this.networkService.currentMatch() ?? this.world.matchState;

      this.ngZone.run(() => {
        if (this.speedKmh() !== currentKmh) this.speedKmh.set(currentKmh);
        if (this.isDriving() !== currentDriving) this.isDriving.set(currentDriving);
        if (this.canInteract() !== currentInteract) this.canInteract.set(currentInteract);
        if (this.isDrifting() !== currentDrift) this.isDrifting.set(currentDrift);
        if (this.durabilityPercentage() !== currentDurability) {
          this.durabilityPercentage.set(currentDurability);
        }
        if (this.equippedWeapon() !== currentWeapon) this.equippedWeapon.set(currentWeapon);
        if (this.weaponCooldownProgress() !== currentCooldownProgress) {
          this.weaponCooldownProgress.set(currentCooldownProgress);
        }

        // Sinais de Partida e Inimigos da Fase 7
        if (this.matchState() !== match.state) this.matchState.set(match.state);
        if (this.gameMode() !== match.mode) this.gameMode.set(match.mode);
        if (this.currentWave() !== match.currentWave) this.currentWave.set(match.currentWave);
        if (this.enemiesRemaining() !== match.enemiesRemaining) {
          this.enemiesRemaining.set(match.enemiesRemaining);
        }
        const cdSec = Math.ceil(match.countdownSeconds);
        if (this.countdownSeconds() !== cdSec) this.countdownSeconds.set(cdSec);
        const intSec = Math.ceil(match.intermissionSeconds);
        if (this.intermissionSeconds() !== intSec) this.intermissionSeconds.set(intSec);
        if (this.upgradeOptions() !== (match.upgradeOptions ?? [])) {
          this.upgradeOptions.set(match.upgradeOptions ?? []);
        }
        if (this.playerScores() !== match.scores) this.playerScores.set(match.scores);
      });
    }
  }

  /**
   * Limpeza exaustiva de geometrias, materiais, texturas e renderer Three.js.
   */
  private disposeThreeResources(): void {
    for (const mesh of this.projectileMeshes.values()) {
      this.disposeObject3D(mesh);
    }
    this.projectileMeshes.clear();
    this.floatingCombatTexts.length = 0;
    this.floatingTexts.set([]);

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

    for (const visual of this.remotePlayerVisuals.values()) {
      this.disposeObject3D(visual.mesh);
    }
    this.remotePlayerVisuals.clear();

    for (const mesh of this.debrisMeshes.values()) {
      mesh.geometry.dispose();
      if (Array.isArray(mesh.material)) {
        mesh.material.forEach((mat: THREE.Material) => mat.dispose());
      } else if (mesh.material) {
        mesh.material.dispose();
      }
    }
    for (const visual of this.enemyVisuals.values()) {
      this.disposeObject3D(visual.mesh);
    }
    this.enemyVisuals.clear();
    this.debrisMeshes.clear();
    this.modularBlockMeshes.clear();
  }
}
