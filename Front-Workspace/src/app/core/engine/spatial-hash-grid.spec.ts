import { describe, expect, it } from 'vitest';
import { SpatialHashGrid } from './spatial-hash-grid';

describe('SpatialHashGrid (Broad-Phase)', () => {
  it('deve instanciar com cellSize padrão de 8m e validar tamanho positivo', () => {
    const grid = new SpatialHashGrid(8.0);
    expect(grid.getCellSize()).toBe(8.0);
    expect(grid.getEntityCount()).toBe(0);
    expect(grid.getCellCount()).toBe(0);

    expect(() => new SpatialHashGrid(0)).toThrow();
    expect(() => new SpatialHashGrid(-5)).toThrow();
  });

  it('deve inserir entidades e registrar células correspondentes', () => {
    const grid = new SpatialHashGrid(10.0);
    grid.insert('player_1', { x: 5, y: 0, z: 5 }, 0.5);

    expect(grid.getEntityCount()).toBe(1);
    expect(grid.getCellCount()).toBeGreaterThan(0);
    expect(grid.getEntityBounds('player_1')).toEqual({
      position: { x: 5, y: 0, z: 5 },
      radius: 0.5,
    });
  });

  it('deve atualizar posição de entidade migrando entre células', () => {
    const grid = new SpatialHashGrid(10.0);
    grid.insert('vehicle_1', { x: 2, y: 0, z: 2 }, 1.5);
    expect(grid.queryNearby({ x: 2, y: 0, z: 2 }, 2.0)).toContain('vehicle_1');

    grid.update('vehicle_1', { x: 45, y: 0, z: 45 }, 1.5);
    expect(grid.queryNearby({ x: 2, y: 0, z: 2 }, 2.0)).not.toContain('vehicle_1');
    expect(grid.queryNearby({ x: 45, y: 0, z: 45 }, 2.0)).toContain('vehicle_1');
  });

  it('deve remover entidades e limpar células desocupadas', () => {
    const grid = new SpatialHashGrid(8.0);
    grid.insert('entity_a', { x: 0, y: 0, z: 0 }, 1.0);
    expect(grid.getEntityCount()).toBe(1);

    grid.remove('entity_a');
    expect(grid.getEntityCount()).toBe(0);
    expect(grid.getCellCount()).toBe(0);
    expect(grid.queryNearby({ x: 0, y: 0, z: 0 }, 5.0)).toEqual([]);
  });

  it('deve consultar entidades próximas dentro do raio e ignorar entidades distantes', () => {
    const grid = new SpatialHashGrid(8.0);
    grid.insert('target_close', { x: 2, y: 0, z: 2 }, 1.0);
    grid.insert('target_far', { x: 50, y: 0, z: 50 }, 1.0);

    const nearby = grid.queryNearby({ x: 0, y: 0, z: 0 }, 4.0);
    expect(nearby).toContain('target_close');
    expect(nearby).not.toContain('target_far');
  });

  it('deve limpar todo o grid com clear()', () => {
    const grid = new SpatialHashGrid(8.0);
    grid.insert('e1', { x: 1, y: 0, z: 1 }, 1.0);
    grid.insert('e2', { x: 10, y: 0, z: 10 }, 1.0);

    expect(grid.getEntityCount()).toBe(2);
    grid.clear();
    expect(grid.getEntityCount()).toBe(0);
    expect(grid.getCellCount()).toBe(0);
  });
});
