# Notas do Projeto - Brick Survivors: Overdrive

**Data de Início:** Outubro de 2026  
**Status Geral:** Fases 1, 2, 3, 4 e 5 Concluídas com Sucesso | Pronto para Fase 6  
**Orquestrador:** Maestro (Agente Principal)

---

## 1. Visão Geral da Fase 1 (Concluída)

A **Fase 1: Fundação do Monorepo, Infraestrutura e Agentes** foi concluída com 100% de conformidade com as diretrizes de engenharia de software e arquitetura do projeto.

### Entregas Realizadas:
1. **Infraestrutura e Contêineres:**
   - Orquestração via Docker Compose com PostgreSQL 16 Alpine exposto na porta externa `5433` (mapeada para `5432` interna).
   - Volumes persistentes nomeados (`brick_survivors_postgres_data`) e healthchecks configurados.
2. **Back-End (NestJS 12):**
   - Configurado em `back-workspace/` com TypeORM e driver `pg`.
   - Migrations TypeORM com prefixo em milissegundos (`Date.now()`, 13 dígitos).
   - Testes unitários com Vitest e linter com oxlint.
3. **Front-End (Angular 22):**
   - Configurado em `Front-Workspace/` com Standalone Components, Vitest e jsdom.
4. **Diretrizes e Skills de Agentes:**
   - 5 Skills ativas em `.agents/skills/` (`clean-code`, `backend-architecture`, `frontend-architecture`, `qa-testing`, `game-architecture`).

---

## 2. Visão Geral da Fase 2 (Concluída)

A **Fase 2: Cena 3D Local no Front-End (Three.js & Viewport)** foi totalmente entregue e auditada:
- Instalação de `three` e `@types/three` no `Front-Workspace/`.
- Criação do Dumb Component `GameViewportComponent` com WebGLRenderer responsivo via `ResizeObserver`.
- Arena estilo blocos de montar com textura procedural de studs, grid e iluminação com sombras projetadas.
- Herói provisório em blocos estilizados e câmera orbital em terceira pessoa.
- Suíte de 8 testes passando no Vitest e compilação de produção com código 0.

---

## 3. Visão Geral da Fase 3 (Concluída com Sucesso)

A **Fase 3: Movimentação, Física Arcade e Controle de Veículos** foi entregue pelo Especialista de Front-End e homologada com louvor pelo Especialista de QA:

### Entregas Realizadas:
1. **Motor ECS Isomórfico e Desacoplado de Three.js (`Front-Workspace/src/app/core/engine/`):**
   - **`types.ts`**: Componentes puros (`TransformComponent`, `VelocityComponent`, `InputState`, `VehicleComponent`, `CharacterControllerComponent`).
   - **`game-loop.ts`**: GameLoop determinístico com Fixed Timestep em 60Hz (`fixedDeltaTime = 1 / 60` ≈ 16.66ms), acumulador de tempo, proteção contra espiral de morte (`frameTime <= 0.25s`) e cálculo de `interpolationAlpha`.
   - **`movement.system.ts`**: Movimentação fluida do pedestre em 8 direções com aceleração/desaceleração gradual, rotação suave na direção da marcha e colisão elástica com as muretas da arena.
   - **`vehicle.system.ts`**: Física veicular arcade com tração linear, aceleração progressiva, desaceleração por atrito/arrasto, frenagem vigorosa, marcha ré com velocidade controlada e freio de mão (`Space`) ativando estado de *drift* lateral com deslizamento controlado e ganho de rotação angular.
   - **`interaction.system.ts`**: Sistema de detecção de proximidade (raio de 2.8m). Tecla `E` realiza o embarque no buggy (o herói é ancorado no banco do condutor e os comandos guiam o veículo) ou desembarque lateral do pedestre.
   - **`game-world.ts`**: Orquestrador ECS que integra entidades, componentes, sistemas e temporalidade.

