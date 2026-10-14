---
name: game-architecture
description: >-
  Guides game development architecture for 3D arcade multiplayer browser games,
  covering Entity Component System (ECS), authoritative game loops, client prediction,
  server reconciliation, spatial partitioning, object pooling, and real-time netcode.
---

# Arquitetura e Padrões de Game Development

Este guia estabelece os padrões e práticas de arquitetura de jogos para o **Brick Survivors Overdrive** (jogo 3D arcade multiplayer em terceira pessoa com estética de blocos, veículos, armas e modos cooperativo e competitivo).

---

## 1. Princípios Arquiteturais Centrais

### 1.1 Composição sobre Herança (Entity Component System - ECS)
Evite hierarquias rígidas de classes (como `GameObject -> Actor -> Pawn -> Player`). Em vez disso, desacople estado e comportamento:

- **Entities (Entidades)**: Identificadores numéricos simples (`entityId: number` ou `string`).
- **Components (Componentes)**: Estruturas de dados puras, sem lógica de negócio:
  ```typescript
  export interface TransformComponent {
    x: number;
    y: number;
    z: number;
    rotationY: number;
  }

  export interface HealthComponent {
    current: number;
    max: number;
    invulnerabilityTime: number;
  }

  export interface VehicleComponent {
    acceleration: number;
    maxSpeed: number;
    steeringAngle: number;
    driverEntityId: number | null;
  }
  ```
- **Systems (Sistemas)**: Lógica pura iterando apenas sobre entidades que possuem o conjunto necessário de componentes:
  - `MovementSystem`: atualiza posições baseado em velocidade e input.
  - `CollisionSystem`: detecta e resolve colisões via Broad-Phase e Narrow-Phase.
  - `CombatSystem`: processa projéteis, dano em área e durabilidade de blocos.
  - `NetworkSyncSystem`: serializa estados alterados para envio aos clientes.

### 1.2 Separação Rígida entre Simulação e Renderização
- **Camada de Simulação (Game Engine / World)**: Agnóstica a WebGL/Three.js/Canvas. Pode rodar no servidor (Node.js/NestJS) ou no cliente com o mesmo código matemático.
- **Camada de Apresentação (View / Renderer)**: Responsável exclusivamente por instanciar malhas 3D, câmeras, áudio espacial, partículas e shaders, reagindo a eventos e estados da simulação.

---

## 2. Game Loop e Temporalidade (Time Stepping)

### 2.1 Fixed Timestep para Física e Lógica
O estado do jogo nunca deve depender da taxa de quadros (FPS) da tela. Use sempre um passo de tempo fixo para a simulação:

```typescript
export class GameLoop {
  private readonly fixedDeltaTime = 1 / 60; // 60 ticks por segundo (16.66ms)
  private accumulator = 0;
  private lastTime = 0;

  public update(currentTime: number): void {
    if (this.lastTime === 0) {
      this.lastTime = currentTime;
      return;
    }

    const frameTime = Math.min((currentTime - this.lastTime) / 1000, 0.25); // Evita "spiral of death"
    this.lastTime = currentTime;
    this.accumulator += frameTime;

    while (this.accumulator >= this.fixedDeltaTime) {
      this.physicsTick(this.fixedDeltaTime);
      this.accumulator -= this.fixedDeltaTime;
    }

    const interpolationAlpha = this.accumulator / this.fixedDeltaTime;
    this.render(interpolationAlpha);
  }

  private physicsTick(dt: number): void {
    // Atualização determinística de sistemas de física e lógica
  }

  private render(alpha: number): void {
    // Interpolação visual suave entre o estado anterior e o estado atual
  }
}
```

---

## 3. Arquitetura Multiplayer e Rede (Netcode Autoritativo)

### 3.1 Modelo Cliente-Servidor Autoritativo
O servidor (NestJS Gateway / Game Room) é a autoridade absoluta sobre o estado da partida:
1. **O cliente envia inputs**: Apenas intenções (`keysPressed`, `aimDirection`, `inputSequenceNumber`).
2. **O servidor valida e simula**: Verifica se o movimento é válido, se há munição, se a habilidade está fora de cooldown, e calcula o dano e colisão.
3. **O servidor transmite snapshots**: Envia o estado consolidado da sala para os clientes em intervalos regulares (tick rate de 20 a 30Hz).

### 3.2 Client-Side Prediction e Server Reconciliation
Para eliminar a sensação de latência no jogador local:
- O cliente aplica imediatamente o input ao seu próprio personagem local.
- O cliente mantém uma fila de inputs enviados ainda não confirmados pelo servidor.
- Ao receber o snapshot do servidor com a posição confirmada do tick `N`, o cliente:
  1. Descarta inputs confirmados (`<= N`).
  2. Compara a posição simulada com a do servidor. Se houver divergência relevante, corrige a posição para o estado do servidor e reaplica os inputs pendentes (*reconciliation*).

