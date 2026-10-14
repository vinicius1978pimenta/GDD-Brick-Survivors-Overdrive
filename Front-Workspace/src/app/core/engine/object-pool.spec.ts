import { ObjectPool } from './object-pool';

describe('ObjectPool (High Performance Memory Recycling)', () => {
  interface TestItem {
    id: number;
    active: boolean;
  }

  let idCounter = 1;
  const factory = (): TestItem => ({ id: idCounter++, active: true });
  const resetFn = (item: TestItem): void => {
    item.active = false;
  };

  beforeEach(() => {
    idCounter = 1;
  });

  it('deve pré-alocar instâncias de acordo com o tamanho inicial configurado', () => {
    const pool = new ObjectPool<TestItem>(factory, resetFn, 10, 50);
    expect(pool.availableCount).toBe(10);
    expect(pool.totalAllocated).toBe(10);
  });

  it('deve adquirir um item do pool e aplicar a função de reset', () => {
    const pool = new ObjectPool<TestItem>(factory, resetFn, 5, 20);
    const item = pool.acquire();

    expect(item).toBeDefined();
    expect(item.active).toBe(false); // resetFn executou
    expect(pool.availableCount).toBe(4);
  });

  it('deve instanciar novos itens sob demanda se o pool estiver vazio', () => {
    const pool = new ObjectPool<TestItem>(factory, resetFn, 0, 10);
    expect(pool.availableCount).toBe(0);

    const item = pool.acquire();
    expect(item.id).toBe(1);
    expect(pool.totalAllocated).toBe(1);
    expect(pool.availableCount).toBe(0);
  });

  it('deve devolver itens ao pool via release e reutilizá-los em aquisições futuras', () => {
    const pool = new ObjectPool<TestItem>(factory, resetFn, 2, 10);
    const item1 = pool.acquire();
    const item2 = pool.acquire();
    expect(pool.availableCount).toBe(0);

    pool.release(item1);
    expect(pool.availableCount).toBe(1);

    const acquiredAgain = pool.acquire();
    expect(acquiredAgain).toBe(item1);
    expect(pool.availableCount).toBe(0);
  });

  it('deve respeitar o limite máximo (maxSize) sem acumular objetos excedentes', () => {
    const pool = new ObjectPool<TestItem>(factory, resetFn, 0, 2);
    const item1 = factory();
    const item2 = factory();
    const item3 = factory();

    pool.release(item1);
    pool.release(item2);
    pool.release(item3); // Ultrapassa o maxSize = 2

    expect(pool.availableCount).toBe(2);
  });

  it('deve esvaziar o pool ao chamar clear()', () => {
    const pool = new ObjectPool<TestItem>(factory, resetFn, 5, 10);
    expect(pool.availableCount).toBe(5);

    pool.clear();
    expect(pool.availableCount).toBe(0);
    expect(pool.totalAllocated).toBe(0);
  });
});