2. **Apresentação e Viewport 3D (`GameViewportComponent`):**
   - **Buggy Arcade de Blocos 3D**: Chassi volumoso em amarelo automotivo e preto fosco, 4 rodas grandes em cilindros com calotas coloridas, santantônio reforçado em barras tubulares, assento de corrida e faróis com reflexo especular.
   - **Câmera em Terceira Pessoa Dinâmica**: Acompanha o pedestre suavemente a ~7.5m e transiciona dinamicamente para ~10.5m com ângulo polar adaptado e ampliação do campo de visão ao pilotar o veículo.
   - **HUD Arcade Reativo**: Sinais públicos (`isDriving`, `speedKmh`, `speedPercentage`, `isDrifting`, `canInteract`), velocímetro esportivo digital com barra de progresso, badge de modo ("MODO: A PÉ" vs "PILOTANDO BUGGY") e banner de DRIFT ativado em tempo real.
   - **Controles de Teclado**: WASD / Setas para movimentação/direção, Espaço para Drift / Freio de mão e E para interação.

3. **Auditoria de Qualidade e Testes Automatizados (QA):**
   - **Suíte de Testes:** **43 testes unitários aprovados (100% de sucesso em 7 suítes com Vitest)**:
     - `vehicle.system.spec.ts` (7 testes): aceleração, freio, marcha ré, drift com freio de mão, desaceleração por arrasto e colisão com bordas da arena.
     - `movement.system.spec.ts` (12 testes): locomoção arcade no plano visual, rotação suave com A/D, recuo/marcha ré com S, giro no próprio eixo, desaceleração, física vertical de pulo com `Espaço`, gravidade contínua, bloqueio de salto duplo e confinamento na arena.
     - `interaction.system.spec.ts` (4 testes): embarque, desembarque, validação de distância e bloqueio sem proximidade.
     - `game-world.spec.ts` (5 testes): integração do mundo ECS e atualização síncrona.
     - `game-loop.spec.ts` (5 testes): fixed timestep de 60Hz e acumulador.
     - `game-viewport.component.spec.ts` (7 testes): rendering, HUD reativo, mapeamento completo de teclas (W, A, S, D, ArrowRight, Espaço a pé e pilotando, E) e ciclo de vida.
     - `app.spec.ts` (3 testes): estrutura e montagem da aplicação.
   - **Refinamentos Pré-Fase 4 (Câmera, Pulo e Controles):**
     - **Câmera Rebaixada em 3ª Pessoa:** Ângulo polar rebaixado ($\phi \approx \pi / 2.55 \approx 70.6^\circ$) com altura de foco `lookAtY = 1.05m` a pé e `0.85m` pilotando, proporcionando visual imersivo arcade e eliminando a sensação aérea excessiva.
     - **Mecânica de Pulo Vertical com [Espaço]:** Herói a pé salta verticalmente com impulso de $7.2\text{ m/s}$ e gravidade de $18.0\text{ m/s}^2$, com aterrissagem estável em $y = 0$ e bloqueio de pulo duplo no ar (pilotando o veículo, o [Espaço] mantém o freio de mão/drift).
     - **Correção da Tecla D (Virar para a Direita):** Restaurado o evento `KeyD` / `ArrowRight` no método `onKeyDown` de `GameViewportComponent` com cobertura de asserções em testes unitários.
   - **Build de Produção:** `ng build` concluído com sucesso e código de saída 0.
   - **Conformidade Clean Code:** Zero uso de `any`, estrita separação entre simulação matemática e renderizador Three.js, e descarte total de recursos no `ngOnDestroy`.

---

## 4. Visão Geral da Fase 4 (Concluída com Sucesso)

A **Fase 4: Sistema Modular de Blocos e Destruição Estilo Lego** foi concluída pelo Especialista de Front-End & Game Architecture e homologada pelo Especialista de QA:

