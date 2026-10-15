import { GameWorld } from './game-world';

describe('GameWorld (ECS Coordinator)', () => {
  let world: GameWorld;

  beforeEach(() => {
    world = new GameWorld();
  });

  it('deve inicializar com herói e veículo em posições distintas e sem motorista', () => {
    expect(world.isDriving()).toBe(false);
    expect(world.heroTransform.x).toBe(0);
    expect(world.vehicleTransform.x).toBe(3.5);
    expect(world.getSpeedKmh()).toBe(0);
  });

  it('deve mover o pedestre quando receber input e atualizar velocidade', () => {
    world.setInput({ forward: true });
    world.fixedUpdate(0.1);

    expect(world.heroController.isMoving).toBe(true);
    expect(world.getSpeedKmh()).toBeGreaterThan(0);
  });

  it('deve permitir embarque quando próximo ao veículo e alternar para modo de condução', () => {
    // Aproxima o herói do veículo
    world.heroTransform.x = 3.5;
    world.heroTransform.z = -2.5;

    expect(world.canInteract()).toBe(true);

    world.triggerInteract();
    world.fixedUpdate(0.016);

    expect(world.isDriving()).toBe(true);
    expect(world.heroTransform.x).toBe(world.vehicleTransform.x);
  });

  it('deve permitir acelerar e drift com o veículo quando pilotado', () => {
    // Embarca
    world.heroTransform.x = 3.5;
    world.heroTransform.z = -2.5;
    world.triggerInteract();
    world.fixedUpdate(0.016);

    // Acelera com o veículo
    world.setInput({ forward: true, handbrake: true, left: true });
    world.vehicleComponent.currentSpeed = 10.0;
    world.fixedUpdate(0.05);

    expect(world.isDriving()).toBe(true);
    expect(world.isDrifting()).toBe(true);
    expect(world.getSpeedKmh()).toBeGreaterThan(0);
  });

  it('deve avançar simulação determinística através do método step()', () => {
    world.setInput({ forward: true });
    world.step(0.05);

    expect(world.heroTransform.z).not.toBe(0);
  });

  it('deve inicializar com lataria modular em 100% e permitir desprendimento forçado', () => {
    expect(world.getDurabilityPercentage()).toBe(100);
    expect(world.modularVehicle.blocks.length).toBeGreaterThan(4);
    expect(world.activeDebris.length).toBe(0);

    // Força o desprendimento de um bloco
    const detached = world.forceDetachNextBlock();
    expect(detached).toBe(true);
    expect(world.getDurabilityPercentage()).toBeLessThan(100);
    expect(world.activeDebris.length).toBe(1);

    // O detrito ejetado tem velocidade física ativa
    const debris = world.activeDebris[0];
    expect(debris.active).toBe(true);
    expect(debris.vy).toBeGreaterThan(0);
  });

  it('deve processar colisão com muretas da arena e ejetar detritos em impacto de alta velocidade', () => {
    world.vehicleTransform.x = world.bounds.maxX;
    world.vehicleComponent.currentSpeed = 12.0;

    world.fixedUpdate(0.016);

    expect(world.getDurabilityPercentage()).toBeLessThan(100);
    expect(world.activeDebris.length).toBeGreaterThan(0);
  });

  it('não deve permitir forceDetachNextBlock enquanto o jogador estiver pilotando o veículo', () => {
    world.vehicleComponent.driverEntityId = world.heroId;
    expect(world.isDriving()).toBe(true);

    const detached = world.forceDetachNextBlock();
    expect(detached).toBe(false);
    expect(world.getDurabilityPercentage()).toBe(100);
    expect(world.activeDebris.length).toBe(0);
  });

  it('deve desativar veículo e ejetar o condutor quando a durabilidade zerar (destruição total estilo LEGO)', () => {
    // Embarca
    world.heroTransform.x = 3.5;
    world.heroTransform.z = -2.5;
    world.triggerInteract();
    world.fixedUpdate(0.016);
    expect(world.isDriving()).toBe(true);

    // Zera os blocos da lataria
    world.modularVehicle.durabilityPercentage = 0;
    for (const b of world.modularVehicle.blocks) {
      b.currentHealth = 0;
    }

    world.checkVehicleDestruction();

    expect(world.vehicleComponent.isDestroyed).toBe(true);
    expect(world.vehicleComponent.currentSpeed).toBe(0);
    expect(world.isDriving()).toBe(false); // Ejetado com segurança
    expect(world.heroTransform.x).not.toBe(world.vehicleTransform.x);
  });

  it('não deve permitir interação ou reembarque se o veículo estiver destruído', () => {
    // Aproxima o herói do veículo
    world.heroTransform.x = 3.5;
    world.heroTransform.z = -2.5;

    expect(world.canInteract()).toBe(true);

    // Destrói o veículo
    world.vehicleComponent.isDestroyed = true;

    expect(world.isVehicleDestroyed()).toBe(true);
    expect(world.canInteract()).toBe(false);

    world.triggerInteract();
    world.fixedUpdate(0.016);

    expect(world.isDriving()).toBe(false);
  });

  it('deve enfileirar inputs no buffer de predição e gerenciar seu tamanho', () => {
    expect(world.getPendingInputsCount()).toBe(0);

    world.enqueuePendingInput(1, world.inputState, 0.016);
    world.enqueuePendingInput(2, world.inputState, 0.016);

    expect(world.getPendingInputsCount()).toBe(2);
    expect(world.pendingInputs[0].seq).toBe(1);
    expect(world.pendingInputs[1].seq).toBe(2);

    world.clearPendingInputs();
    expect(world.getPendingInputsCount()).toBe(0);
  });

  it('deve reconciliar e corrigir a posição com replay dos inputs pendentes quando houver divergência relevante', () => {
    // Simula 3 inputs locais enfileirados
    world.heroTransform.x = 0;
    world.heroTransform.z = 0;

    world.enqueuePendingInput(1, { ...world.inputState, forward: true }, 0.016);
    world.enqueuePendingInput(2, { ...world.inputState, forward: true }, 0.016);
    world.enqueuePendingInput(3, { ...world.inputState, forward: true }, 0.016);

    // Servidor confirma até o input 1, mas com posição diferente da local (ex: x=4.0, divergência > 0.25)
    const snapshot = {
      tick: 20,
      timestamp: Date.now(),
      players: [
        {
          id: 'player-local',
          name: 'Hero',
          x: 4.0,
          y: 0,
          z: 0,
          rotationY: 0,
          speed: 8.0,
          isDriving: false,
          isGrounded: true,
          vehicleId: null,
        },
      ],
      vehicles: [],
      ackInputs: { 'player-local': 1 },
    };

    const result = world.reconcileServerSnapshot(snapshot, 'player-local', 0.25);

    expect(result.reconciled).toBe(true);
    expect(result.divergence).toBeGreaterThan(0.25);
    // Input 1 descartado, restam 2 e 3
    expect(world.getPendingInputsCount()).toBe(2);
    expect(world.pendingInputs[0].seq).toBe(2);
    // Posição local corrigida e avançada a partir do estado autoritativo
    expect(world.heroTransform.x).toBeGreaterThanOrEqual(4.0);
  });

  it('não deve reconciliar se a divergência for mínima, mas deve descartar inputs confirmados', () => {
    world.heroTransform.x = 2.0;
    world.heroTransform.z = 1.0;

    world.enqueuePendingInput(1, world.inputState, 0.016);
    world.enqueuePendingInput(2, world.inputState, 0.016);

    // Servidor confirma o input 1 com posição muito próxima (divergência < 0.25)
    const snapshot = {
      tick: 25,
      timestamp: Date.now(),
      players: [
        {
          id: 'player-local',
          name: 'Hero',
          x: 2.05,
          y: 0,
          z: 1.02,
          rotationY: 0,
          speed: 0,
          isDriving: false,
          isGrounded: true,
          vehicleId: null,
        },
      ],
      vehicles: [],
      ackInputs: { 'player-local': 1 },
    };

    const result = world.reconcileServerSnapshot(snapshot, 'player-local', 0.25);

    expect(result.reconciled).toBe(false);
    expect(result.divergence).toBeLessThan(0.25);
    // Input 1 descartado do buffer mesmo sem reconciliação bruta
    expect(world.getPendingInputsCount()).toBe(1);
    expect(world.pendingInputs[0].seq).toBe(2);
  });

  it('deve equipar diferentes armas do arsenal LEGO', () => {
    expect(world.getEquippedWeapon()).toBe('stud_blaster');

    expect(world.setEquippedWeapon('scatter_shot')).toBe(true);
    expect(world.getEquippedWeapon()).toBe('scatter_shot');

    expect(world.setEquippedWeapon('spring_mine')).toBe(true);
    expect(world.getEquippedWeapon()).toBe('spring_mine');

    expect(world.setEquippedWeapon('invalid_gun' as any)).toBe(false);
  });

  it('deve disparar arma atual, aplicar cooldown e adicionar projéteis ativos', () => {
    world.setEquippedWeapon('stud_blaster');
    expect(world.canShootCurrentWeapon()).toBe(true);

    const result = world.shootCurrentWeapon();
    expect(result.success).toBe(true);
    expect(result.projectilesSpawned).toBe(1);
    expect(world.activeProjectiles.length).toBe(1);
    expect(world.canShootCurrentWeapon()).toBe(false);

    // Segundo disparo imediato deve ser bloqueado por cooldown
    const secondShot = world.shootCurrentWeapon();
    expect(secondShot.success).toBe(false);

    // Avança tempo para zerar cooldown
    world.fixedUpdate(0.2);
    expect(world.canShootCurrentWeapon()).toBe(true);
  });
});
