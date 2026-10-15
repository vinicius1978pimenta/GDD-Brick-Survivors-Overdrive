import { TestBed } from '@angular/core/testing';
import { NetworkService } from './network.service';
import { Socket } from 'socket.io-client';
import { WorldStateSnapshot, PongResponse, JoinGameResponse } from './network.types';

describe('NetworkService (Socket.IO Real-time Netcode)', () => {
  let service: NetworkService;
  let mockSocket: {
    on: ReturnType<typeof vi.fn>;
    emit: ReturnType<typeof vi.fn>;
    disconnect: ReturnType<typeof vi.fn>;
    id: string;
  };
  let socketCallbacks: Map<string, (...args: unknown[]) => void>;

  beforeEach(() => {
    socketCallbacks = new Map();
    mockSocket = {
      id: 'socket-test-123',
      on: vi.fn((event: string, callback: (...args: unknown[]) => void) => {
        socketCallbacks.set(event, callback);
        return mockSocket;
      }),
      emit: vi.fn(),
      disconnect: vi.fn(),
    };

    TestBed.configureTestingModule({
      providers: [NetworkService],
    });

    service = TestBed.inject(NetworkService);
    service.setSocketForTesting(mockSocket as unknown as Socket);
  });

  afterEach(() => {
    service.disconnect();
  });

  it('deve inicializar com estado desconectado por padrão', () => {
    expect(service.isConnected()).toBe(false);
    expect(service.localPlayerId()).toBeNull();
    expect(service.pingMs()).toBe(0);
    expect(service.serverTick()).toBe(0);
  });

  it('deve atualizar isConnected e localPlayerId quando o evento connect disparar', () => {
    const connectCallback = socketCallbacks.get('connect');
    expect(connectCallback).toBeDefined();

    connectCallback?.();

    expect(service.isConnected()).toBe(true);
    expect(service.localPlayerId()).toBe('socket-test-123');
  });

  it('deve resetar o estado quando o evento disconnect disparar', () => {
    socketCallbacks.get('connect')?.();
    expect(service.isConnected()).toBe(true);

    socketCallbacks.get('disconnect')?.();
    expect(service.isConnected()).toBe(false);
    expect(service.localPlayerId()).toBeNull();
  });

  it('deve enviar playerInput incrementando o número de sequência (seq)', () => {
    socketCallbacks.get('connect')?.();

    const seq1 = service.sendInput({
      forward: true,
      backward: false,
      left: false,
      right: false,
      handbrake: false,
      jump: false,
      interact: false,
      dt: 0.016,
    });

    expect(seq1).toBe(1);
    expect(mockSocket.emit).toHaveBeenCalledWith(
      'playerInput',
      expect.objectContaining({
        seq: 1,
        forward: true,
      }),
    );

    const seq2 = service.sendInput({
      forward: false,
      backward: true,
      left: false,
      right: false,
      handbrake: false,
      jump: false,
      interact: false,
      dt: 0.016,
    });

    expect(seq2).toBe(2);
    expect(mockSocket.emit).toHaveBeenCalledWith(
      'playerInput',
      expect.objectContaining({
        seq: 2,
        backward: true,
      }),
    );
  });

  it('deve calcular ping (RTT) ao receber evento pong com timestamp do cliente', () => {
    const pongCallback = socketCallbacks.get('pong');
    expect(pongCallback).toBeDefined();

    const pastTimestamp = Date.now() - 42;
    const pongData: PongResponse = {
      clientTimestamp: pastTimestamp,
      serverTimestamp: Date.now(),
    };

    pongCallback?.(pongData);

    expect(service.pingMs()).toBeGreaterThanOrEqual(40);
  });

  it('deve processar snapshot do servidor e notificar ouvintes registrados via onSnapshot', () => {
    const snapshotCallback = socketCallbacks.get('worldStateSnapshot');
    expect(snapshotCallback).toBeDefined();

    const mockSnapshot: WorldStateSnapshot = {
      tick: 140,
      timestamp: Date.now(),
      players: [
        {
          id: 'socket-test-123',
          name: 'Hero Player',
          x: 2.5,
          y: 0,
          z: 3.5,
          rotationY: 0,
          speed: 8.0,
          isDriving: false,
          isGrounded: true,
          vehicleId: null,
        },
      ],
      vehicles: [],
      ackInputs: { 'socket-test-123': 15 },
    };

    let receivedSnapshot: WorldStateSnapshot | null = null;
    const unsubscribe = service.onSnapshot((s) => {
      receivedSnapshot = s;
    });

    snapshotCallback?.(mockSnapshot);

    expect(service.serverTick()).toBe(140);
    expect(service.latestSnapshot()).toEqual(mockSnapshot);
    expect(receivedSnapshot).toEqual(mockSnapshot);

    unsubscribe();
  });

  it('deve permitir emitir joinGame com nome do jogador', async () => {
    socketCallbacks.get('connect')?.();

    const joinPromise = service.joinGame('BrickChampion');

    // Simula a resposta de callback do servidor
    const lastEmitCall = mockSocket.emit.mock.calls.find((call) => call[0] === 'joinGame');
    expect(lastEmitCall).toBeDefined();

    const ackFunction = lastEmitCall?.[2] as (response: JoinGameResponse) => void;
    expect(typeof ackFunction).toBe('function');

    ackFunction({
      status: 'ok',
      playerId: 'socket-test-123',
      name: 'BrickChampion',
      tick: 50,
    });

    const result = await joinPromise;
    expect(result).not.toBeNull();
    expect(result?.playerId).toBe('socket-test-123');
    expect(service.serverTick()).toBe(50);
  });
});
