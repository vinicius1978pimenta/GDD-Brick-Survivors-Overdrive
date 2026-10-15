import { Injectable, Logger, Optional } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { MatchRecord } from '../entities/match-record.entity.js';
import {
  ARENA_BOUNDS,
  COOP_CONFIG,
  ENEMY_CONFIGS,
  PVP_CONFIG,
  UPGRADE_CATALOG,
} from '../interfaces/index.js';
import type {
  ConnectedPlayer,
  EnemyEntity,
  EnemySnapshot,
  EnemyType,
  GameModeType,
  MatchState,
  MatchStateSnapshot,
  PlayerMatchScore,
  RoomVehicle,
  UpgradeOption,
} from '../interfaces/index.js';
import { CombatService } from './combat.service.js';

@Injectable()
export class MatchManagerService {
  private readonly logger = new Logger(MatchManagerService.name);

  private mode: GameModeType = 'coop_survival';
  private state: MatchState = 'waiting';

  private timeRemaining: number = COOP_CONFIG.countdownDurationSec;
  private countdownSeconds: number = COOP_CONFIG.countdownDurationSec;
  private intermissionTimeRemaining: number = 0;

  private currentWave: number = 1;
  private totalScore: number = 0;
  private elapsedTime: number = 0;
  private winnerId: string | null = null;
  private hasPersisted = false;

  private readonly enemies: EnemyEntity[] = [];
  private readonly playerScores = new Map<string, PlayerMatchScore>();
  private readonly readyPlayers = new Set<string>();
  private currentUpgradeOptions: UpgradeOption[] = [];
  private enemySeq = 0;

  constructor(
    @Optional()
    @InjectRepository(MatchRecord)
    private readonly matchRecordRepo?: Repository<MatchRecord>,
  ) {}

  public getMode(): GameModeType {
    return this.mode;
  }

  public getState(): MatchState {
    return this.state;
  }

  public getCurrentWave(): number {
    return this.currentWave;
  }

  public getTotalScore(): number {
    return this.totalScore;
  }

  public getEnemies(): EnemyEntity[] {
    return this.enemies;
  }

  public getUpgradeOptions(): UpgradeOption[] {
    return this.currentUpgradeOptions;
  }

  public getScores(): PlayerMatchScore[] {
    return Array.from(this.playerScores.values());
  }

  public getPlayerScore(playerId: string): PlayerMatchScore | undefined {
    return this.playerScores.get(playerId);
  }

  public setMode(mode: GameModeType): boolean {
    if (this.state !== 'waiting') {
      return false;
    }
    this.mode = mode;
    this.logger.log(`Game mode changed to: ${mode}`);
    return true;
  }

  public registerPlayer(player: ConnectedPlayer): void {
    const existing = this.playerScores.get(player.id);
    if (existing) {
      existing.playerName = player.name;
    } else {
      this.playerScores.set(player.id, {
        playerId: player.id,
        playerName: player.name,
        kills: 0,
        deaths: 0,
        score: 0,
        upgrades: [],
        invulnerableUntil: 0,
      });
    }
  }

  public unregisterPlayer(playerId: string): void {
    this.readyPlayers.delete(playerId);
    this.playerScores.delete(playerId);
  }

  public setPlayerReady(playerId: string, ready: boolean): boolean {
    if (this.state !== 'waiting') {
      return false;
    }
    if (ready) {
      this.readyPlayers.add(playerId);
    } else {
      this.readyPlayers.delete(playerId);
    }

    if (this.readyPlayers.size > 0 && this.readyPlayers.size >= this.playerScores.size) {
      this.startCountdown();
    }
    return true;
  }

  public startCountdown(): void {
    this.state = 'countdown';
    this.countdownSeconds =
      this.mode === 'coop_survival'
        ? COOP_CONFIG.countdownDurationSec
        : PVP_CONFIG.countdownDurationSec;
    this.timeRemaining = this.countdownSeconds;
    this.logger.log(`Match countdown started: ${this.countdownSeconds}s (${this.mode})`);
  }

  public startMatch(): void {
    this.state = 'in_progress';
    this.elapsedTime = 0;
    this.totalScore = 0;
    this.hasPersisted = false;
    this.winnerId = null;

    if (this.mode === 'coop_survival') {
      this.currentWave = 1;
      this.spawnWave(this.currentWave);
    } else {
      this.timeRemaining = PVP_CONFIG.matchDurationSec;
    }
    this.logger.log(`Match officially in_progress (${this.mode})`);
  }

