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

## 5. Estrutura Atual de Pastas

```text
GDD-Brick-Survivors-Overdrive/
├── .agents/
│   └── skills/
│       ├── backend-architecture/
│       ├── clean-code/
│       ├── frontend-architecture/
│       ├── game-architecture/
│       └── qa-testing/
├── back-workspace/               # Aplicação NestJS + TypeORM + Vitest
├── Front-Workspace/              # Aplicação Angular 22 Standalone + Three.js + Vitest
│   ├── src/
│   │   ├── app/
│   │   │   ├── core/
│   │   │   │   └── engine/       # Motor ECS Puro (Isomórfico & Desacoplado de Three.js)
│   │   │   │       ├── types.ts
│   │   │   │       ├── modular-block.types.ts
│   │   │   │       ├── object-pool.ts
│   │   │   │       ├── modular-block.system.ts
│   │   │   │       ├── game-loop.ts
│   │   │   │       ├── game-world.ts
│   │   │   │       ├── movement.system.ts
│   │   │   │       ├── vehicle.system.ts
│   │   │   │       └── interaction.system.ts
│   │   │   ├── components/
│   │   │   │   └── game-viewport/# Viewport 3D Three.js + HUD Arcade + Inputs
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

## 6. Comandos para Execução e Testes Locais

```bash
# Executar suíte completa de testes no monorepo
npm run test:backend     # 1 teste passando no NestJS
npm run test:frontend    # 56 testes passando no Angular/Vitest

# Compilações de produção
npm run build:backend    # NestJS build
npm run build:frontend   # Angular build

# Servidores de desenvolvimento
npm run start:backend    # NestJS watch mode
npm run start:frontend   # Angular dev server (porta 4200)
```
