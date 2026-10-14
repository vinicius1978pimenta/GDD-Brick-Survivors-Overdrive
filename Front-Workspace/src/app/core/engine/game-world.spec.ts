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
});
