# Roadmap do Projeto - Brick Survivors: Overdrive

Este documento descreve o plano de desenvolvimento do **Brick Survivors: Overdrive** estruturado em 8 fases incrementais.

---

## Status Geral do Projeto

| Fase | Título | Status | Responsável |
| :--- | :--- | :---: | :--- |
| **Fase 1** | Fundação do Monorepo, Infraestrutura e Agentes | **Concluída** | Orquestrador / Time Base |
| **Fase 2** | Cena 3D Local no Front-End (Three.js & Viewport) | **Concluída** | Especialista Front-End / Engine |
| **Fase 3** | Movimentação, Física Arcade e Controle de Veículos | **Concluída** | Especialista Front-End & Game Architecture |
| **Fase 4** | Sistema Modular de Blocos e Destruição Estilo Lego | **Próxima (Pronta para Iniciar)** | Especialista de Game Architecture |
| **Fase 5** | Netcode Autoritativo (NestJS Socket.IO, Predição & Reconciliação) | Planejada | Especialista Back-End & Netcode |
| **Fase 6** | Sistema de Combate, Armas Fictícias e Object Pooling | Planejada | Especialista de Game Architecture |
| **Fase 7** | Modos de Jogo (Sobrevivência Co-op & Combate PvP) | Planejada | Time Integrado |
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

### Fase 4: Sistema Modular de Blocos e Destruição Estilo Lego (PRÓXIMA)
- [ ] Definição da estrutura modular de peças de blocos (chassi, rodas, blindagem, para-choques).
- [ ] Sistema de pontos de ancoragem (*sockets*) para encaixe de blocos.
- [ ] Sistema de durabilidade e desprendimento de blocos individuais sob impacto.
- [ ] Renderização otimizada com `InstancedMesh` para redução drástica de draw calls.
- [ ] Efeitos de detritos e partículas reaproveitadas via `ObjectPool`.

### Fase 5: Netcode Autoritativo (Socket.IO, Predição & Reconciliação)
- [ ] Implementação do NestJS Gateway com Socket.IO para sincronização multiplayer.
- [ ] Envio periódico de snapshots autoritativos pelo servidor (20-30Hz).
- [ ] Client-side prediction para movimento do jogador local sem percepção de latência.
- [ ] Server reconciliation: buffer de inputs pendentes e correção com replay quando houver divergência.
- [ ] Interpolação de entidades remotas (`lerp`/`slerp`) com buffer de snapshots (~50-100ms).

### Fase 6: Sistema de Combate, Armas Fictícias e Object Pooling
- [ ] Arsenal fictício arcade (lançador de pinos, raio desintegrador de blocos, minas de mola).
- [ ] Broad-Phase de colisão com Spatial Hash Grid para escala performática de entidades.
- [ ] Narrow-Phase de detecção de colisão raio/projétil contra blocos de veículos e inimigos.
- [ ] `ObjectPool` para projéteis, lasers e textos de dano flutuante (floating combat text), eliminando GC spikes.

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
