import { beforeEach, describe, expect, it } from 'vitest';
import { SpatialHashGrid } from './spatial-hash-grid.js';

describe('SpatialHashGrid', () => {
  let grid: SpatialHashGrid;

  beforeEach(() => {
    grid = new SpatialHashGrid(8.0);
  });

  describe('Initialization and Configuration', () => {
    it('should initialize with given cell size', () => {
      expect(grid.getCellSize()).toBe(8.0);
      expect(grid.getEntityCount()).toBe(0);
      expect(grid.getCellCount()).toBe(0);
    });

    it('should throw an error if cellSize is non-positive', () => {
      expect(() => new SpatialHashGrid(0)).toThrow('SpatialHashGrid cellSize must be greater than zero.');
      expect(() => new SpatialHashGrid(-5)).toThrow('SpatialHashGrid cellSize must be greater than zero.');
    });
  });

  describe('Insertion, Update, and Removal', () => {
    it('should insert an entity and track bounds', () => {
      grid.insert('player-1', { x: 2, y: 0, z: 2 }, 1.0);

      expect(grid.getEntityCount()).toBe(1);
      expect(grid.getCellCount()).toBeGreaterThan(0);

      const bounds = grid.getEntityBounds('player-1');
      expect(bounds).toBeDefined();
      expect(bounds?.position).toEqual({ x: 2, y: 0, z: 2 });
      expect(bounds?.radius).toBe(1.0);
    });

    it('should update entity location and clean up previous cells', () => {
      grid.insert('player-1', { x: 0, y: 0, z: 0 }, 0.5);
      expect(grid.queryNearby({ x: 0, y: 0, z: 0 }, 1.0)).toContain('player-1');

      grid.update('player-1', { x: 50, y: 0, z: 50 }, 0.5);
      expect(grid.queryNearby({ x: 0, y: 0, z: 0 }, 1.0)).not.toContain('player-1');
      expect(grid.queryNearby({ x: 50, y: 0, z: 50 }, 1.0)).toContain('player-1');
      expect(grid.getEntityCount()).toBe(1);
    });

    it('should remove entity and prune empty cells', () => {
      grid.insert('ent-1', { x: 0, y: 0, z: 0 }, 0.5);
      expect(grid.getEntityCount()).toBe(1);
      expect(grid.getCellCount()).toBeGreaterThan(0);

      grid.remove('ent-1');
      expect(grid.getEntityCount()).toBe(0);
      expect(grid.getCellCount()).toBe(0);
      expect(grid.queryNearby({ x: 0, y: 0, z: 0 }, 5.0)).toEqual([]);
    });

    it('should ignore removing non-existent entities gracefully', () => {
      expect(() => grid.remove('ghost')).not.toThrow();
    });

    it('should clear all entities and cells', () => {
      grid.insert('a', { x: 0, y: 0, z: 0 }, 0.5);
      grid.insert('b', { x: 20, y: 0, z: 20 }, 0.5);
      expect(grid.getEntityCount()).toBe(2);

      grid.clear();
      expect(grid.getEntityCount()).toBe(0);
      expect(grid.getCellCount()).toBe(0);
    });
  });

  describe('Broad-Phase Proximity Queries', () => {
    it('should return nearby entities without duplicates', () => {
      // Entity with large radius spanning across cell boundaries
      grid.insert('boss', { x: 7.9, y: 0, z: 7.9 }, 3.0);
      grid.insert('minion', { x: 8.2, y: 0, z: 8.2 }, 0.5);
      grid.insert('distant', { x: 100, y: 0, z: 100 }, 1.0);

      const nearby = grid.queryNearby({ x: 8.0, y: 0, z: 8.0 }, 2.0);

      expect(nearby).toContain('boss');
      expect(nearby).toContain('minion');
      expect(nearby).not.toContain('distant');

      // Verify no duplicates
      const uniqueCount = new Set(nearby).size;
      expect(nearby.length).toBe(uniqueCount);
    });

    it('should return empty list when no entities exist in queried cells', () => {
      grid.insert('lone-wolf', { x: -10, y: 0, z: -10 }, 0.5);
      const nearby = grid.queryNearby({ x: 10, y: 0, z: 10 }, 2.0);
      expect(nearby).toEqual([]);
    });
  });
});
