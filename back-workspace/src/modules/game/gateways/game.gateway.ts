import { Logger } from '@nestjs/common';
import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  OnGatewayInit,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { ChangeModeDto } from '../dto/change-mode.dto.js';
import { JoinGameDto } from '../dto/join-game.dto.js';
import { PlayerInputDto } from '../dto/player-input.dto.js';
import { PlayerShootDto } from '../dto/player-shoot.dto.js';
import { ReadyMatchDto } from '../dto/ready-match.dto.js';
import { SelectUpgradeDto } from '../dto/select-upgrade.dto.js';
import { GameRoomService } from '../services/game-room.service.js';
import type {
  JoinGameResponse,
  MatchStateSnapshot,
  PingPayload,
  PongResponse,
  ShootResult,
} from '../interfaces/index.js';

export type {
  JoinGameResponse,
  MatchStateSnapshot,
  PingPayload,
  PongResponse,
  ShootResult,
};

@WebSocketGateway({
  cors: {
    origin: '*',
    methods: ['GET', 'POST'],
    credentials: true,
  },
})
export class GameGateway implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(GameGateway.name);

  constructor(private readonly gameRoomService: GameRoomService) {}

  afterInit(server: Server): void {
    this.server = server;
    this.logger.log('GameGateway initialized with WebSocketServer');
    this.gameRoomService.setServer(server);
  }

  handleConnection(client: Socket): void {
    this.logger.log(`Client connected: ${client.id}`);
  }

  handleDisconnect(client: Socket): void {
    this.logger.log(`Client disconnected: ${client.id}`);
    this.gameRoomService.removePlayer(client.id);
  }

  @SubscribeMessage('joinGame')
  async handleJoinGame(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload?: JoinGameDto,
  ): Promise<JoinGameResponse> {
    await client.join('game-room');
    const requestedName = payload?.playerName ?? payload?.name;
    const player = this.gameRoomService.addPlayer(client.id, requestedName);

    this.logger.log(`Player registered: ${player.name} (${client.id})`);
    return {
      status: 'ok',
      playerId: client.id,
      name: player.name,
      tick: this.gameRoomService.getCurrentTick(),
    };
  }

  @SubscribeMessage('playerInput')
  handlePlayerInput(
    @ConnectedSocket() client: Socket,
    @MessageBody() input: PlayerInputDto,
  ): void {
    this.gameRoomService.enqueueInput(client.id, input);
  }

  @SubscribeMessage('playerShoot')
  handlePlayerShoot(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: PlayerShootDto,
  ): ShootResult {
    return this.gameRoomService.handlePlayerShoot(client.id, payload);
  }

  @SubscribeMessage('ping')
  handlePing(
    @ConnectedSocket() client: Socket,
    @MessageBody() data?: PingPayload,
  ): PongResponse {
    const clientTimestamp = data?.clientTimestamp ?? data?.timestamp ?? Date.now();
    const serverTimestamp = Date.now();
    const pongResponse: PongResponse = {
      clientTimestamp,
      serverTimestamp,
    };

    client.emit('pong', pongResponse);
    return pongResponse;
  }

  @SubscribeMessage('changeMode')
  handleChangeMode(
    @ConnectedSocket() _client: Socket,
    @MessageBody() dto: ChangeModeDto,
  ): { success: boolean; mode: string } {
    const matchManager = this.gameRoomService.getMatchManagerService();
    const success = matchManager.setMode(dto.mode);
    if (success && this.server) {
      this.server.to('game-room').emit('matchSnapshot', matchManager.getSnapshot());
    }
    return { success, mode: matchManager.getMode() };
  }

  @SubscribeMessage('readyMatch')
  handleReadyMatch(
    @ConnectedSocket() client: Socket,
    @MessageBody() dto: ReadyMatchDto,
  ): { success: boolean; state: string } {
    const matchManager = this.gameRoomService.getMatchManagerService();
    const success = matchManager.setPlayerReady(client.id, dto.ready);
    if (this.server) {
      this.server.to('game-room').emit('matchSnapshot', matchManager.getSnapshot());
    }
    return { success, state: matchManager.getState() };
  }

  @SubscribeMessage('selectUpgrade')
  handleSelectUpgrade(
    @ConnectedSocket() client: Socket,
    @MessageBody() dto: SelectUpgradeDto,
  ): { success: boolean } {
    const player = this.gameRoomService.getPlayer(client.id);
    if (!player) {
      return { success: false };
    }
    const matchManager = this.gameRoomService.getMatchManagerService();
    const success = matchManager.selectUpgrade(client.id, dto.upgradeId, player);
    if (success && this.server) {
      this.server.to('game-room').emit('matchSnapshot', matchManager.getSnapshot());
    }
    return { success };
  }
}
