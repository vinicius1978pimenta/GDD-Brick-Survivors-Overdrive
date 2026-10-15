# Roadmap do Projeto - Brick Survivors: Overdrive

Este documento descreve o plano de desenvolvimento do **Brick Survivors: Overdrive** estruturado em 8 fases incrementais.

---

## Status Geral do Projeto

| Fase | Título | Status | Responsável |
| :--- | :--- | :---: | :--- |
| **Fase 1** | Fundação do Monorepo, Infraestrutura e Agentes | **Concluída** | Orquestrador / Time Base |
| **Fase 2** | Cena 3D Local no Front-End (Three.js & Viewport) | **Concluída** | Especialista Front-End / Engine |
| **Fase 3** | Movimentação, Física Arcade e Controle de Veículos | **Concluída** | Especialista Front-End & Game Architecture |
| **Fase 4** | Sistema Modular de Blocos e Destruição Estilo Lego | **Concluída** | Especialista Front-End & Game Architecture |
| **Fase 5** | Netcode Autoritativo (NestJS Socket.IO, Predição & Reconciliação) | **Concluída** | Especialista Back-End, Front-End & Netcode |
| **Fase 6** | Sistema de Combate, Armas Fictícias e Object Pooling | **Concluída** | Especialista Back-End, Front-End & Game Architecture |
| **Fase 7** | Modos de Jogo (Sobrevivência Co-op & Combate PvP) | **Próxima (Pronta para Iniciar)** | Time Integrado |
| **Fase 8** | HUD/UI, Áudio Espacial, Otimizações Finais e Deploy | Planejada | Time Integrado / QA |

---

## Detalhamento das Fases

### Fase 1: Fundação do Monorepo, Infraestrutura e Agentes (CONCLUÍDA)
- [x] Estruturação do repositório (`back-workspace/` e `Front-Workspace/`).
- [x] Setup do NestJS 12 com TypeORM e PostgreSQL no Docker (porta 5433).
- [x] Padrão de migrations com timestamp em milissegundos (`Date.now()`, 13 dígitos).
- [x] Setup do Angular 22 Standalone com CSS vanilla e roteamento ativado.
- [x] Configuração da suíte de testes com **Vitest** no frontend e backend.
- [x] Definição de regras globais (`AGENTS.md`) e 5 skills em `.agents/skills/`.

### Fase 2: Cena 3D Local no Front-End (CONCLUÍDA)
- [x] Formalização da documentação técnica e de governança em `docs/`.
- [x] Instalação de `three` e `@types/three` em `Front-Workspace/`.
- [x] Criação do `GameViewportComponent` (Dumb Component desacoplado para renderização WebGL com OnPush).
- [x] Configuração do Renderizador WebGL responsivo com ajuste dinâmico de redimensionamento (`ResizeObserver`).
- [x] Construção da arena de teste com iluminação, piso com studs procedurais e muretas coloridas de contenção.
- [x] Criação do personagem de blocos geométrico provisório (herói montável).
- [x] Implementação de câmera em terceira pessoa com rotação suave e órbita suave.
- [x] Garantia de 60 FPS estáveis fora da zona Angular e validação através de testes automatizados (`npm run test:frontend` e `npm run build:frontend`).
- [x] Auditoria de QA aprovada com zero uso de `any` e desalocação exaustiva de memória no `ngOnDestroy`.

### Fase 3: Movimentação, Física Arcade e Controle de Veículos (CONCLUÍDA)
- [x] Separação estrita de lógica e matemática: motor ECS em `core/engine/` agnóstico a Three.js.
- [x] Implementação do `GameLoop` determinístico com fixed timestep de 60Hz (`1/60s`) e acumulador de tempo.
- [x] `MovementSystem`: locomoção responsiva do pedestre (WASD/setas), rotação suave na direção da marcha e limites na arena.
- [x] `VehiclePhysicsSystem`: física arcade completa com aceleração linear progressiva, desaceleração por arrasto/atrito, frenagem vigorosa, ré e freio de mão (`Space`) disparando derrapagem lateral (*drift*).
- [x] `InteractionSystem`: sistema de detecção de proximidade (2.8m) com tecla de interação `E` para embarque/desembarque no veículo.
- [x] Buggy arcade de blocos 3D adicionado à cena com chassi amarelo/preto, 4 rodas volumosas com calotas e santantônio.
- [x] Câmera em terceira pessoa adaptativa com transição suave de distância e ângulo polar ao pilotar vs a pé.
- [x] HUD esportivo com velocímetro digital (km/h), barra de potência, indicador de modo e badge de DRIFT.
- [x] Suíte de testes automatizados com Vitest: **37 testes aprovados (100% de sucesso)** cobrindo todos os sistemas ECS e componentes.
- [x] Build de produção (`ng build`) concluído com sucesso (código 0).
- [x] Auditoria de QA homologada sem ressalvas impeditivas.