### Entregas Realizadas:
1. **Camada ECS Isomórfica e Pura (`Front-Workspace/src/app/core/engine/`):**
   - **`object-pool.ts`**: Implementação genérica pura de `ObjectPool<T>` com alocação prévia, aquisição (`acquire`) e liberação (`release`) com função de reset, garantindo zero alocação dinâmica contínua e sem picos de Garbage Collection (GC spikes).
   - **`modular-block.types.ts`**: Estruturas de dados de blocos modulares (`ModularBlock`), veículo modular (`ModularVehicleComponent` com cálculo de durabilidade %) e partículas de detritos (`DebrisParticle`).
   - **`modular-block.system.ts`**:
     - Montagem dos 7 blocos estruturais do Buggy (para-choque dianteiro, painéis laterais de blindagem, aerofólio traseiro, santantônio).
     - Aplicação de dano individual por bloco e cálculo dinâmico da integridade da lataria (0 a 100%).
     - Desprendimento balístico sob impacto com conversão em detrito solto, rotação angular e física de quique amortecido no solo de studs.
   - **`game-world.ts`**: Integração do veículo modular e pool de detritos no fixed update (60Hz), com detecção de impactos de alta velocidade contra as muretas da arena e método `forceDetachNextBlock()` para testes.

2. **Apresentação e Viewport 3D (`GameViewportComponent`):**
   - Mapeamento e renderização dos blocos modulares no Buggy.
   - Ocultação imediata dos blocos desprendidos na lataria e ativação das malhas de detritos voando e quicando na arena.
   - Tecla de teste `KeyK` para forçar o desprendimento progressivo de blocos para demonstração em tempo real.
   - Card esportivo de BLINDAGEM no HUD exibindo a porcentagem restante de blocos intactos.

3. **Auditoria de Qualidade e Testes Automatizados (QA):**
   - **Suíte de Testes:** **56 testes unitários aprovados (100% de sucesso em 9 suítes com Vitest)**:
     - `modular-block.system.spec.ts` (5 testes): montagem do buggy, dano, desprendimento e integridade percentual.
     - `object-pool.spec.ts` (6 testes): pré-alocação, acquire, release, reset e reuso de instâncias.
     - `vehicle.system.spec.ts` (7 testes)
     - `movement.system.spec.ts` (12 testes)
     - `interaction.system.spec.ts` (4 testes)
     - `game-world.spec.ts` (7 testes)
     - `game-loop.spec.ts` (5 testes)
     - `game-viewport.component.spec.ts` (7 testes)
     - `app.spec.ts` (3 testes)
   - **Build de Produção:** `ng build` concluído com sucesso e código de saída 0.
   - **Conformidade Clean Code:** Zero `any`, total desacoplamento da camada ECS em relação ao Three.js e descarte seguro de recursos.

---

## 5. Visão Geral da Fase 5 (Concluída com Sucesso)

A **Fase 5: Netcode Autoritativo (NestJS Socket.IO, Predição & Reconciliação)** foi implementada pelos Especialistas de Back-End e Front-End e auditada com 100% de aprovação pelo Especialista de QA:

### Entregas Realizadas:
1. **Back-End Autoritativo (`back-workspace/src/modules/game/`):**
   - **`GameGateway`**: Gateway WebSocket baseado em Socket.IO com CORS habilitado, gerenciamento de conexões/desconexões, tratamento de eventos (`joinGame`, `playerInput`, `ping`/`pong`).
   - **`GameRoomService`**: Motor autoritativo rodando em tick rate de 20Hz (50ms). Simulação física determinística isomórfica de pedestres e veículos arcade, validação de limites de arena ([-19, 19]), embarque/desembarque sincronizado e descarte seguro de recursos via `OnModuleDestroy`.
   - **DTOs com Validação Estrita**: `PlayerInputDto`, `JoinGameDto`, `WorldStateSnapshotDto`, com suporte a confirmação sequencial de comandos por cliente (`ackInputs`).
   - **Heartbeat & Latência**: Resposta imediata a eventos `ping` emitindo `pong` com timestamp do cliente e servidor para cálculo do RTT no cliente.
   - **Testes Unitários:** 27 testes aprovados (100% de sucesso em 3 suítes com Vitest).

