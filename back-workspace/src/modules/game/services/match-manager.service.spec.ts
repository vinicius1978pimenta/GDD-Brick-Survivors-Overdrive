import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Repository } from 'typeorm';
import { MatchRecord } from '../entities/match-record.entity.js';
import type { ConnectedPlayer, RoomVehicle } from '../interfaces/index.js';
import { CombatService } from './combat.service.js';
import { MatchManagerService } from './match-manager.service.js';

describe('MatchManagerService', () => {
  let service: MatchManagerService;
  let combatService: CombatService;
  let players: Map<string, ConnectedPlayer>;
  let vehicles: Map<string, RoomVehicle>;
  let mockRepo: Partial<Repository<MatchRecord>>;

  function createPlayer(id: string, x = 0, z = 0, health = 100): ConnectedPlayer {
    return {
      id,
      name: `Player_${id}`,
      x,
      y: 0,
      z,
      vy: 0,
      rotationY: 0,
      speed: 0,
      isDriving: false,
      isGrounded: true,
      vehicleId: null,
      lastProcessedSeq: 0,
      pendingInputs: [],
      health,
      maxHealth: 100,
    };
  }

  beforeEach(() => {
    mockRepo = {
      create: vi.fn().mockImplementation((dto) => dto),
      save: vi.fn().mockImplementation(async (record) => ({ id: 'mock-uuid', ...record })),
    };

    service = new MatchManagerService(mockRepo as Repository<MatchRecord>);
    combatService = new CombatService();
    players = new Map<string, ConnectedPlayer>();
    vehicles = new Map<string, RoomVehicle>();
  });

  describe('FSM and State Transitions', () => {
    it('should initialize in waiting state with coop_survival mode', () => {
      expect(service.getState()).toBe('waiting');
      expect(service.getMode()).toBe('coop_survival');
      expect(service.getCurrentWave()).toBe(1);
    });

    it('should allow changing mode only in waiting state', () => {
      expect(service.setMode('pvp_deathmatch')).toBe(true);
      expect(service.getMode()).toBe('pvp_deathmatch');

      service.startCountdown();
      expect(service.setMode('coop_survival')).toBe(false);
      expect(service.getMode()).toBe('pvp_deathmatch');
    });

    it('should register and unregister players and track scores', () => {
      const p1 = createPlayer('p-1');
      service.registerPlayer(p1);

      expect(service.getScores().length).toBe(1);
      expect(service.getPlayerScore('p-1')?.playerName).toBe('Player_p-1');

      service.unregisterPlayer('p-1');
      expect(service.getScores().length).toBe(0);
    });

    it('should transition from waiting to countdown when all registered players are ready', () => {
      const p1 = createPlayer('p-1');
      service.registerPlayer(p1);

      expect(service.setPlayerReady('p-1', true)).toBe(true);
      expect(service.getState()).toBe('countdown');
    });

    it('should transition from countdown to in_progress when timer runs out', () => {
      const p1 = createPlayer('p-1');
      service.registerPlayer(p1);
      service.startCountdown();

      expect(service.getState()).toBe('countdown');

      // Countdown is 3 seconds; advance by 3.5s
      service.update(3.5, players, vehicles, combatService);
      expect(service.getState()).toBe('in_progress');
    });
  });

  describe('Co-op Survival Mode', () => {
    beforeEach(() => {
      service.setMode('coop_survival');
      const p1 = createPlayer('p-1', 0, 0);
      players.set('p-1', p1);
      service.registerPlayer(p1);
      service.startMatch();
    });

    it('should spawn enemies on match start', () => {
      expect(service.getState()).toBe('in_progress');
      const enemies = service.getEnemies();
      expect(enemies.length).toBeGreaterThan(0);
      expect(enemies[0].type).toBe('scout_block');
    });

    it('should make enemies pursue the nearest active player', () => {
      const enemies = service.getEnemies();
      const enemy = enemies[0];
      const initialDist = Math.hypot(enemy.x, enemy.z);

      service.update(0.1, players, vehicles, combatService);

      const newDist = Math.hypot(enemy.x, enemy.z);
      expect(newDist).toBeLessThan(initialDist);
    });

    it('should damage player when enemy contacts player', () => {
      const p1 = players.get('p-1')!;
      const enemies = service.getEnemies();
      const enemy = enemies[0];

      // Place enemy in direct contact with player
      enemy.x = p1.x + 0.5;
      enemy.z = p1.z + 0.5;
      enemy.attackCooldown = 0;

      service.update(0.1, players, vehicles, combatService);

      expect(p1.health).toBeLessThan(100);
      expect(enemy.attackCooldown).toBeGreaterThan(0);
    });

    it('should damage and destroy enemy when hit by projectile and award points', () => {
      const enemies = service.getEnemies();
      const enemy = enemies[0];
      enemy.x = 5;
      enemy.z = 5;
      enemy.health = 10;

      // Shoot a projectile towards enemy
      combatService.handleShoot('p-1', {
        weaponType: 'stud_blaster',
        origin: { x: 5, y: 0.5, z: 4.8 },
        direction: { x: 0, y: 0, z: 1 },
        clientTimestamp: Date.now(),
      });

      const initialCount = enemies.length;
      service.update(0.05, players, vehicles, combatService);

      expect(service.getEnemies().length).toBe(initialCount - 1);
      expect(service.getTotalScore()).toBeGreaterThan(0);
      expect(service.getPlayerScore('p-1')?.kills).toBe(1);
    });

    it('should enter wave_intermission with 3 upgrade choices when wave is cleared', () => {
      // Clear all enemies
      service.getEnemies().length = 0;

      service.update(0.05, players, vehicles, combatService);

      expect(service.getState()).toBe('wave_intermission');
      expect(service.getUpgradeOptions().length).toBe(3);
    });

    it('should apply selected upgrade to player and record it', () => {
      const p1 = players.get('p-1')!;
      service.getEnemies().length = 0;
      service.update(0.05, players, vehicles, combatService);

      const options = service.getUpgradeOptions();
      expect(options.length).toBe(3);

      const chosen = options[0];
      const initialMaxHealth = p1.maxHealth;
      const success = service.selectUpgrade('p-1', chosen.id, p1);

      expect(success).toBe(true);
      expect(service.getPlayerScore('p-1')?.upgrades).toContain(chosen.id);

      if (chosen.stat === 'max_health') {
        expect(p1.maxHealth).toBe(initialMaxHealth + chosen.value);
      }
    });

    it('should start next wave after intermission duration expires', () => {
      service.getEnemies().length = 0;
      service.update(0.05, players, vehicles, combatService);
      expect(service.getState()).toBe('wave_intermission');

      // Intermission is 10s; advance by 10.5s
      service.update(10.5, players, vehicles, combatService);

      expect(service.getState()).toBe('in_progress');
      expect(service.getCurrentWave()).toBe(2);
      expect(service.getEnemies().length).toBeGreaterThan(0);
    });

    it('should trigger game_over and persist record when all players are eliminated', () => {
      const p1 = players.get('p-1')!;
      p1.health = 0;

      service.update(0.05, players, vehicles, combatService);

      expect(service.getState()).toBe('game_over');
      expect(mockRepo.save).toHaveBeenCalled();
    });
  });

  describe('PvP Deathmatch Mode', () => {
    beforeEach(() => {
      service.setMode('pvp_deathmatch');
      const p1 = createPlayer('p-1', -5, 0);
      const p2 = createPlayer('p-2', 5, 0);
      players.set('p-1', p1);
      players.set('p-2', p2);
      service.registerPlayer(p1);
      service.registerPlayer(p2);
      service.startMatch();
    });

    it('should track kills and deaths upon player elimination and respawn with invulnerability', () => {
      const p2 = players.get('p-2')!;
      p2.health = 0; // p2 died

      service.update(0.05, players, vehicles, combatService);

      const score1 = service.getPlayerScore('p-1');
      const score2 = service.getPlayerScore('p-2');

      expect(score1?.kills).toBe(1);
      expect(score2?.deaths).toBe(1);
      expect(p2.health).toBe(100); // Respawned
      expect(score2?.invulnerableUntil).toBeGreaterThan(Date.now());
    });

    it('should end match in victory when a player reaches target kills', () => {
      const score1 = service.getPlayerScore('p-1')!;
      score1.kills = 9;

      const p2 = players.get('p-2')!;
      p2.health = 0;

      service.update(0.05, players, vehicles, combatService);

      expect(score1.kills).toBe(10);
      expect(service.getState()).toBe('victory');
      expect(mockRepo.save).toHaveBeenCalled();
    });

    it('should end match when time limit expires and declare winner', () => {
      const score1 = service.getPlayerScore('p-1')!;
      score1.score = 250;

      // Match time is 180s; advance by 185s
      service.update(185, players, vehicles, combatService);

      expect(service.getState()).toBe('victory');
      const snapshot = service.getSnapshot();
      expect(snapshot.winnerId).toBe('p-1');
      expect(mockRepo.save).toHaveBeenCalled();
    });
  });

  describe('Snapshot Generation and Reset', () => {
    it('should produce serializable MatchStateSnapshot', () => {
      const p1 = createPlayer('p-1');
      players.set('p-1', p1);
      service.registerPlayer(p1);

      const snapshot = service.getSnapshot();
      expect(snapshot).toHaveProperty('mode');
      expect(snapshot).toHaveProperty('state');
      expect(snapshot).toHaveProperty('timeRemaining');
      expect(snapshot).toHaveProperty('currentWave');
      expect(snapshot).toHaveProperty('enemies');
      expect(snapshot).toHaveProperty('scores');
      expect(snapshot.scores.length).toBe(1);
    });

    it('should reset match state cleanly', () => {
      service.startMatch();
      expect(service.getState()).toBe('in_progress');

      service.reset();
      expect(service.getState()).toBe('waiting');
      expect(service.getCurrentWave()).toBe(1);
      expect(service.getEnemies().length).toBe(0);
    });
  });
});