### Fase 4: Sistema Modular de Blocos e Destruição Estilo Lego (CONCLUÍDA)
- [x] Definição da estrutura modular de peças de blocos (chassi, rodas, blindagem, para-choques).
- [x] Sistema de pontos de ancoragem (*sockets*) para encaixe de blocos.
- [x] Sistema de durabilidade e desprendimento de blocos individuais sob impacto.
- [x] Implementação de `ObjectPool` puro genérico para detritos e peças sem GC spikes.
- [x] Efeitos de detritos e peças soltas com física balística arcade e quiques no solo.
- [x] 56 testes automatizados com Vitest cobrindo 100% dos cenários em 9 suítes.

### Fase 5: Netcode Autoritativo (Socket.IO, Predição & Reconciliação) (CONCLUÍDA)
- [x] Implementação do NestJS Gateway (`GameGateway`) com Socket.IO e CORS para sincronização multiplayer.
- [x] Envio periódico de snapshots autoritativos pelo servidor a 20Hz (50ms) com `ackInputs`.
- [x] Client-side prediction para movimentação do herói e buggy sem latência percebida a 60 FPS.
- [x] Server reconciliation: buffer de inputs pendentes com correção determinística e replay ao detectar divergências > 0.25m.
- [x] Interpolação de entidades remotas (`lerp` a 15.0/s) no Three.js para movimentação fluida de outros jogadores.
- [x] Indicador de status de conexão no HUD (🟢 ONLINE / 🔴 OFFLINE) e medidor de RTT/ping em tempo real.
- [x] 106 testes automatizados aprovados (27 no backend e 79 no frontend) e builds de produção limpos.

### Fase 6: Sistema de Combate, Armas Fictícias e Object Pooling (CONCLUÍDA)
- [x] Arsenal fictício arcade com 3 armas: Stud Blaster (tiro linear rápido), Block Scatter Shot (dispersão em cone de 5 projéteis) e Spring Mine (mina com detonação de proximidade e knockback).
- [x] Broad-Phase de colisão com Spatial Hash Grid matemático em células de 8.0m ($O(1)$ médio) no backend e frontend.
- [x] Narrow-Phase de detecção de colisão raio/esfera contra blocos de veículos e pedestres com ejeção modular de peças.
- [x] Motor de combate autoritativo com `CombatService` no NestJS (anti-cheat com validação de cooldowns, trajectory tick e broadcast de danos e projéteis).
- [x] `ObjectPool` para projéteis e Floating Combat Text (danos flutuantes projetados da cena 3D para o HUD com animação e fade-out).
- [x] Controles de disparo ([J] ou Botão Esquerdo do Mouse), troca de armas ([1], [2], [3]) e card de arma equipada com barra de cooldown dinâmica.
- [x] 146 testes unitários automatizados aprovados (49 no backend e 97 no frontend) com 100% de sucesso.
- [x] Builds de produção limpos e conformidade total de tipagem estrita e separação de interfaces.

### Fase 7: Modos de Jogo (Sobrevivência Co-op & Combate PvP)
- [ ] Máquina de Estados Finitos (FSM) do ciclo de vida das partidas.
- [ ] Modo 1: Sobrevivência Cooperativa (ondas progressivas de inimigos blocados, pausas para escolha de upgrades/peças).
- [ ] Modo 2: Combate Competitivo (Arena Deathmatch / Todos-contra-Todos com respawn de veículos e armas).
- [ ] Sistema de pontuação, placar e estatísticas da partida persistidas no PostgreSQL.

### Fase 8: HUD/UI, Áudio Espacial, Otimizações Finais e Deploy
- [ ] HUD do jogo em Angular (Smart/Dumb components: vida, minimapa, contadores de blocos, velocímetro arcade).
- [ ] Sistema de áudio espacial Web Audio API (sons de encaixe de blocos, motores, explosões lúdicas).
- [ ] Otimizações finais de bundle, lazy loading de assets e auditoria com Lighthouse.
- [ ] Pipeline CI/CD, build dos contêineres Docker e deploy de produção em serviços gratuitos/tier cloud.