2. **Front-End Reativo e Predição no Cliente (`Front-Workspace/src/app/core/`):**
   - **`NetworkService` (`core/network/`):** Serviço reativo Angular com sinais públicos para o HUD (`isConnected`, `pingMs`, `serverTick`, `localPlayerId`, `latestSnapshot`), conexão assíncrona com fallback de SSR (`isPlatformBrowser`), envio de comandos sequenciais (`sequenceNumber`) e medição de ping com heartbeat periódico.
   - **Client-Side Prediction & Server Reconciliation (`game-world.ts`):** Buffer de comandos locais pendentes executados imediatamente a 60 FPS locais. Ao receber o snapshot autoritativo de 20Hz do servidor, reconcilia e remove inputs com `seq <= ackInputs[localPlayerId]`; se a divergência espacial exceder o limiar de 0.25m, aplica snap corretivo suave e reexecuta (*replay*) os inputs locais pendentes.
   - **Interpolação de Entidades Remotas (`game-viewport.component.ts`):** Criação e sincronização dinâmica de heróis remotos estilo Lego em tom ciano brilhante, com interpolação linear suave (`Lerp` a 15.0/s) entre snapshots de 20Hz para eliminar qualquer engasgo visual ou teletransporte.
   - **HUD Multiplayer Reativo:** Badge dinâmico no topo esquerdo da viewport (`🟢 ONLINE` com latência em tempo real `Ping: Xms` / `🔴 OFFLINE` quando desconectado).
   - **Testes Unitários:** 79 testes aprovados (100% de sucesso em 10 suítes com Vitest).

3. **Auditoria de Qualidade e Homologação (QA):**
   - **Total de Testes Automatizados no Monorepo:** **106 testes aprovados (100% de aprovação)**:
     - Back-end: 27 testes passando.
     - Front-end: 79 testes passando.
   - **Builds de Produção:** `nest build` (código 0) e `ng build` (código 0, zero warnings de budget).
   - **Tipagem Estrita:** 0 ocorrências de `any` em todo o código-fonte.
   - **Gestão de Memória:** Cancelamento explícito de subscrições, descarte de geometrias/materiais Three.js dos jogadores remotos no `ngOnDestroy` e parada do loop no `OnModuleDestroy`.

---

## 6. Visão Geral da Fase 6 (Concluída com Sucesso)

A **Fase 6: Sistema de Combate, Armas Fictícias e Object Pooling** foi implementada pelos Especialistas de Back-End e Front-End e auditada com 100% de aprovação pelo Especialista de QA:

### Entregas Realizadas:
1. **Back-End Autoritativo (`back-workspace/src/modules/game/`):**
   - **`combat.interface.ts` (`interfaces/`):** Tipos fortemente tipados para `WeaponType` (`stud_blaster`, `scatter_shot`, `spring_mine`), `WeaponConfig`, `ActiveProjectile`, `DamageEvent`, `PlayerShootPayload` e catálogo estático `WEAPON_CATALOG`.
   - **`SpatialHashGrid` (`utils/spatial-hash-grid.ts`):** Particionamento espacial Broad-Phase $O(1)$ com células de 8.0m para descarte veloz de testes de proximidade na arena sem overhead computacional.
   - **`CombatService` (`services/combat.service.ts`):** Motor autoritativo de combate: validação de cooldown por jogador e arma (anti-cheat), avanço determinístico de trajetórias a 20Hz, Narrow-Phase com teste de raio/esfera contra pedestres e blocos dos veículos, knockback arcade e ejeção de peças de carros avariados.
   - **`GameGateway` & DTOs:** Novo evento WebSocket `@SubscribeMessage('playerShoot')`, validação com `PlayerShootDto` e enriquecimento do `WorldStateSnapshot` com projéteis ativos e eventos de dano com posições espaciais.
   - **Testes Unitários:** 49 testes aprovados (100% de sucesso em 5 suítes com Vitest).

2. **Front-End e Apresentação 3D (`Front-Workspace/src/app/`):**
   - **Contratos e Interfaces (`interfaces/combat.interface.ts`):** Interfaces e tipos isolados em pasta dedicada com zero interfaces inline.
   - **Broad-Phase e Combate no Engine ECS (`core/engine/`):** `spatial-hash-grid.ts` e `combat.system.ts` desacoplados de Three.js com `ObjectPool<ProjectileEntity>` para reciclagem de projéteis de pinos, dispersores e minas terrestres.
   - **Predição de Disparo no `GameWorld`:** Disparo imediato com resposta tátil instantânea no cliente e sincronização pelo `NetworkService.shoot()`.
   - **Three.js & Floating Combat Text (`GameViewportComponent`):** Malhas recicladas de projéteis luminosos e sistema de dano flutuante 3D->2D projetado com animação de subida e fade out (`-15`, `-8`, `💥 BOOM! -50`).
   - **Controles e HUD Arcade:** Disparo via tecla `J` ou clique do mouse, troca rápida de armas nas teclas `1`, `2` e `3`, e card de arma equipada com medidor de cooldown animado em tempo real.
   - **Testes Unitários:** 97 testes aprovados (100% de sucesso em 12 suítes com Vitest).

