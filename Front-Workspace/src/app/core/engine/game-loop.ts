import { FIXED_TIMESTEP, MAX_FRAME_TIME } from './types';

/**
 * Game Loop determinístico com Fixed Timestep a 60Hz.
 * Utiliza acumulador de tempo, proteção contra espiral da morte e cálculo de alpha de interpolação.
 */
export class GameLoop {
  private accumulator = 0;
  private previousTime = 0;
  private running = false;
  private alpha = 0;

  constructor(
    private readonly onFixedUpdate: (dt: number) => void,
    private readonly onRenderUpdate?: (alpha: number) => void,
    private readonly fixedTimestep: number = FIXED_TIMESTEP,
    private readonly maxFrameTime: number = MAX_FRAME_TIME,
  ) {}

  /**
   * Inicia o loop de jogo.
   */
  public start(startTime: number = 0): void {
    this.running = true;
    this.previousTime = startTime;
    this.accumulator = 0;
    this.alpha = 0;
  }

  /**
   * Para o loop de jogo.
   */
  public stop(): void {
    this.running = false;
  }

  public isRunning(): boolean {
    return this.running;
  }

  public getAccumulator(): number {
    return this.accumulator;
  }

  public getAlpha(): number {
    return this.alpha;
  }

  /**
   * Avança um tick baseado no timestamp absoluto (em segundos).
   */
  public tick(currentTimeSeconds: number): void {
    if (!this.running) return;

    if (this.previousTime === 0) {
      this.previousTime = currentTimeSeconds;
      return;
    }

    const deltaTime = currentTimeSeconds - this.previousTime;
    this.previousTime = currentTimeSeconds;

    this.step(deltaTime);
  }

  /**
   * Avança a simulação por um deltaTime específico (em segundos).
   * Protegido contra espiral da morte (frameTime <= maxFrameTime).
   */
  public step(deltaTimeSeconds: number): void {
    // Limita o tempo do frame para evitar congelamentos e espiral da morte
    const frameTime = Math.max(0, Math.min(deltaTimeSeconds, this.maxFrameTime));
    this.accumulator += frameTime;

    while (this.accumulator >= this.fixedTimestep) {
      this.onFixedUpdate(this.fixedTimestep);
      this.accumulator -= this.fixedTimestep;
    }

    // Alpha de interpolação entre o estado anterior e o estado atual
    this.alpha = this.accumulator / this.fixedTimestep;

    if (this.onRenderUpdate) {
      this.onRenderUpdate(this.alpha);
    }
  }
}
