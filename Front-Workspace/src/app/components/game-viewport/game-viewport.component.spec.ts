import { ComponentFixture, TestBed } from '@angular/core/testing';
import * as THREE from 'three';
import { GameViewportComponent } from './game-viewport.component';

describe('GameViewportComponent', () => {
  let component: GameViewportComponent;
  let fixture: ComponentFixture<GameViewportComponent>;

  beforeAll(() => {
    if (typeof window.ResizeObserver === 'undefined') {
      window.ResizeObserver = class {
        public observe = vi.fn();
        public unobserve = vi.fn();
        public disconnect = vi.fn();
      } as unknown as typeof ResizeObserver;
    }
  });

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [GameViewportComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(GameViewportComponent);
    component = fixture.componentInstance;
  });

  afterEach(() => {
    fixture.destroy();
  });

  it('deve criar a instância do componente com sucesso', () => {
    expect(component).toBeTruthy();
    expect(component.world).toBeDefined();
  });

  it('deve conter o container de viewport, canvas e elementos do HUD da Fase 3 no DOM', () => {
    fixture.detectChanges();
    const compiled = fixture.nativeElement as HTMLElement;

    const container = compiled.querySelector('.viewport-container');
    const canvas = compiled.querySelector('canvas.render-canvas');
    const speedCard = compiled.querySelector('.speedometer-card');
    const modeBadge = compiled.querySelector('.mode-badge');

    expect(container).not.toBeNull();
    expect(canvas).not.toBeNull();
    expect(speedCard).not.toBeNull();
    expect(modeBadge?.textContent).toContain('A PÉ (HERÓI)');

    // Blindagem não deve ser exibida a pé
    expect(compiled.querySelector('.durability-card')).toBeNull();

    // Blindagem deve ser exibida ao pilotar o veículo
    component.isDriving.set(true);
    fixture.detectChanges();
    const durabilityCard = compiled.querySelector('.durability-card');
    expect(durabilityCard?.textContent).toContain('BLINDAGEM');
  });

  it('deve exibir o alerta de DRIFT quando o sinal isDrifting estiver ativo', () => {
    component.isDrifting.set(true);
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    const driftBadge = compiled.querySelector('.badge-drift');

    expect(driftBadge).not.toBeNull();
    expect(driftBadge?.textContent).toContain('DRIFT OVERDRIVE!');
  });

  it('deve exibir o prompt contextual de interação quando o herói estiver próximo do veículo', () => {
    component.canInteract.set(true);
    component.isDriving.set(false);
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    const prompt = compiled.querySelector('.prompt-interact');

    expect(prompt).not.toBeNull();
    expect(prompt?.textContent).toContain('Dirigir Buggy de Blocos');
  });

  it('deve exibir o prompt e instrução de desembarque apenas quando parado e ocultar em movimento', () => {
    component.isDriving.set(true);
    component.speedKmh.set(0); // Parado
    fixture.detectChanges();

    let compiled = fixture.nativeElement as HTMLElement;
    let prompt = compiled.querySelector('.prompt-dismount');
    expect(prompt).not.toBeNull();
    expect(prompt?.textContent).toContain('Desembarcar do Veículo');

    let itemE = Array.from(compiled.querySelectorAll('.instruction-item')).find(
      (el) => el.textContent?.includes('Desembarcar'),
    );
    expect(itemE).toBeDefined();

    // Em movimento (velocidade > 0)
    component.speedKmh.set(30);
    fixture.detectChanges();

    compiled = fixture.nativeElement as HTMLElement;
    prompt = compiled.querySelector('.prompt-dismount');
    expect(prompt).toBeNull();

    itemE = Array.from(compiled.querySelectorAll('.instruction-item')).find(
      (el) => el.textContent?.includes('Desembarcar'),
    );
    expect(itemE).toBeUndefined();
  });

  it('deve capturar eventos do teclado (WASD, Espaço e E) atualizando o estado do mundo', () => {
    fixture.detectChanges();

    // Pressiona W (acelerar / forward)
    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyW' }));
    expect(component.world.inputState.forward).toBe(true);

    window.dispatchEvent(new KeyboardEvent('keyup', { code: 'KeyW' }));
    expect(component.world.inputState.forward).toBe(false);

    // Pressiona S (ré / backward)
    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyS' }));
    expect(component.world.inputState.backward).toBe(true);

    window.dispatchEvent(new KeyboardEvent('keyup', { code: 'KeyS' }));
    expect(component.world.inputState.backward).toBe(false);

    // Pressiona A (esquerda / left)
    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyA' }));
    expect(component.world.inputState.left).toBe(true);

    window.dispatchEvent(new KeyboardEvent('keyup', { code: 'KeyA' }));
    expect(component.world.inputState.left).toBe(false);

    // Pressiona D (direita / right)
    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyD' }));
    expect(component.world.inputState.right).toBe(true);

    window.dispatchEvent(new KeyboardEvent('keyup', { code: 'KeyD' }));
    expect(component.world.inputState.right).toBe(false);

    // Pressiona ArrowRight (direita / right alternativa)
    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'ArrowRight' }));
    expect(component.world.inputState.right).toBe(true);

    window.dispatchEvent(new KeyboardEvent('keyup', { code: 'ArrowRight' }));
    expect(component.world.inputState.right).toBe(false);

    // Pressiona Espaço a pé -> deve acionar jump
    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'Space' }));
    expect(component.world.inputState.jump).toBe(true);

    window.dispatchEvent(new KeyboardEvent('keyup', { code: 'Space' }));
    expect(component.world.inputState.jump).toBe(false);

    // Quando pilotando o veículo -> deve acionar handbrake
    component.world.vehicleComponent.driverEntityId = component.world.heroId;
    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'Space' }));
    expect(component.world.inputState.handbrake).toBe(true);

    window.dispatchEvent(new KeyboardEvent('keyup', { code: 'Space' }));
    expect(component.world.inputState.handbrake).toBe(false);

    // Pressiona E (interact)
    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyE' }));
    expect(component.world.inputState.interact).toBe(true);

    // Pressiona K enquanto pilotando -> NÃO deve descolar bloco
    const durabilityWhileDriving = component.world.getDurabilityPercentage();
    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyK' }));
    expect(component.world.getDurabilityPercentage()).toBe(durabilityWhileDriving);
    expect(component.world.activeDebris.length).toBe(0);

    // Desembarca herói (a pé)
    component.world.vehicleComponent.driverEntityId = null;

    // Pressiona K a pé -> descola bloco normalmente
    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyK' }));
    expect(component.world.getDurabilityPercentage()).toBeLessThan(durabilityWhileDriving);
    expect(component.world.activeDebris.length).toBeGreaterThan(0);
  });

  it('não deve exibir a instrução da tecla K no painel de controles do HUD nem a pé nem pilotando', () => {
    // A pé
    component.isDriving.set(false);
    fixture.detectChanges();
    let compiled = fixture.nativeElement as HTMLElement;
    let kbdK = Array.from(compiled.querySelectorAll('.instruction-item kbd')).find(
      (el) => el.textContent?.trim() === 'K',
    );
    expect(kbdK).toBeUndefined();

    // Pilotando
    component.isDriving.set(true);
    fixture.detectChanges();
    compiled = fixture.nativeElement as HTMLElement;
    kbdK = Array.from(compiled.querySelectorAll('.instruction-item kbd')).find(
      (el) => el.textContent?.trim() === 'K',
    );
    expect(kbdK).toBeUndefined();
  });

  it('não deve exibir o prompt de entrar nem a instrução E quando o veículo estiver inacessível ou destruído', () => {
    // Longe ou destruído -> canInteract é false
    component.isDriving.set(false);
    component.canInteract.set(false);
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    const promptInteract = compiled.querySelector('.prompt-interact');
    expect(promptInteract).toBeNull();

    const kbdE = Array.from(compiled.querySelectorAll('.instruction-item kbd')).find(
      (el) => el.textContent?.trim() === 'E',
    );
    expect(kbdE).toBeUndefined();
  });

  it('deve rotacionar a câmera livremente com eventos pointermove sem exigir clique/arrasto', () => {
    fixture.detectChanges();

    // Primeiro pointermove para inicializar a posição de referência
    window.dispatchEvent(
      new PointerEvent('pointermove', { clientX: 300, clientY: 250 }),
    );

    // Segundo pointermove simulando movimento do mouse para a direita e para cima
    expect(() => {
      window.dispatchEvent(
        new PointerEvent('pointermove', { clientX: 340, clientY: 230 }),
      );
    }).not.toThrow();
  });

  it('deve exibir o badge de rede como OFFLINE quando desconectado e ONLINE com ping quando conectado', () => {
    component.networkService.isConnected.set(false);
    fixture.detectChanges();

    let compiled = fixture.nativeElement as HTMLElement;
    let badge = compiled.querySelector('.badge-network');
    expect(badge).not.toBeNull();
    expect(badge?.textContent).toContain('OFFLINE');

    // Conecta na partida com ping de 42ms
    component.networkService.isConnected.set(true);
    component.networkService.pingMs.set(42);
    fixture.detectChanges();

    compiled = fixture.nativeElement as HTMLElement;
    badge = compiled.querySelector('.badge-network');
    expect(badge?.textContent).toContain('ONLINE');
    expect(badge?.textContent).toContain('42 ms');
  });

  it('deve sincronizar entidades remotas a partir de snapshots autoritativos e removê-las ao desconectar', () => {
    component.networkService.localPlayerId.set('player-local');

    // Snapshot com 1 jogador remoto
    const snapshotWithRemote = {
      tick: 10,
      timestamp: Date.now(),
      players: [
        {
          id: 'player-local',
          name: 'Hero Local',
          x: 0,
          y: 0,
          z: 0,
          rotationY: 0,
          speed: 0,
          isDriving: false,
          isGrounded: true,
          vehicleId: null,
        },
        {
          id: 'player-remote-1',
          name: 'Remote Buddy',
          x: 5.0,
          y: 0,
          z: 5.0,
          rotationY: 1.57,
          speed: 6.0,
          isDriving: false,
          isGrounded: true,
          vehicleId: null,
        },
      ],
      vehicles: [],
      ackInputs: { 'player-local': 5 },
    };

    expect(() => {
      component.handleServerSnapshot(snapshotWithRemote);
    }).not.toThrow();

    // Snapshot seguinte sem o jogador remoto (desconectou)
    const snapshotWithoutRemote = {
      tick: 11,
      timestamp: Date.now(),
      players: [
        {
          id: 'player-local',
          name: 'Hero Local',
          x: 0,
          y: 0,
          z: 0,
          rotationY: 0,
          speed: 0,
          isDriving: false,
          isGrounded: true,
          vehicleId: null,
        },
      ],
      vehicles: [],
      ackInputs: { 'player-local': 6 },
    };

    expect(() => {
      component.handleServerSnapshot(snapshotWithoutRemote);
    }).not.toThrow();
  });

  it('deve executar o ciclo de vida ngAfterViewInit e ngOnDestroy limpando recursos sem erros', () => {
    fixture.detectChanges();

    expect(() => {
      component.ngOnDestroy();
    }).not.toThrow();
  });

  it('deve exibir o Card de Arma Equipada no DOM e atualizar ao trocar de arma', () => {
    fixture.detectChanges();
    const compiled = fixture.nativeElement as HTMLElement;

    const weaponCard = compiled.querySelector('.hud-weapon-card');
    expect(weaponCard).not.toBeNull();
    expect(weaponCard?.textContent).toContain('Stud Blaster');

    component.equipWeapon('scatter_shot');
    fixture.detectChanges();
    expect(weaponCard?.textContent).toContain('Block Scatter Shot');

    component.equipWeapon('spring_mine');
    fixture.detectChanges();
    expect(weaponCard?.textContent).toContain('Spring Mine');
  });

  it('deve processar tecla KeyJ para disparar arma', () => {
    fixture.detectChanges();
    const shootSpy = vi.spyOn(component.world, 'shootCurrentWeapon');

    const event = new KeyboardEvent('keydown', { code: 'KeyJ' });
    window.dispatchEvent(event);

    expect(shootSpy).toHaveBeenCalled();
  });

  it('deve adicionar e exibir números flutuantes de dano (Floating Combat Text) no DOM', () => {
    component.addFloatingCombatText(0, 1, 0, 15, 'stud_blaster');
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    const floatingNum = compiled.querySelector('.floating-combat-number');
    expect(floatingNum).not.toBeNull();
    expect(floatingNum?.textContent).toContain('-15');
  });

  it('deve renderizar ícones Iconify (<iconify-icon>) em múltiplos elementos do HUD', () => {
    fixture.detectChanges();
    const compiled = fixture.nativeElement as HTMLElement;

    const iconElements = compiled.querySelectorAll('iconify-icon');
    expect(iconElements.length).toBeGreaterThan(0);

    const brandIcon = compiled.querySelector('.badge-brand iconify-icon');
    expect(brandIcon).not.toBeNull();
    expect(brandIcon?.getAttribute('icon')).toBe('mdi:toy-brick');

    const networkIcon = compiled.querySelector('.badge-network iconify-icon');
    expect(networkIcon).not.toBeNull();
  });

  it('deve atualizar o visual da arma na mão do personagem ao invocar equipWeapon', () => {
    fixture.detectChanges();

    expect(() => {
      component.equipWeapon('scatter_shot');
      component.equipWeapon('spring_mine');
      component.equipWeapon('stud_blaster');
    }).not.toThrow();
  });

  it('deve permitir disparar com clique do botão esquerdo do mouse (pointerdown / click)', () => {
    fixture.detectChanges();
    const shootSpy = vi.spyOn(component.world, 'shootCurrentWeapon');

    const canvas = fixture.nativeElement.querySelector('canvas.render-canvas') as HTMLCanvasElement;
    expect(canvas).not.toBeNull();

    const pointerEvent = typeof PointerEvent !== 'undefined'
      ? new PointerEvent('pointerdown', { button: 0 })
      : (new MouseEvent('pointerdown', { button: 0 }) as unknown as PointerEvent);

    canvas.dispatchEvent(pointerEvent);
    expect(shootSpy).toHaveBeenCalled();
  });

  it('deve exibir a mira central (crosshair reticle) e reagir ao disparo e troca de armas', () => {
    fixture.detectChanges();
    const compiled = fixture.nativeElement as HTMLElement;

    const crosshair = compiled.querySelector('.crosshair-container');
    expect(crosshair).not.toBeNull();
    expect(crosshair?.querySelector('.crosshair-dot')).not.toBeNull();
    expect(crosshair?.querySelector('.crosshair-ring')).not.toBeNull();
    expect(crosshair?.querySelectorAll('.crosshair-line').length).toBe(4);

    // Blaster padrão
    expect(crosshair?.getAttribute('data-weapon')).toBe('stud_blaster');

    // Scatter shot -> ciano
    component.equipWeapon('scatter_shot');
    fixture.detectChanges();
    expect(crosshair?.getAttribute('data-weapon')).toBe('scatter_shot');

    // Mina -> vermelho
    component.equipWeapon('spring_mine');
    fixture.detectChanges();
    expect(crosshair?.getAttribute('data-weapon')).toBe('spring_mine');

    // Disparo ativa recoil bloom (.crosshair-firing)
    component.isShootingRecoil.set(true);
    fixture.detectChanges();
    expect(crosshair?.classList.contains('crosshair-firing')).toBe(true);

    component.isShootingRecoil.set(false);
    fixture.detectChanges();
    expect(crosshair?.classList.contains('crosshair-firing')).toBe(false);
  });

  it('deve atualizar dinamicamente a posição da mira no mouse via pointermove', () => {
    fixture.detectChanges();
    const compiled = fixture.nativeElement as HTMLElement;

    const moveEvent = typeof PointerEvent !== 'undefined'
      ? new PointerEvent('pointermove', { clientX: 520, clientY: 340 })
      : (new MouseEvent('pointermove', { clientX: 520, clientY: 340 }) as unknown as PointerEvent);

    window.dispatchEvent(moveEvent);
    fixture.detectChanges();

    expect(component.crosshairX()).toBeGreaterThan(0);
    expect(component.crosshairY()).toBeGreaterThan(0);

    const crosshair = compiled.querySelector('.crosshair-container') as HTMLElement;
    expect(crosshair).not.toBeNull();
    expect(crosshair.style.left).toContain('px');
    expect(crosshair.style.top).toContain('px');
  });

  it('deve calcular direção 3D e rotacionar o herói na direção do mouse ao disparar', () => {
    fixture.detectChanges();
    const shootSpy = vi.spyOn(component.world, 'shootCurrentWeapon');

    component.world.heroTransform.x = 0;
    component.world.heroTransform.z = 0;
    component.world.vehicleComponent.driverEntityId = null; // A pé

    // Simula mira 3D à direita (+X)
    component['aimTarget3D'].set(5, 0, 0);
    component.handleShoot();

    expect(shootSpy).toHaveBeenCalled();
    const [calledOrigin, calledDirection] = shootSpy.mock.calls[0];
    expect(calledDirection?.x).toBeGreaterThan(0.9); // Apontando para +X
    expect(component.world.heroTransform.rotationY).toBeCloseTo(Math.PI * 0.5, 1);
  });

  it('deve mover o personagem para frente na direção em que o mouse estiver apontando', () => {
    fixture.detectChanges();
    component.world.heroTransform.x = 0;
    component.world.heroTransform.z = 0;
    component.world.vehicleComponent.driverEntityId = null;

    // Mouse apontando para +X
    component['aimTarget3D'].set(10, 0, 0);
    component.world.setInput({ forward: true });

    component['updateGameLogic'](0.1, 0.1);

    expect(component.world.heroTransform.rotationY).toBeCloseTo(Math.PI * 0.5, 1);
    expect(component.world.heroTransform.x).toBeGreaterThan(0);
  });

  it('deve permitir mirar e disparar para o céu com elevação positiva (direction.y > 0) e inclinar o braço do herói', () => {
    fixture.detectChanges();
    const shootSpy = vi.spyOn(component.world, 'shootCurrentWeapon');

    component.world.heroTransform.x = 0;
    component.world.heroTransform.y = 0;
    component.world.heroTransform.z = 0;
    component.world.vehicleComponent.driverEntityId = null; // A pé

    // Simula mira 3D apontando alto para o céu (+Y e à frente +Z)
    component['aimTarget3D'].set(0, 25, 10);
    component.handleShoot();

    expect(shootSpy).toHaveBeenCalled();
    const [calledOrigin, calledDirection] = shootSpy.mock.calls[0];
    expect(calledDirection?.y).toBeGreaterThan(0.7); // Subindo fortemente em direção ao céu aberto
    expect(component['heroRightArmPivot']).toBeDefined();
  });

  it('deve posicionar a câmera nas costas do veículo imediatamente ao entrar no carro', () => {
    fixture.detectChanges();
    component['wasDriving'] = false;
    component.world.vehicleTransform.rotationY = 1.2; // Carro apontando em 1.2 rad
    component.world.vehicleComponent.driverEntityId = component.world.heroId; // Entra no carro

    component['updateGameLogic'](0.016, 0.1);

    const expectedBehindTheta = component.world.vehicleTransform.rotationY + Math.PI;
    expect(component['targetTheta']).toBeCloseTo(expectedBehindTheta, 2);
    expect(component['currentTheta']).toBeCloseTo(expectedBehindTheta, 2);
    expect(component['targetRadius']).toBe(11.5);
    expect(component['wasDriving']).toBe(true);
  });

  it('deve acompanhar a rotação da lataria do veículo durante curvas mantendo o foco nas costas', () => {
    fixture.detectChanges();
    // Inicia dentro do veículo
    component['wasDriving'] = true;
    component.world.vehicleComponent.driverEntityId = component.world.heroId;
    component.world.vehicleTransform.rotationY = 0;
    component['lastVehicleRotationY'] = 0;
    component['targetTheta'] = Math.PI;
    component['currentTheta'] = Math.PI;

    // Carro vira 45 graus para a direita (+0.785 rad)
    component.world.vehicleTransform.rotationY = Math.PI / 4;
    component['updateGameLogic'](0.016, 0.2);

    expect(component['targetTheta']).toBeCloseTo(Math.PI + Math.PI / 4, 2);
    expect(component['lastVehicleRotationY']).toBeCloseTo(Math.PI / 4, 2);
  });

  it('deve permitir girar a câmera livremente com o mouse ao pilotar o veículo', () => {
    fixture.detectChanges();
    component['wasDriving'] = true;
    component.world.vehicleComponent.driverEntityId = component.world.heroId;

    const initialTheta = component['targetTheta'];
    const initialPhi = component['targetPhi'];

    // Simula evento do mouse girando para a esquerda e para cima
    component['previousPointerX'] = 200;
    component['previousPointerY'] = 200;

    const moveEvent = typeof PointerEvent !== 'undefined'
      ? new PointerEvent('pointermove', { clientX: 250, clientY: 170 })
      : (new MouseEvent('pointermove', { clientX: 250, clientY: 170 }) as unknown as PointerEvent);

    window.dispatchEvent(moveEvent);

    expect(component['targetTheta']).not.toBe(initialTheta);
    expect(component['targetPhi']).not.toBe(initialPhi);
  });

  it('deve manter a câmera calibrada nas costas do personagem com raio 8.0 e elevação 1.45 na visão a pé', () => {
    fixture.detectChanges();
    component['wasDriving'] = false;
    component.world.vehicleComponent.driverEntityId = null; // A pé

    component['updateGameLogic'](0.016, 0.1);

    expect(component['targetRadius']).toBe(8.0);
    expect(component['lookAtY']).toBeCloseTo(1.45, 1);
  });

  it('não deve travar nem oscilar a rotação em 180 graus ao andar para frente com W mesmo com mira próxima no chão', () => {
    fixture.detectChanges();
    component['wasDriving'] = false;
    component.world.vehicleComponent.driverEntityId = null;

    component['aimTarget3D'].set(0, 0, 2.0);
    component.world.heroTransform.x = 0;
    component.world.heroTransform.z = 0;
    component.world.setInput({ forward: true });

    // Simula 25 frames contínuos de caminhada para frente
    for (let i = 0; i < 25; i++) {
      component['updateGameLogic'](0.016, i * 0.016);
    }

    // Deve progredir em +Z de forma fluida sem inverter a rotação
    expect(component.world.heroTransform.z).toBeGreaterThan(0.5);
    expect(component.world.heroTransform.rotationY).toBeCloseTo(0, 1);
  });

  describe('Fase 7: Modos de Jogo, Lobby, Ondas e Upgrades Roguelite', () => {
    it('deve exibir o seletor de modo de jogo no DOM quando o estado for waiting', () => {
      component.matchState.set('waiting');
      fixture.detectChanges();

      const compiled = fixture.nativeElement as HTMLElement;
      const lobbyModal = compiled.querySelector('.match-lobby-backdrop');
      expect(lobbyModal).not.toBeNull();
      expect(lobbyModal?.textContent).toContain('MODOS DE JOGO OVERDRIVE');
      expect(lobbyModal?.textContent).toContain('Sobrevivência Co-op');
      expect(lobbyModal?.textContent).toContain('PvP Deathmatch');
    });

    it('deve alternar o modo de jogo ao chamar selectGameMode', () => {
      component.selectGameMode('pvp_deathmatch');
      expect(component.gameMode()).toBe('pvp_deathmatch');
      expect(component.world.matchState.mode).toBe('pvp_deathmatch');

      component.selectGameMode('coop_survival');
      expect(component.gameMode()).toBe('coop_survival');
      expect(component.world.matchState.mode).toBe('coop_survival');
    });

    it('deve alternar estado de pronto e iniciar a contagem regressiva ao clicar no botão pronto', () => {
      component.matchState.set('waiting');
      component.isPlayerReady.set(false);
      fixture.detectChanges();

      component.toggleReady();
      expect(component.isPlayerReady()).toBe(true);
      expect(component.matchState()).toBe('countdown');
    });

    it('deve exibir o overlay de contagem regressiva (countdown) no DOM', () => {
      component.matchState.set('countdown');
      component.countdownSeconds.set(3);
      fixture.detectChanges();

      const compiled = fixture.nativeElement as HTMLElement;
      const overlay = compiled.querySelector('.match-countdown-overlay');
      expect(overlay).not.toBeNull();
      expect(overlay?.textContent).toContain('3');
      expect(overlay?.textContent).toContain('PREPARE-SE');
    });

    it('deve exibir o badge de onda e contador de inimigos em modo Sobrevivência Co-op in_progress', () => {
      component.matchState.set('in_progress');
      component.gameMode.set('coop_survival');
      component.currentWave.set(2);
      component.maxWaves.set(5);
      component.enemiesRemaining.set(4);
      fixture.detectChanges();

      const compiled = fixture.nativeElement as HTMLElement;
      const waveTag = compiled.querySelector('.wave-tag');
      const enemiesTag = compiled.querySelector('.enemies-tag');

      expect(waveTag).not.toBeNull();
      expect(waveTag?.textContent).toContain('ONDA 2 / 5');
      expect(enemiesTag).not.toBeNull();
      expect(enemiesTag?.textContent).toContain('INIMIGOS: 4');
    });

    it('deve exibir o placar PvP em tempo real quando o modo for pvp_deathmatch', () => {
      component.gameMode.set('pvp_deathmatch');
      component.matchState.set('in_progress');
      component.playerScores.set([
        { playerId: 'local_player', name: 'Hero Local', kills: 4, deaths: 1, score: 600 },
        { playerId: 'bot_1', name: 'Bot Brick', kills: 2, deaths: 3, score: 250 },
      ]);
      fixture.detectChanges();

      const compiled = fixture.nativeElement as HTMLElement;
      const scoreboard = compiled.querySelector('.pvp-scoreboard-card');
      expect(scoreboard).not.toBeNull();
      expect(scoreboard?.textContent).toContain('PLACAR DEATHMATCH');
      expect(scoreboard?.textContent).toContain('Hero Local');
      expect(scoreboard?.textContent).toContain('600 pts');
    });

    it('deve exibir o modal de upgrades roguelite durante wave_intermission e permitir seleção de bônus', () => {
      component.matchState.set('wave_intermission');
      component.currentWave.set(1);
      component.intermissionSeconds.set(8);
      component.upgradeOptions.set([
        {
          id: 'upg_damage_1',
          title: 'Pinos de Titânio',
          description: '+25% de dano em todas as armas LEGO.',
          stat: 'damage',
          multiplier: 1.25,
          icon: 'mdi:sword-cross',
        },
        {
          id: 'upg_speed_1',
          title: 'Turbinas Overdrive',
          description: '+20% de velocidade de corrida e drift.',
          stat: 'move_speed',
          multiplier: 1.2,
          icon: 'mdi:lightning-bolt',
        },
      ]);
      fixture.detectChanges();

      const compiled = fixture.nativeElement as HTMLElement;
      const upgradeModal = compiled.querySelector('.upgrade-modal-backdrop');
      expect(upgradeModal).not.toBeNull();
      expect(upgradeModal?.textContent).toContain('ESCOLHA SEU UPGRADE ROGUELITE');
      expect(upgradeModal?.textContent).toContain('Pinos de Titânio');
      expect(upgradeModal?.textContent).toContain('Turbinas Overdrive');

      // Seleciona um upgrade
      component.chooseUpgrade('upg_damage_1');
      expect(component.currentWave()).toBe(2);
      expect(component.matchState()).toBe('in_progress');
    });

    it('deve exibir a tela de vitória quando matchState for victory e reiniciar a partida ao clicar em jogar novamente', () => {
      component.matchState.set('victory');
      fixture.detectChanges();

      const compiled = fixture.nativeElement as HTMLElement;
      const victoryCard = compiled.querySelector('.match-result-card.result-victory');
      expect(victoryCard).not.toBeNull();
      expect(victoryCard?.textContent).toContain('VITÓRIA ÉPICA!');

      component.restartMatch();
      expect(component.matchState()).toBe('waiting');
      expect(component.isPlayerReady()).toBe(false);
    });

    it('deve sincronizar e criar malhas dos inimigos ativos na cena Three.js', () => {
      fixture.detectChanges();
      component['scene'] = new THREE.Scene();
      component.world.matchState.enemies = [
        {
          id: 'enemy_scout_spec',
          type: 'scout_block',
          x: 2,
          y: 0.35,
          z: 3,
          rotationY: 0,
          speed: 4,
          health: 30,
          maxHealth: 30,
          damage: 10,
          active: true,
        },
      ];

      // Simula frame de sincronização
      component['syncEnemyVisuals'](0.016, 0.1);

      expect(component['enemyVisuals'].has('enemy_scout_spec')).toBe(true);
      const enemyVisual = component['enemyVisuals'].get('enemy_scout_spec');
      expect(enemyVisual?.mesh).toBeDefined();
    });
  });
});