3. **Auditoria de Qualidade e Homologação (QA):**
   - **Total de Testes Automatizados no Monorepo:** **146 testes aprovados (100% de aprovação)**:
     - Back-end: 49 testes passando.
     - Front-end: 97 testes passando.
   - **Builds de Produção:** `nest build` (código 0) e `ng build` (código 0, bundle otimizado de 859.70 kB / 196.56 kB gzipped).
   - **Tipagem Estrita & Governança:** 0 ocorrências de `any` e 100% das interfaces em pastas dedicadas (`interfaces/` ou `types/`).
   - **Gestão de Memória:** Zero GC spikes com `ObjectPool` para projéteis e reciclagem de malhas e elementos DOM.

---

---

## 7. Melhorias de Física, Animações Procedurais, Armas e Iconify (Homologado)

Em resposta às demandas de física e fidelidade visual, foram implementadas as seguintes melhorias técnicas em todo o monorepo:

### 1. Física no Carro (Colisão Sólida Pedestre vs Veículo):
- **Back-End Autoritativo (`game-room.service.ts`):**
  - Implementado `resolvePedestrianVehicleCollision` utilizando caixas orientadas no espaço local do veículo (**Oriented Bounding Box - OBB**).
  - Projeção imediata de afastamento (*push-out*) na normal mínima quando o pedestre toca ou tenta penetrar a lataria do carro.
  - Decomposição vetorial com anulação da velocidade em direção ao centro do carro, permitindo que o pedestre deslize suavemente pela lateral sem nunca atravessar a lataria.
  - Constantes de colisão fortemente tipadas em `interfaces/game-room.interface.ts` (`VEHICLE_COLLISION_CONFIG` e `HERO_COLLISION_CONFIG`).
  - 6 novos testes unitários adicionados no backend cobrindo colisões frontal, lateral, spawn interno, deslizamento e rotações a 90°.
- **Front-End no Motor ECS (`movement.system.ts` & `game-world.ts`):**
  - Mesma resolução de colisão sólida $O(1)$ executada a 60 FPS na predição do cliente, garantindo sensação tátil sólida e zero divergência com os snapshots do servidor.

### 2. Armas Visíveis na Mão do Personagem:
- No modelo Three.js do herói de blocos (`game-viewport.component.ts`), criado socket de acoplamento tridimensional na mão direita (`rightHandWeaponSocket`).
- 3 modelos detalhados em blocos montados dinamicamente na mão do herói:
  - **Stud Blaster:** Pistola compacta de blocos com cano cilíndrico e stud frontal translúcido luminoso.
  - **Block Scatter Shot:** Espingarda volumosa de blocos com câmara alargada e 3 canos em leque.
  - **Spring Mine:** Mina disco com mola prateada e sensor luminoso segurada na mão antes do plantio.
- Alternância imediata da arma na mão ao pressionar as teclas `[1]`, `[2]` e `[3]`.

### 3. Animações Procedurais Fluidas a 60 FPS:
- Estruturação do herói em pivôs articulados: `leftLegPivot`, `rightLegPivot` (quadris), `leftArmPivot` e `rightArmPivot` (ombros).
- **Caminhada (Walk Cycle):** Balanço angular senoidal das pernas e braços proporcional à velocidade e tempo de deslocamento; postura ereta natural em repouso.
- **Pulo (Jump):** Flexão suave das pernas para trás e elevação compensatória dos braços no ar enquanto `!isGrounded`.
- **Disparo com Recuo (Recoil):** Elevação da arma na linha de visão com impulso de coice para trás e recuperação ágil a cada tiro disparado.
- **Retículo de Mira Central (Crosshair):** Mira de combate reativa no centro da tela com anel e ponto focal, efeito de expansão (*bloom/recoil*) ao atirar e cores temáticas por arma (amarelo para Blaster, ciano para Scatter e vermelho para Mina).

