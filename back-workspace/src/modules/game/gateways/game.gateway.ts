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
import { JoinGameDto } from '../dto/join-game.dto.js';
import { PlayerInputDto } from '../dto/player-input.dto.js';
import { PlayerShootDto } from '../dto/player-shoot.dto.js';
import { GameRoomService } from '../services/game-room.service.js';
import type {
  JoinGameResponse,
  PingPayload,
  PongResponse,
  ShootResult,
} from '../interfaces/index.js';

export type { JoinGameResponse, PingPayload, PongResponse, ShootResult };

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
    const player = this.gameRoomService.addPlayer(client.id, payload?.playerName);

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
}
