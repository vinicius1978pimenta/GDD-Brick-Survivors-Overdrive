import {
  AfterViewInit,
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  Inject,
  NgZone,
  OnDestroy,
  PLATFORM_ID,
  ViewChild,
} from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import * as THREE from 'three';

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

  private scene: THREE.Scene | null = null;
  private camera: THREE.PerspectiveCamera | null = null;
  private renderer: THREE.WebGLRenderer | null = null;
  private heroGroup: THREE.Group | null = null;
  private studTexture: THREE.CanvasTexture | null = null;

  private animationFrameId: number | null = null;
  private resizeObserver: ResizeObserver | null = null;
  private isDestroyed = false;

  // Parâmetros orbitais da câmera de 3ª pessoa
  private targetTheta = 0; // Azimute (rotação horizontal)
  private currentTheta = 0;
  private targetPhi = Math.PI / 3.2; // Elevação (ângulo polar)
  private currentPhi = Math.PI / 3.2;
  private targetRadius = 7.5; // Distância do herói
  private currentRadius = 7.5;

  private isDragging = false;
  private previousPointerX = 0;
  private previousPointerY = 0;
  private idleTime = 0;

  // Listeners vinculados para remoção limpa
  private boundOnPointerDown = this.onPointerDown.bind(this);
  private boundOnPointerMove = this.onPointerMove.bind(this);
  private boundOnPointerUp = this.onPointerUp.bind(this);
  private boundOnWheel = this.onWheel.bind(this);

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
   * Inicializa cena Three.js, iluminação, arena de blocos e personagem herói.
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

    // Configuração de Cena e Fog de atmosfera
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x101622);
    this.scene.fog = new THREE.FogExp2(0x101622, 0.025);

    // Câmera em perspectiva
    this.camera = new THREE.PerspectiveCamera(50, width / height, 0.1, 1000);
    this.updateCameraPosition();

    // Iluminação
    this.setupLighting();

    // Piso / Arena de Blocos
    this.createToyArena();

    // Herói de Blocos Geométrico
    this.createBlockHero();
  }

  /**
   * Checa se o contexto WebGL está disponível no ambiente atual.
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

    // Luz ambiente suave
    const ambientLight = new THREE.AmbientLight(0xdde6ed, 0.55);
    this.scene.add(ambientLight);

    // Luz hemisférica para contraste de cores de blocos
    const hemiLight = new THREE.HemisphereLight(0x60a5fa, 0x1e293b, 0.45);
    hemiLight.position.set(0, 30, 0);
    this.scene.add(hemiLight);

    // Luz direcional principal que projeta sombras
    const dirLight = new THREE.DirectionalLight(0xffffff, 1.25);
    dirLight.position.set(12, 18, 10);
    dirLight.castShadow = true;

    dirLight.shadow.mapSize.width = 2048;
    dirLight.shadow.mapSize.height = 2048;
    dirLight.shadow.camera.near = 0.5;
    dirLight.shadow.camera.far = 60;

    const shadowExtent = 18;
    dirLight.shadow.camera.left = -shadowExtent;
    dirLight.shadow.camera.right = shadowExtent;
    dirLight.shadow.camera.top = shadowExtent;
    dirLight.shadow.camera.bottom = -shadowExtent;
    dirLight.shadow.bias = -0.0004;

    this.scene.add(dirLight);

    // Luz de preenchimento suave traseira
    const rimLight = new THREE.DirectionalLight(0x38bdf8, 0.4);
    rimLight.position.set(-10, 8, -12);
    this.scene.add(rimLight);
  }

  /**
   * Cria o piso de arena com grid e textura de pinos (studs) de blocos de montar.
   */
  private createToyArena(): void {
    if (!this.scene) return;

    this.studTexture = this.generateStudTexture();

    // Base principal da arena
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

    // Grid tático sutil sobreposto aos blocos
    const gridHelper = new THREE.GridHelper(40, 20, 0xfcd116, 0x3b82f6);
    gridHelper.position.set(0, 0.01, 0);
    if (gridHelper.material instanceof THREE.Material) {
      gridHelper.material.opacity = 0.25;
      gridHelper.material.transparent = true;
    }
    this.scene.add(gridHelper);

    // Muretas decorativas de contenção da arena em blocos coloridos
    this.createArenaBorders();
  }

  /**
   * Gera textura procedural de pinos (LEGO-style studs) via canvas 2D.
   */
  private generateStudTexture(): THREE.CanvasTexture | null {
    if (typeof document === 'undefined') return null;

    try {
      const canvas = document.createElement('canvas');
      canvas.width = 256;
      canvas.height = 256;
      const ctx = canvas.getContext('2d');
      if (!ctx) return null;

      // Fundo cinza ardósia
      ctx.fillStyle = '#1e293b';
      ctx.fillRect(0, 0, 256, 256);

      const tileSize = 64;
      const radius = 17;

      for (let x = 0; x < 4; x++) {
        for (let y = 0; y < 4; y++) {
          const cx = x * tileSize + tileSize / 2;
          const cy = y * tileSize + tileSize / 2;

          // Contorno da divisão entre blocos
          ctx.strokeStyle = '#0f172a';
          ctx.lineWidth = 2;
          ctx.strokeRect(x * tileSize, y * tileSize, tileSize, tileSize);

          // Sombra projetada do pino
          ctx.beginPath();
          ctx.arc(cx, cy + 2, radius, 0, Math.PI * 2);
          ctx.fillStyle = 'rgba(0, 0, 0, 0.45)';
          ctx.fill();

          // Gradiente volumétrico do pino
          const grad = ctx.createRadialGradient(cx - 5, cy - 5, 2, cx, cy, radius);
          grad.addColorStop(0, '#475569');
          grad.addColorStop(0.8, '#334155');
          grad.addColorStop(1, '#1e293b');

          ctx.beginPath();
          ctx.arc(cx, cy, radius, 0, Math.PI * 2);
          ctx.fillStyle = grad;
          ctx.fill();

          // Anel iluminado do topo do pino
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

  /**
   * Cria blocos delimitadores ao redor da arena.
   */
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
   * Cria o personagem de blocos geométrico (herói de blocos com cabeça, tronco e membros estilizados).
   */
  private createBlockHero(): void {
    if (!this.scene) return;

    this.heroGroup = new THREE.Group();
    this.heroGroup.position.set(0, 0, 0);

    // Materiais plásticos com acabamento de brinquedo de montar
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

    // 1. Pernas e Pés
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

    // Pés com elevação frontal característica
    const footGeo = new THREE.BoxGeometry(0.38, 0.2, 0.2);
    const leftFoot = new THREE.Mesh(footGeo, legsMat);
    leftFoot.position.set(-0.25, 0.1, 0.3);
    leftFoot.castShadow = true;
    this.heroGroup.add(leftFoot);

    const rightFoot = new THREE.Mesh(footGeo, legsMat);
    rightFoot.position.set(0.25, 0.1, 0.3);
    rightFoot.castShadow = true;
    this.heroGroup.add(rightFoot);

    // 2. Quadril / Conector da Cintura
    const hipsGeo = new THREE.BoxGeometry(0.92, 0.25, 0.5);
    const hips = new THREE.Mesh(hipsGeo, hipsMat);
    hips.position.set(0, 0.98, 0);
    hips.castShadow = true;
    this.heroGroup.add(hips);

    // 3. Tronco (com leve afunilamento trapezoidal típico de minifig)
    const torsoGeo = new THREE.BoxGeometry(1.0, 1.1, 0.6);
    const torso = new THREE.Mesh(torsoGeo, torsoMat);
    torso.position.set(0, 1.65, 0);
    torso.castShadow = true;
    torso.receiveShadow = true;
    this.heroGroup.add(torso);

    // 4. Cabeça Cilíndrica e Pino Superior
    const headGeo = new THREE.CylinderGeometry(0.36, 0.36, 0.6, 20);
    const head = new THREE.Mesh(headGeo, headMat);
    head.position.set(0, 2.45, 0);
    head.castShadow = true;
    this.heroGroup.add(head);

    // Pino clássico no topo da cabeça (Stud)
    const studGeo = new THREE.CylinderGeometry(0.16, 0.16, 0.16, 16);
    const headStud = new THREE.Mesh(studGeo, headMat);
    headStud.position.set(0, 2.82, 0);
    headStud.castShadow = true;
    this.heroGroup.add(headStud);

    // Visor Cyber-Hero nos olhos
    const visorGeo = new THREE.BoxGeometry(0.5, 0.16, 0.16);
    const visor = new THREE.Mesh(visorGeo, visorMat);
    visor.position.set(0, 2.48, 0.32);
    this.heroGroup.add(visor);

    // 5. Braços e Mãos em Garra
    const armGeo = new THREE.BoxGeometry(0.26, 0.85, 0.3);
    const handGeo = new THREE.CylinderGeometry(0.12, 0.12, 0.16, 12);

    // Braço Esquerdo
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

    // Braço Direito (em pose heróica ligeiramente à frente)
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

    // 6. Mochila Survivor de Sobrevivência (Backpack com bateria)
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
   * Atualiza a posição esférica da câmera em terceira pessoa em torno do herói.
   */
  private updateCameraPosition(): void {
    if (!this.camera) return;

    const heroCenterY = 1.35;
    const sinPhi = Math.sin(this.currentPhi);
    const cosPhi = Math.cos(this.currentPhi);
    const sinTheta = Math.sin(this.currentTheta);
    const cosTheta = Math.cos(this.currentTheta);

    this.camera.position.x = this.currentRadius * sinPhi * sinTheta;
    this.camera.position.y = heroCenterY + this.currentRadius * cosPhi;
    this.camera.position.z = this.currentRadius * sinPhi * cosTheta;

    this.camera.lookAt(0, heroCenterY, 0);
  }

  /**
   * Monitoramento responsivo do container via ResizeObserver.
   */
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
   * Interatividade de controle da câmera por mouse/touch.
   */
  private attachEventListeners(): void {
    const canvas = this.canvasRef?.nativeElement;
    if (!canvas) return;

    canvas.addEventListener('pointerdown', this.boundOnPointerDown);
    window.addEventListener('pointermove', this.boundOnPointerMove);
    window.addEventListener('pointerup', this.boundOnPointerUp);
    canvas.addEventListener('wheel', this.boundOnWheel, { passive: false });
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
    }
  }

  private onPointerDown(event: PointerEvent): void {
    this.isDragging = true;
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
    this.targetRadius = Math.max(3.5, Math.min(16.0, this.targetRadius + event.deltaY * zoomSpeed));
    this.idleTime = 0;
  }

  /**
   * Game loop fluido mirando 60 FPS executando fora da zona do Angular.
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
   * Atualização de animações: rotação suave da câmera (damping) e idle breathing do herói.
   */
  private updateGameLogic(delta: number, time: number): void {
    // Rotação suave da câmera com interpolação suave (Lerp)
    const lerpFactor = Math.min(1, delta * 9);

    if (!this.isDragging) {
      this.idleTime += delta;
      // Rotação sutil automática de inspeção quando ocioso
      if (this.idleTime > 1.2) {
        this.targetTheta += delta * 0.22;
      }
    }

    this.currentTheta += (this.targetTheta - this.currentTheta) * lerpFactor;
    this.currentPhi += (this.targetPhi - this.currentPhi) * lerpFactor;
    this.currentRadius += (this.targetRadius - this.currentRadius) * lerpFactor;

    this.updateCameraPosition();

    // Animação sutil heróica (respiração / bobbing de blocos)
    if (this.heroGroup) {
      this.heroGroup.position.y = Math.sin(time * 3.0) * 0.04;
      this.heroGroup.rotation.y = Math.sin(time * 1.5) * 0.06;
    }
  }

  /**
   * Limpeza de geometrias, materiais, texturas e renderer Three.js.
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
  }
}