### 4. Ícones Modernos com Iconify:
- Instalação e integração do web component oficial `iconify-icon` com suporte a `CUSTOM_ELEMENTS_SCHEMA` no Angular 22.
- HUD inteiramente modernizado com ícones vetoriais elegantes e nítidos:
  - Armas: `mdi:pistol`, `mdi:grain`, `mdi:disc`.
  - Rede e Conexão: `mdi:wifi`, `mdi:wifi-off`.
  - Painel do Veículo: `mdi:speedometer`, `mdi:shield-car`, `mdi:heart-pulse`.
  - Controles e Dicas: `mdi:keyboard`, `mdi:mouse-left-click`, `mdi:car-key`.

---

## 8. Estrutura Atual de Pastas

```text
GDD-Brick-Survivors-Overdrive/
├── .agents/
│   └── skills/
│       ├── backend-architecture/
│       ├── clean-code/
│       ├── frontend-architecture/
│       ├── game-architecture/
│       └── qa-testing/
├── back-workspace/               # Aplicação NestJS 12 + TypeORM + Socket.IO + Vitest
│   ├── src/
│   │   ├── modules/
│   │   │   └── game/             # Módulo Multiplayer Autoritativo e Combate
│   │   │       ├── dto/          # DTOs de input, shoot e snapshots
│   │   │       ├── interfaces/   # Interfaces dedicadas (combat, gateway, room, snapshot)
│   │   │       ├── gateways/     # GameGateway (WebSocket)
│   │   │       ├── services/     # GameRoomService (Loop 20Hz, OBB collision) e CombatService
│   │   │       └── utils/        # SpatialHashGrid (Broad-Phase)
├── Front-Workspace/              # Aplicação Angular 22 Standalone + Three.js + Iconify + Vitest
│   ├── src/
│   │   ├── app/
│   │   │   ├── core/
│   │   │   │   ├── engine/       # Motor ECS Puro (Isomórfico & Desacoplado de Three.js)
│   │   │   │   │   ├── interfaces/ # Interfaces dedicadas de combate e dados
│   │   │   │   │   ├── types.ts & modular-block.types.ts
│   │   │   │   │   ├── object-pool.ts
│   │   │   │   │   ├── spatial-hash-grid.ts
│   │   │   │   │   ├── combat.system.ts
│   │   │   │   │   ├── modular-block.system.ts
│   │   │   │   │   ├── game-loop.ts
│   │   │   │   │   ├── game-world.ts
│   │   │   │   │   ├── movement.system.ts
│   │   │   │   │   ├── vehicle.system.ts
│   │   │   │   │   └── interaction.system.ts
│   │   │   │   └── network/      # Serviço de Rede e Conexão Socket.IO
│   │   │   │       ├── network.service.ts
│   │   │   │       └── types/
│   │   │   ├── components/
│   │   │   │   └── game-viewport/# Viewport Three.js + Armas na Mão + Animações + Crosshair + HUD Iconify
│   │   │   ├── app.component.html
│   │   │   ├── app.component.ts
│   │   │   └── app.component.spec.ts
│   │   └── main.ts
│   └── package.json
├── docs/                         # Documentação técnica e operacional
│   ├── NOTAS-DO-PROJETO.md
│   ├── ROADMAP.md
│   ├── architecture.md
│   └── DECISOES-TECNICAS.md
├── docker-compose.yml
├── AGENTS.md
└── package.json
```

---

## 9. Comandos para Execução e Testes Locais

```bash
# Executar suíte completa de testes no monorepo (160 testes aprovados)
npm run test:backend     # 55 testes passando no NestJS (Vitest)
npm run test:frontend    # 105 testes passando no Angular (Vitest)

# Compilações de produção
npm run build:backend    # NestJS build (código 0)
npm run build:frontend   # Angular build (código 0)

# Servidores de desenvolvimento
npm run start:backend    # NestJS watch mode (WebSocket na porta 3000)
npm run start:frontend   # Angular dev server (porta 4200)
```
