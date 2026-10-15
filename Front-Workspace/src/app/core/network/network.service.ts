import { Injectable, Inject, PLATFORM_ID, signal } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { io, Socket } from 'socket.io-client';
import {
  JoinGameResponse,
  MatchSnapshotCallback,
  PlayerInputPayload,
  PlayerShootPayload,
  PongResponse,
  SnapshotCallback,
  WorldStateSnapshot,
} from './types/network.types';
import { GameModeType, MatchStateSnapshot } from '../engine/types/match.types';

@Injectable({
  providedIn: 'root',
})
export class NetworkService {
  private socket: Socket | null = null;
  private heartbeatIntervalId: ReturnType<typeof setInterval> | null = null;
  private sequenceNumber = 0;
  private snapshotListeners: SnapshotCallback[] = [];
  private matchListeners: MatchSnapshotCallback[] = [];

  private pendingPlayerName: string | null = null;

  // Sinais reativos públicos para o HUD e a simulação
  public readonly isConnected = signal(false);
  public readonly pingMs = signal(0);
  public readonly serverTick = signal(0);
  public readonly localPlayerId = signal<string | null>(null);
  public readonly latestSnapshot = signal<WorldStateSnapshot | null>(null);
  public readonly currentMatch = signal<MatchStateSnapshot | null>(null);
  public readonly isPlayerReady = signal(false);

  constructor(@Inject(PLATFORM_ID) private readonly platformId: object) {}

  /**
   * Conecta ao Gateway WebSocket (NestJS) do servidor.
   */
  public connect(serverUrl: string = 'http://localhost:3000'): void {
    if (!isPlatformBrowser(this.platformId) || this.socket) {
      return;
    }

    this.socket = io(serverUrl, {
      transports: ['websocket', 'polling'],
      autoConnect: true,
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 1000,
    });

    this.setupSocketListeners();
    this.startHeartbeatPing();
  }

  /**
   * Desconecta o socket e limpa os timers.
   */
  public disconnect(): void {
    this.stopHeartbeatPing();
    this.pendingPlayerName = null;

    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }

    this.isConnected.set(false);
    this.localPlayerId.set(null);
    this.pingMs.set(0);
  }

  /**
   * Entra na sala de jogo autoritativa no servidor.
   * Aguarda a conexão caso ainda esteja em handshake e reconecta automaticamente.
   */
  public async joinGame(playerName?: string): Promise<JoinGameResponse | null> {
    if (playerName) {
      this.pendingPlayerName = playerName;
    }

    if (!isPlatformBrowser(this.platformId)) {
      return null;
    }

    if (!this.socket) {
      this.connect();
    }

    const nameToJoin = this.pendingPlayerName ?? playerName;

    // Se o socket ainda está conectando, aguarda o evento 'connect' antes de emitir
    if (!this.isConnected()) {
      return new Promise((resolve) => {
        const onConnected = () => {
          this.emitJoinGame(nameToJoin).then(resolve);
        };

        if (this.socket) {
          this.socket.once('connect', onConnected);
        } else {
          resolve(null);
        }
      });
    }

    return this.emitJoinGame(nameToJoin);
  }

  private emitJoinGame(playerName?: string): Promise<JoinGameResponse | null> {
    if (!this.socket) {
      return Promise.resolve(null);
    }

    return new Promise((resolve) => {
      this.socket?.emit('joinGame', { playerName }, (response: JoinGameResponse) => {
        if (response && response.status === 'ok') {
          this.localPlayerId.set(response.playerId);
          this.serverTick.set(response.tick);
          resolve(response);
        } else {
          resolve(null);
        }
      });
    });
  }

  /**
   * Envia os inputs do jogador local com número sequencial para predição e reconciliação.
   */
  public sendInput(input: {
    forward: boolean;
    backward: boolean;
    left: boolean;
    right: boolean;
    handbrake: boolean;
    jump?: boolean;
    interact: boolean;
    rotationY?: number;
    dt: number;
  }): number {
    this.sequenceNumber++;
    const payload: PlayerInputPayload = {
      seq: this.sequenceNumber,
      forward: input.forward,
      backward: input.backward,
      left: input.left,
      right: input.right,
      handbrake: input.handbrake,
      jump: Boolean(input.jump),
      interact: input.interact,
      rotationY: input.rotationY,
      dt: input.dt,
      timestamp: Date.now(),
    };

    if (this.socket && this.isConnected()) {
      this.socket.emit('playerInput', payload);
    }

    return this.sequenceNumber;
  }

  /**
   * Emite a ação de disparo de arma fictícia para o servidor via Socket.IO.
   */
  public shoot(
    weaponType: 'stud_blaster' | 'scatter_shot' | 'spring_mine',
    origin: { readonly x: number; readonly y: number; readonly z: number },
    direction: { readonly x: number; readonly y: number; readonly z: number },
  ): void {
    if (this.socket && this.isConnected()) {
      const payload: PlayerShootPayload = {
        weaponType,
        origin,
        direction,
        clientTimestamp: Date.now(),
      };
      this.socket.emit('playerShoot', payload);
    }
  }

  /**
   * Define o modo de jogo (Sobrevivência Co-op ou PvP Deathmatch).
   */
  public setGameMode(mode: GameModeType): void {
    if (this.socket && this.isConnected()) {
      this.socket.emit('changeMode', { mode });
      this.socket.emit('setGameMode', { mode });
    }
  }

  /**
   * Altera o status de "Pronto" do jogador para a partida.
   */
  public setPlayerReady(ready: boolean): void {
    this.isPlayerReady.set(ready);
    if (this.socket && this.isConnected()) {
      this.socket.emit('readyMatch', { ready });
      this.socket.emit('playerReady', { ready });
    }
  }

  /**
   * Seleciona um upgrade durante a fase de intermissão entre ondas (wave intermission).
   */
  public selectUpgrade(upgradeId: string): void {
    if (this.socket && this.isConnected()) {
      this.socket.emit('selectUpgrade', { upgradeId });
    }
  }

  /**
   * Registra um callback para ser chamado imediatamente ao receber uma atualização da partida.
   */
  public onMatchSnapshot(callback: MatchSnapshotCallback): () => void {
    this.matchListeners.push(callback);
    return () => {
      this.matchListeners = this.matchListeners.filter((cb) => cb !== callback);
    };
  }

  /**
   * Registra um callback para ser chamado imediatamente ao receber um novo snapshot.
   */
  public onSnapshot(callback: SnapshotCallback): () => void {
    this.snapshotListeners.push(callback);
    return () => {
      this.snapshotListeners = this.snapshotListeners.filter((cb) => cb !== callback);
    };
  }

  /**
   * Dispara pings periódicos para calcular a latência (RTT) em tempo real.
   */
  public startHeartbeatPing(intervalMs = 2000): void {
    this.stopHeartbeatPing();

    if (!isPlatformBrowser(this.platformId)) {
      return;
    }

    this.heartbeatIntervalId = setInterval(() => {
      if (this.socket && this.isConnected()) {
        const clientTimestamp = Date.now();
        this.socket.emit('ping', { clientTimestamp });
      }
    }, intervalMs);
  }

  public stopHeartbeatPing(): void {
    if (this.heartbeatIntervalId !== null) {
      clearInterval(this.heartbeatIntervalId);
      this.heartbeatIntervalId = null;
    }
  }

  public getCurrentSequence(): number {
    return this.sequenceNumber;
  }

  /**
   * Permite injetar uma instância de Socket customizada (usado principalmente em testes unitários).
   */
  public setSocketForTesting(mockSocket: Socket): void {
    this.socket = mockSocket;
    this.setupSocketListeners();
  }

  private setupSocketListeners(): void {
    if (!this.socket) {
      return;
    }

    this.socket.on('connect', () => {
      this.isConnected.set(true);
      if (this.socket?.id) {
        this.localPlayerId.set(this.socket.id);
      }
      if (this.pendingPlayerName) {
        this.emitJoinGame(this.pendingPlayerName);
      }
    });

    this.socket.on('disconnect', () => {
      this.isConnected.set(false);
      this.localPlayerId.set(null);
      this.currentMatch.set(null);
      this.isPlayerReady.set(false);
    });

    this.socket.on('pong', (data: PongResponse) => {
      if (data && typeof data.clientTimestamp === 'number') {
        const roundTripTime = Math.max(0, Date.now() - data.clientTimestamp);
        this.pingMs.set(roundTripTime);
      }
    });

    this.socket.on('worldStateSnapshot', (snapshot: WorldStateSnapshot) => {
      if (!snapshot) return;

      this.serverTick.set(snapshot.tick);
      this.latestSnapshot.set(snapshot);

      if (snapshot.match) {
        this.currentMatch.set(snapshot.match);
        for (const listener of this.matchListeners) {
          listener(snapshot.match);
        }
      }

      for (const listener of this.snapshotListeners) {
        listener(snapshot);
      }
    });

    this.socket.on('matchStateSnapshot', (match: MatchStateSnapshot) => {
      if (!match) return;
      this.currentMatch.set(match);
      for (const listener of this.matchListeners) {
        listener(match);
      }
    });
  }
}
