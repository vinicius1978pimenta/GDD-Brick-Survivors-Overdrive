import type { Vector3D } from '../interfaces/index.js';

export class SpatialHashGrid {
  private readonly cellSize: number;
  private readonly grid = new Map<string, Set<string>>();
  private readonly entityCells = new Map<string, Set<string>>();
  private readonly entityBounds = new Map<string, { position: Vector3D; radius: number }>();

  constructor(cellSize = 8.0) {
    if (cellSize <= 0) {
      throw new Error('SpatialHashGrid cellSize must be greater than zero.');
    }
    this.cellSize = cellSize;
  }

  public getCellSize(): number {
    return this.cellSize;
  }

  public getEntityCount(): number {
    return this.entityBounds.size;
  }

  public getCellCount(): number {
    return this.grid.size;
  }

  public getEntityBounds(entityId: string): { position: Vector3D; radius: number } | undefined {
    return this.entityBounds.get(entityId);
  }

  public insert(entityId: string, position: Vector3D, radius = 0): void {
    if (!entityId) {
      return;
    }

    if (this.entityCells.has(entityId)) {
      this.remove(entityId);
    }

    const safeRadius = Math.max(0, radius);
    const cellKeys = this.computeCellKeys(position, safeRadius);
    const registeredCells = new Set<string>();

    for (const key of cellKeys) {
      let cell = this.grid.get(key);
      if (!cell) {
        cell = new Set<string>();
        this.grid.set(key, cell);
      }
      cell.add(entityId);
      registeredCells.add(key);
    }

    this.entityCells.set(entityId, registeredCells);
    this.entityBounds.set(entityId, { position, radius: safeRadius });
  }

  public update(entityId: string, position: Vector3D, radius = 0): void {
    this.insert(entityId, position, radius);
  }

  public remove(entityId: string): void {
    const cells = this.entityCells.get(entityId);
    if (!cells) {
      return;
    }

    for (const key of cells) {
      const cell = this.grid.get(key);
      if (cell) {
        cell.delete(entityId);
        if (cell.size === 0) {
          this.grid.delete(key);
        }
      }
    }

    this.entityCells.delete(entityId);
    this.entityBounds.delete(entityId);
  }

  public queryNearby(position: Vector3D, radius: number): string[] {
    const safeRadius = Math.max(0, radius);
    const cellKeys = this.computeCellKeys(position, safeRadius);
    const result = new Set<string>();

    for (const key of cellKeys) {
      const cell = this.grid.get(key);
      if (cell) {
        for (const entityId of cell) {
          result.add(entityId);
        }
      }
    }

    return Array.from(result);
  }

  public clear(): void {
    this.grid.clear();
    this.entityCells.clear();
    this.entityBounds.clear();
  }

  private computeCellKeys(position: Vector3D, radius: number): string[] {
    const minX = Math.floor((position.x - radius) / this.cellSize);
    const maxX = Math.floor((position.x + radius) / this.cellSize);
    const minY = Math.floor((position.y - radius) / this.cellSize);
    const maxY = Math.floor((position.y + radius) / this.cellSize);
    const minZ = Math.floor((position.z - radius) / this.cellSize);
    const maxZ = Math.floor((position.z + radius) / this.cellSize);

    const keys: string[] = [];
    for (let x = minX; x <= maxX; x++) {
      for (let y = minY; y <= maxY; y++) {
        for (let z = minZ; z <= maxZ; z++) {
          keys.push(`${x}:${y}:${z}`);
        }
      }
    }
    return keys;
  }
}
