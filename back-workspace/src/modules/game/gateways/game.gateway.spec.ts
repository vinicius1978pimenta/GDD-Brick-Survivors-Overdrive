import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Server, Socket } from 'socket.io';
import { JoinGameDto } from '../dto/join-game.dto.js';
import { PlayerInputDto } from '../dto/player-input.dto.js';
import { GameGateway } from './game.gateway.js';
import { GameRoomService } from '../services/game-room.service.js';

type MockSocketContext = {
  socket: Socket;
  emitMock: ReturnType<typeof vi.fn>;
  joinMock: ReturnType<typeof vi.fn>;
};

describe('GameGateway', () => {
  let gateway: GameGateway;
  let gameRoomService: GameRoomService;

  beforeEach(() => {
    gameRoomService = new GameRoomService();
    gateway = new GameGateway(gameRoomService);
  });

  function createMockSocketContext(id = 'socket-test-1'): MockSocketContext {
    const emitMock = vi.fn();
    const joinMock = vi.fn().mockResolvedValue(undefined);

    const socket = {
      id,
      emit: emitMock,
      join: joinMock,
    } as unknown as Socket;

    return {
      socket,
      emitMock,
      joinMock,
    };
  }

  function createMockServer(): { serverMock: Server; toSpy: ReturnType<typeof vi.fn> } {
    const toSpy = vi.fn().mockReturnValue({
      emit: vi.fn(),
    });

    const serverMock = {
      to: toSpy,
    } as unknown as Server;

    return { serverMock, toSpy };
  }

  describe('Lifecycle and Initialization', () => {
    it('should initialize gateway and attach server to gameRoomService', () => {
      const { serverMock } = createMockServer();
      const setServerSpy = vi.spyOn(gameRoomService, 'setServer');

      gateway.afterInit(serverMock);

      expect(setServerSpy).toHaveBeenCalledWith(serverMock);
    });

    it('should handle client connection without errors', () => {
      const { socket } = createMockSocketContext('client-1');
      expect(() => gateway.handleConnection(socket)).not.toThrow();
    });

    it('should remove player on client disconnect', () => {
      gameRoomService.addPlayer('client-1', 'Pilot');
      expect(gameRoomService.getPlayerCount()).toBe(1);

      const { socket } = createMockSocketContext('client-1');
      gateway.handleDisconnect(socket);

      expect(gameRoomService.getPlayerCount()).toBe(0);
    });
  });

  describe('joinGame event', () => {
    it('should add player to room and return confirmation payload', async () => {
      const { socket, joinMock } = createMockSocketContext('client-xyz');
      const payload: JoinGameDto = { playerName: 'CommanderBrick' };

      const response = await gateway.handleJoinGame(socket, payload);

      expect(joinMock).toHaveBeenCalledWith('game-room');
      expect(response.status).toBe('ok');
      expect(response.playerId).toBe('client-xyz');
      expect(response.name).toBe('CommanderBrick');
      expect(typeof response.tick).toBe('number');
      expect(gameRoomService.getPlayer('client-xyz')?.name).toBe('CommanderBrick');
    });

    it('should handle joinGame with default name when payload is omitted', async () => {
      const { socket } = createMockSocketContext('socket-auto');

      const response = await gateway.handleJoinGame(socket);

      expect(response.status).toBe('ok');
      expect(response.name).toBe('Hero_sock');
    });

    it('should register and maintain playerName passed in payload when joining', async () => {
      const { socket } = createMockSocketContext('client-named');
      const payload: JoinGameDto = { playerName: 'OverdriveMaster' };

      const response = await gateway.handleJoinGame(socket, payload);

      expect(response.name).toBe('OverdriveMaster');
      expect(gameRoomService.getPlayer('client-named')?.name).toBe('OverdriveMaster');

      const updatedPayload: JoinGameDto = { playerName: 'OverdriveLegend' };
      const updateResponse = await gateway.handleJoinGame(socket, updatedPayload);
      expect(updateResponse.name).toBe('OverdriveLegend');
      expect(gameRoomService.getPlayer('client-named')?.name).toBe('OverdriveLegend');
    });

    it('should register player with selected characterType', async () => {
      const { socket } = createMockSocketContext('client-char');
      const payload: JoinGameDto = {
        playerName: 'BrickHero',
        characterType: 'funny_indigenous',
      };

      const response = await gateway.handleJoinGame(socket, payload);

      expect(response.status).toBe('ok');
      const player = gameRoomService.getPlayer('client-char');
      expect(player?.characterType).toBe('funny_indigenous');
    });
  });

  describe('playerInput event', () => {
    it('should forward player input to gameRoomService queue', () => {
      gameRoomService.addPlayer('client-1', 'Player1');

      const input: PlayerInputDto = {
        seq: 42,
        forward: true,
        backward: false,
        left: false,
        right: false,
        handbrake: false,
        jump: false,
        interact: false,
        dt: 0.05,
        timestamp: 123456789,
      };

      const { socket } = createMockSocketContext('client-1');
      gateway.handlePlayerInput(socket, input);

      const player = gameRoomService.getPlayer('client-1');
      expect(player?.pendingInputs.length).toBe(1);
      expect(player?.pendingInputs[0].seq).toBe(42);
    });
  });

  describe('playerShoot event', () => {
    it('should delegate shoot action to gameRoomService and return result', () => {
      gameRoomService.addPlayer('client-1', 'Sharpshooter');

      const { socket } = createMockSocketContext('client-1');
      const result = gateway.handlePlayerShoot(socket, {
        weaponType: 'stud_blaster',
        origin: { x: 0, y: 1.0, z: 0 },
        direction: { x: 0, y: 0, z: 1 },
        clientTimestamp: Date.now(),
      });

      expect(result.success).toBe(true);
      expect(result.projectilesSpawned).toBe(1);
    });

    it('should return error if unauthenticated/unconnected player shoots', () => {
      const { socket } = createMockSocketContext('ghost-client');
      const result = gateway.handlePlayerShoot(socket, {
        weaponType: 'stud_blaster',
        origin: { x: 0, y: 0, z: 0 },
        direction: { x: 0, y: 0, z: 1 },
        clientTimestamp: Date.now(),
      });

      expect(result.success).toBe(false);
      expect(result.reason).toBe('Player not connected');
    });
  });

  describe('ping and latency measurement', () => {
    it('should respond to ping with pong and timestamps for RTT calculation', () => {
      const { socket, emitMock } = createMockSocketContext('client-1');
      const clientTs = 1700000000000;

      const response = gateway.handlePing(socket, { clientTimestamp: clientTs });

      expect(response.clientTimestamp).toBe(clientTs);
      expect(typeof response.serverTimestamp).toBe('number');
      expect(response.serverTimestamp).toBeGreaterThanOrEqual(clientTs);
      expect(emitMock).toHaveBeenCalledWith('pong', response);
    });

    it('should fallback to Date.now() when clientTimestamp is missing', () => {
      const { socket, emitMock } = createMockSocketContext('client-1');

      const response = gateway.handlePing(socket);

      expect(typeof response.clientTimestamp).toBe('number');
      expect(typeof response.serverTimestamp).toBe('number');
      expect(emitMock).toHaveBeenCalledWith('pong', response);
    });
  });

  describe('Match Mode and Ready Handlers', () => {
    it('should handle changeMode and broadcast matchSnapshot', () => {
      const { serverMock, toSpy } = createMockServer();
      gateway.afterInit(serverMock);

      const { socket } = createMockSocketContext('client-1');
      const response = gateway.handleChangeMode(socket, { mode: 'pvp_deathmatch' });

      expect(response.success).toBe(true);
      expect(response.mode).toBe('pvp_deathmatch');
      expect(toSpy).toHaveBeenCalledWith('game-room');
    });

    it('should handle readyMatch and broadcast matchSnapshot', () => {
      const { serverMock, toSpy } = createMockServer();
      gateway.afterInit(serverMock);

      const { socket } = createMockSocketContext('client-1');
      gameRoomService.addPlayer('client-1', 'Player1');

      const response = gateway.handleReadyMatch(socket, { ready: true });

      expect(response.success).toBe(true);
      expect(toSpy).toHaveBeenCalledWith('game-room');
    });

    it('should handle selectUpgrade when player is connected', () => {
      const { serverMock } = createMockServer();
      gateway.afterInit(serverMock);

      const { socket } = createMockSocketContext('client-1');
      gameRoomService.addPlayer('client-1', 'Player1');

      const response = gateway.handleSelectUpgrade(socket, { upgradeId: 'upg-speed-1' });

      expect(response).toHaveProperty('success');
    });

    it('should reject selectUpgrade for unknown player', () => {
      const { socket } = createMockSocketContext('unknown-client');
      const response = gateway.handleSelectUpgrade(socket, { upgradeId: 'upg-speed-1' });

      expect(response.success).toBe(false);
    });

    it('should handle restartMatch and reset game state', () => {
      const { serverMock, toSpy } = createMockServer();
      gateway.afterInit(serverMock);

      const { socket } = createMockSocketContext('client-1');
      gameRoomService.addPlayer('client-1', 'Player1');

      const response = gateway.handleRestartMatch(socket);

      expect(response.success).toBe(true);
      expect(response.state).toBe('waiting');
      expect(toSpy).toHaveBeenCalledWith('game-room');
    });
  });
});