  public selectUpgrade(playerId: string, upgradeId: string, player: ConnectedPlayer): boolean {
    if (this.state !== 'wave_intermission') {
      return false;
    }

    const upgrade = this.currentUpgradeOptions.find((u) => u.id === upgradeId);
    if (!upgrade) {
      return false;
    }

    const score = this.playerScores.get(playerId);
    if (!score) {
      return false;
    }

    if (score.upgrades.includes(upgradeId)) {
      return false;
    }

    score.upgrades.push(upgradeId);
    this.applyUpgradeStat(player, upgrade);
    this.logger.log(`Player ${player.name} selected upgrade: ${upgrade.name}`);
    return true;
  }

  private applyUpgradeStat(player: ConnectedPlayer, upgrade: UpgradeOption): void {
    switch (upgrade.stat) {
      case 'max_health':
        player.maxHealth += upgrade.value;
        player.health = Math.min(player.maxHealth, player.health + upgrade.value);
        break;
      case 'move_speed':
        // Stat multiplier applied on movement physics
        break;
      default:
        break;
    }
  }

  public update(
    dt: number,
    players: Map<string, ConnectedPlayer>,
    vehicles: Map<string, RoomVehicle>,
    combatService: CombatService,
  ): void {
    switch (this.state) {
      case 'countdown':
        this.updateCountdown(dt);
        break;
      case 'in_progress':
        this.elapsedTime += dt;
        if (this.mode === 'coop_survival') {
          this.updateCoop(dt, players, vehicles, combatService);
        } else {
          this.updatePvp(dt, players, vehicles, combatService);
        }
        break;
      case 'wave_intermission':
        this.updateWaveIntermission(dt);
        break;
      case 'victory':
      case 'game_over':
        if (!this.hasPersisted) {
          void this.persistMatchRecord();
        }
        break;
      default:
        break;
    }
  }

  private updateCountdown(dt: number): void {
    this.timeRemaining -= dt;
    this.countdownSeconds = Math.max(0, Math.ceil(this.timeRemaining));
    if (this.timeRemaining <= 0) {
      this.startMatch();
    }
  }

  private updateWaveIntermission(dt: number): void {
    this.intermissionTimeRemaining -= dt;
    if (this.intermissionTimeRemaining <= 0) {
      this.currentWave++;
      this.state = 'in_progress';
      this.currentUpgradeOptions = [];
      this.spawnWave(this.currentWave);
      this.logger.log(`Wave ${this.currentWave} starting after intermission`);
    }
  }

  public finishMatch(resultState: 'victory' | 'game_over'): void {
    this.state = resultState;
    if (!this.hasPersisted) {
      void this.persistMatchRecord();
    }
  }

  private updateCoop(
    dt: number,
    players: Map<string, ConnectedPlayer>,
    vehicles: Map<string, RoomVehicle>,
    combatService: CombatService,
  ): void {
    const activePlayers = Array.from(players.values()).filter((p) => p.health > 0);

    // Check game over if all players dead
    if (players.size > 0 && activePlayers.length === 0) {
      this.finishMatch('game_over');
      this.logger.log('Co-op survival: Game Over - all players eliminated');
      return;
    }

    // 1. Enemy Pursuit AI
    for (const enemy of this.enemies) {
      this.updateEnemyPursuit(enemy, activePlayers, dt);
    }

    // 2. Enemy vs Player Collisions & Damage
    for (const enemy of this.enemies) {
      for (const player of activePlayers) {
        if (player.isDriving) {
          continue;
        }

        const dist = Math.hypot(enemy.x - player.x, enemy.z - player.z);
        if (dist <= enemy.radius + 0.5) {
          enemy.attackCooldown -= dt;
          if (enemy.attackCooldown <= 0) {
            player.health = Math.max(0, player.health - enemy.damage);
            enemy.attackCooldown = ENEMY_CONFIGS[enemy.type].attackCooldownSec;
            this.logger.log(
              `Enemy ${enemy.id} attacked ${player.name} for ${enemy.damage} dmg. Health: ${player.health}`,
            );
          }
        }
      }
    }

    // 3. Projectiles vs Enemies
    const activeProjectiles = combatService.getActiveProjectiles();
    const remainingEnemies: EnemyEntity[] = [];

    for (const enemy of this.enemies) {
      let isDead = false;

      for (const proj of activeProjectiles) {
        if (proj.remainingLife <= 0) {
          continue;
        }

        const dist = Math.hypot(proj.x - enemy.x, proj.z - enemy.z);
        const hitRadius = proj.radius + enemy.radius;
        if (dist <= hitRadius) {
          enemy.health -= proj.damage;
          proj.remainingLife = 0; // Consume projectile

          if (enemy.health <= 0) {
            isDead = true;
            this.totalScore += enemy.scoreValue;

            const score = this.playerScores.get(proj.ownerId);
            if (score) {
              score.kills++;
              score.score += enemy.scoreValue;
            }
            break;
          }
        }
      }

      if (!isDead) {
        remainingEnemies.push(enemy);
      }
    }

    this.enemies.length = 0;
    this.enemies.push(...remainingEnemies);

    // 4. Wave Completion
    if (this.enemies.length === 0) {
      if (this.currentWave >= COOP_CONFIG.maxWaves) {
        this.finishMatch('victory');
        this.logger.log(`Co-op survival: Victory! All ${COOP_CONFIG.maxWaves} waves cleared!`);
      } else {
        this.state = 'wave_intermission';
        this.intermissionTimeRemaining = COOP_CONFIG.intermissionDurationSec;
        this.generateUpgradeOptions();
        this.logger.log(
          `Wave ${this.currentWave} cleared. Entering intermission for ${this.intermissionTimeRemaining}s`,
        );
      }
    }
  }

