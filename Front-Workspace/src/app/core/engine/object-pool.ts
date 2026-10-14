/**
 * Implementação genérica de Object Pool para alta performance e zero alocação contínua de memória (GC-friendly).
 * Segue as diretrizes de game-architecture ECS para partículas e detritos físicos.
 */
export class ObjectPool<T> {
  private readonly pool: T[] = [];
  private totalCreated = 0;

  constructor(
    private readonly factory: () => T,
    private readonly resetFn?: (item: T) => void,
    initialSize: number = 24,
    private readonly maxSize: number = 256,
  ) {
    this.preallocate(initialSize);
  }

  /**
   * Pré-aloca instâncias no pool.
   */
  public preallocate(count: number): void {
    const toCreate = Math.min(count, this.maxSize - this.pool.length);
    for (let i = 0; i < toCreate; i++) {
      this.pool.push(this.factory());
      this.totalCreated++;
    }
  }

  /**
   * Obtém um objeto reutilizável do pool ou instancia um novo se necessário.
   */
  public acquire(): T {
    let item = this.pool.pop();

    if (!item) {
      item = this.factory();
      this.totalCreated++;
    }

    if (this.resetFn) {
      this.resetFn(item);
    }

    return item;
  }

  /**
   * Devolve um objeto para o pool para reciclagem futura.
   */
  public release(item: T): void {
    if (this.pool.length < this.maxSize) {
      if (this.resetFn) {
        this.resetFn(item);
      }
      this.pool.push(item);
    }
  }

  /**
   * Esvazia o pool e reinicia contadores.
   */
  public clear(): void {
    this.pool.length = 0;
    this.totalCreated = 0;
  }

  public get availableCount(): number {
    return this.pool.length;
  }

  public get totalAllocated(): number {
    return this.totalCreated;
  }
}
