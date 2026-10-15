import { FIXED_TIMESTEP, MAX_FRAME_TIME } from './types';
import { GameLoop } from './game-loop';

describe('GameLoop (Deterministic Fixed Timestep)', () => {
  it('deve inicializar parado e com acumulador zerado', () => {
    const onFixedUpdate = vi.fn();
    const loop = new GameLoop(onFixedUpdate);

    expect(loop.isRunning()).toBe(false);
    expect(loop.getAccumulator()).toBe(0);
    expect(loop.getAlpha()).toBe(0);
  });

  it('deve alternar estado de execução com start e stop', () => {
    const loop = new GameLoop(vi.fn());
    loop.start(100);
    expect(loop.isRunning()).toBe(true);

    loop.stop();
    expect(loop.isRunning()).toBe(false);
  });

  it('deve executar o número exato de ticks fixos baseado no acumulador', () => {
    const fixedUpdates: number[] = [];
    const renderUpdates: number[] = [];

    const loop = new GameLoop(
      (dt) => fixedUpdates.push(dt),
      (alpha) => renderUpdates.push(alpha),
    );

    loop.start(0);

    // Avança exatamente 2 passos de 1/60s + sobra de 0.005s
    const stepDuration = FIXED_TIMESTEP * 2 + 0.005;
    loop.step(stepDuration);

    expect(fixedUpdates.length).toBe(2);
    expect(fixedUpdates[0]).toBeCloseTo(FIXED_TIMESTEP, 5);
    expect(fixedUpdates[1]).toBeCloseTo(FIXED_TIMESTEP, 5);

    expect(loop.getAccumulator()).toBeCloseTo(0.005, 5);
    expect(loop.getAlpha()).toBeCloseTo(0.005 / FIXED_TIMESTEP, 4);
    expect(renderUpdates.length).toBe(1);
  });

  it('deve proteger contra espiral da morte limitando frameTime ao maxFrameTime', () => {
    const fixedUpdates: number[] = [];
    const loop = new GameLoop((dt) => fixedUpdates.push(dt));

    // Passo simulando atraso severo de 2.0 segundos
    loop.step(2.0);

    // O tempo deve ser limitado a MAX_FRAME_TIME (0.25s), resultando em no máximo 15 passos
    const expectedMaxTicks = Math.floor(MAX_FRAME_TIME / FIXED_TIMESTEP);
    expect(fixedUpdates.length).toBe(expectedMaxTicks);
  });

  it('deve calcular o delta time corretamente usando tick com timestamps absolutos', () => {
    const fixedUpdates: number[] = [];
    const loop = new GameLoop((dt) => fixedUpdates.push(dt));

    loop.start(0);
    loop.tick(1.0); // Primeiro tick define previousTime
    expect(fixedUpdates.length).toBe(0);

    loop.tick(1.0 + FIXED_TIMESTEP * 3); // Avança 3 passos de tempo
    expect(fixedUpdates.length).toBe(3);
  });
});