  private updateEnemyPursuit(
    enemy: EnemyEntity,
    activePlayers: ConnectedPlayer[],
    dt: number,
  ): void {
    if (activePlayers.length === 0) {
      enemy.vx = 0;
      enemy.vz = 0;
      return;
    }

    // Find nearest active player
    let closestPlayer: ConnectedPlayer | null = null;
    let minDistSq = Infinity;

    for (const player of activePlayers) {
      const dx = player.x - enemy.x;
      const dz = player.z - enemy.z;
      const distSq = dx * dx + dz * dz;
      if (distSq < minDistSq) {
        minDistSq = distSq;
        closestPlayer = player;
      }
    }

    if (closestPlayer) {
      enemy.targetPlayerId = closestPlayer.id;
      const dx = closestPlayer.x - enemy.x;
      const dz = closestPlayer.z - enemy.z;
      const len = Math.hypot(dx, dz) || 1;

      enemy.vx = (dx / len) * enemy.speed;
      enemy.vz = (dz / len) * enemy.speed;
      enemy.rotationY = Math.atan2(dx, dz);

      enemy.x += enemy.vx * dt;
      enemy.z += enemy.vz * dt;

      enemy.x = Math.max(ARENA_BOUNDS.minX + 1, Math.min(ARENA_BOUNDS.maxX - 1, enemy.x));
      enemy.z = Math.max(ARENA_BOUNDS.minZ + 1, Math.min(ARENA_BOUNDS.maxZ - 1, enemy.z));
    }
  }

  private updatePvp(
    dt: number,
    players: Map<string, ConnectedPlayer>,
    _vehicles: Map<string, RoomVehicle>,
    _combatService: CombatService,
  ): void {
    this.timeRemaining -= dt;

    const now = Date.now();

    // Check player deaths and handle respawn & scoring
    for (const player of players.values()) {
      if (player.health <= 0) {
        const victimScore = this.playerScores.get(player.id);
        if (victimScore) {
          victimScore.deaths++;
        }

        // Find recent damage event to attribute kill
        const attackerId = this.findLastAttacker(player.id);
        if (attackerId && attackerId !== player.id) {
          const killerScore = this.playerScores.get(attackerId);
          if (killerScore) {
            killerScore.kills++;
            killerScore.score += 100;

            if (killerScore.kills >= PVP_CONFIG.targetKills) {
              this.winnerId = attackerId;
              this.finishMatch('victory');
              this.logger.log(`PvP Match Ended: Player ${attackerId} reached ${PVP_CONFIG.targetKills} kills!`);
              return;
            }
          }
        }

        // Safe respawn distributed in expanded arena (15m to 35m radius)
        const respawnAngle = Math.random() * Math.PI * 2;
        const respawnDist = 15.0 + Math.random() * 20.0;
        player.health = player.maxHealth;
        player.x = Number((Math.cos(respawnAngle) * respawnDist).toFixed(2));
        player.z = Number((Math.sin(respawnAngle) * respawnDist).toFixed(2));
        player.speed = 0;

        if (victimScore) {
          victimScore.invulnerableUntil = now + PVP_CONFIG.invulnerabilityDurationMs;
        }
      }
    }

    if (this.timeRemaining <= 0) {
      this.determinePvpWinner();
      this.finishMatch('victory');
      this.logger.log(`PvP Match Ended: Time limit reached. Winner: ${this.winnerId ?? 'None'}`);
    }
  }

  private findLastAttacker(victimId: string): string | null {
    // Return highest killer or active opponent
    for (const playerId of this.playerScores.keys()) {
      if (playerId !== victimId) {
        return playerId;
      }
    }
    return null;
  }