### 3.3 Interpolação de Entidades Remotas
- Entidades controladas por outros jogadores, veículos ou inimigos não devem se mover aos saltos.
- O cliente mantém um buffer de snapshots e renderiza as entidades remotas interpolando suavemente (`lerp` / `slerp`) entre dois snapshots passados (atraso de interpolação fixo de ~50ms a 100ms).

---

## 4. Otimização de Performance e Memória

### 4.1 Object Pooling (Evite Garbage Collection)
No navegador, o Garbage Collector (GC) causa engasgos (*stutters*) fatais em jogos 3D. **Nunca instancie ou destrua objetos em alta frequência durante a partida**:
- Crie piscinas de objetos (*Object Pools*) para:
  - Projéteis e lasers
  - Partículas e detritos de blocos
  - Textos de dano flutuante (floating combat text)
  - Inimigos da horda (waves de sobrevivência)
- Exemplo de padrão Pool:
  ```typescript
  export class ObjectPool<T> {
    private readonly pool: T[] = [];

    constructor(
      private readonly factory: () => T,
      private readonly reset: (item: T) => void,
      initialSize: number,
    ) {
      for (let i = 0; i < initialSize; i++) {
        this.pool.push(this.factory());
      }
    }

    public acquire(): T {
      return this.pool.pop() ?? this.factory();
    }

    public release(item: T): void {
      this.reset(item);
      this.pool.push(item);
    }
  }
  ```

### 4.2 Particionamento Espacial (Spatial Partitioning)
Com centenas de blocos, projéteis e inimigos na tela, verificações de colisão O(N²) são inviáveis:
- Utilize **Spatial Hash Grid (Grade Espacial)** ou **Quadtree/Octree** para limitar testes de colisão apenas a entidades no mesmo quadrante.
- Divida o mapa em células uniformes (ex: 10m x 10m). Atualize o registro das entidades na grade somente quando mudarem de célula.

### 4.3 Instanced Mesh Rendering para Blocos
- Renderizar cada bloco desmontável como um `Mesh` individual esgota o limite de *Draw Calls* da GPU.
- Utilize **InstancedMesh** (Three.js/WebGL): uma única Draw Call renderiza milhares de blocos idênticos, variando apenas suas matrizes de transformação e cores via buffer de atributos.

---

## 5. Máquinas de Estado Finitas (FSM / HFSM)

### 5.1 Fluxo Global do Jogo
O ciclo de vida de uma partida deve ser gerenciado por uma FSM estrita:
- `Boot` -> `MainMenu` -> `Matchmaking` -> `Lobby` -> `Loading` -> `InGame` -> `GameOver` / `Victory` -> `PostMatch`
- Estados específicos de InGame no modo sobrevivência:
  - `WaveActive`: hordas spawnando, contagem regressiva ativa.
  - `WaveBreak`: pausa para escolha de upgrades/melhorias estilo roguelite.
  - `BossEncounter`: surgimento de chefão com barra de vida global.

### 5.2 Estados de Entidades e Veículos
- Personagem: `Idle`, `Running`, `Jumping`, `Driving`, `Stunned`, `Dead`.
- Veículo: `Empty`, `Occupied`, `Accelerating`, `Braking`, `Drifting`, `Destroyed`.
- Armas: `Ready`, `Firing`, `Cooldown`, `Reloading`, `Overheated`.

---

## 6. Sistema Modular de Veículos e Blocos Desmontáveis

1. **Estrutura Modular de Peças**:
   - Chassi base com pontos de ancoragem (*sockets*).
   - Peças anexáveis (rodas, motores, blindagens de blocos, torres de tiro).
2. **Desprendimento de Blocos por Dano**:
   - Quando a vida de um bloco específico zera, ele se desvincula da entidade pai.
   - Aplica-se impulso físico instantâneo (explosão/queda) e o bloco é reciclado via Pool de detritos.
3. **Física Arcade de Veículos**:
   - Utilize modelo simplificado tipo Raycast Vehicle ou arcade steering (força de tração, arrasto aerodinâmico, atrito lateral e derrapagem controlada), priorizando resposta imediata e diversão arcade sobre simulação realista ultra-pesada.

---

## 7. Checklist de Qualidade em Arquitetura de Jogos

Antes de commitar qualquer funcionalidade de gameplay:
- [ ] A lógica de física e colisão é determinística e baseada em `fixedDeltaTime`?
- [ ] O código de simulação está desacoplado de dependências visuais/renderizador?
- [ ] Projéteis, detritos e inimigos utilizam Object Pooling (zero alocação contínua no loop)?
- [ ] Entidades remotas utilizam interpolação suave de posição e rotação?
- [ ] O servidor valida inputs e ações críticas (dano, vida, cooldown, pontuação)?
- [ ] As consultas de proximidade e colisão utilizam particionamento espacial?