  private determinePvpWinner(): void {
    let topPlayerId: string | null = null;
    let highestScore = -1;

    for (const score of this.playerScores.values()) {
      if (score.score > highestScore) {
        highestScore = score.score;
        topPlayerId = score.playerId;
      }
    }
    this.winnerId = topPlayerId;
  }

  private spawnWave(waveNumber: number): void {
    const waveIndex = Math.min(waveNumber - 1, COOP_CONFIG.waves.length - 1);
    const waveConfig = COOP_CONFIG.waves[waveIndex];

    for (const [typeStr, count] of Object.entries(waveConfig.enemyCounts)) {
      const type = typeStr as EnemyType;
      const config = ENEMY_CONFIGS[type];

      for (let i = 0; i < count; i++) {
        this.enemySeq++;
        const angle = Math.random() * Math.PI * 2;
        const spawnDist = 25.0 + Math.random() * 15.0; // 25m to 40m in 100x100 arena
        const rawX = Math.cos(angle) * spawnDist;
        const rawZ = Math.sin(angle) * spawnDist;
        const clampedX = Math.max(ARENA_BOUNDS.minX + 3, Math.min(ARENA_BOUNDS.maxX - 3, rawX));
        const clampedZ = Math.max(ARENA_BOUNDS.minZ + 3, Math.min(ARENA_BOUNDS.maxZ - 3, rawZ));

        const enemy: EnemyEntity = {
          id: `enemy-${type}-${this.enemySeq}`,
          type,
          x: Number(clampedX.toFixed(2)),
          y: 0,
          z: Number(clampedZ.toFixed(2)),
          vx: 0,
          vy: 0,
          vz: 0,
          rotationY: 0,
          health: config.health,
          maxHealth: config.health,
          speed: config.speed,
          damage: config.damage,
          scoreValue: config.scoreValue,
          radius: config.radius,
          targetPlayerId: null,
          attackCooldown: 0,
        };
        this.enemies.push(enemy);
      }
    }
    this.logger.log(`Wave ${waveNumber} spawned with ${this.enemies.length} enemies.`);
  }

  private generateUpgradeOptions(): void {
    const shuffled = [...UPGRADE_CATALOG].sort(() => 0.5 - Math.random());
    this.currentUpgradeOptions = shuffled.slice(0, 3);
  }

  public async persistMatchRecord(): Promise<MatchRecord | null> {
    if (this.hasPersisted) {
      return null;
    }
    this.hasPersisted = true;

    if (!this.matchRecordRepo) {
      this.logger.debug('No matchRecordRepo available, skipping persistence');
      return null;
    }

    try {
      const record = this.matchRecordRepo.create({
        mode: this.mode,
        durationSeconds: Math.floor(this.elapsedTime),
        totalScore: this.totalScore,
        wavesCompleted: Math.max(0, this.currentWave - 1),
        winnerId: this.winnerId,
      });

      const saved = await this.matchRecordRepo.save(record);
      this.logger.log(`Match record persisted: ${saved.id} (mode=${saved.mode}, score=${saved.totalScore})`);
      return saved;
    } catch (error) {
      this.logger.error(`Error persisting match record: ${String(error)}`);
      return null;
    }
  }

  public getSnapshot(): MatchStateSnapshot {
    const enemySnapshots: EnemySnapshot[] = this.enemies.map((e) => ({
      id: e.id,
      type: e.type,
      x: e.x,
      y: e.y,
      z: e.z,
      rotationY: e.rotationY,
      health: e.health,
      maxHealth: e.maxHealth,
    }));

    return {
      mode: this.mode,
      state: this.state,
      timeRemaining: Math.max(0, Math.ceil(this.timeRemaining)),
      countdownSeconds: this.countdownSeconds,
      currentWave: this.currentWave,
      maxWaves: COOP_CONFIG.maxWaves,
      totalScore: this.totalScore,
      enemies: enemySnapshots,
      upgradeOptions: this.currentUpgradeOptions,
      scores: Array.from(this.playerScores.values()),
      winnerId: this.winnerId,
      intermissionTimeRemaining: Math.max(0, Math.ceil(this.intermissionTimeRemaining)),
    };
  }

  public reset(): void {
    this.state = 'waiting';
    this.currentWave = 1;
    this.totalScore = 0;
    this.elapsedTime = 0;
    this.winnerId = null;
    this.hasPersisted = false;
    this.enemies.length = 0;
    this.readyPlayers.clear();
    this.currentUpgradeOptions = [];
  }
}
