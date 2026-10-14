# Notas do Projeto - Brick Survivors: Overdrive

**Data de Início:** Outubro de 2026  
**Status Geral:** Fase 1 Concluída | Fase 2 Concluída | Fase 3 Em Andamento  
**Orquestrador:** Maestro (Agente Principal)

---

## 1. Visão Geral da Fase 1 (Concluída)

A **Fase 1: Fundação do Monorepo, Infraestrutura e Agentes** foi concluída com 100% de conformidade com as diretrizes de engenharia de software e arquitetura do projeto.

### Entregas Realizadas:
1. **Infraestrutura e Contêineres:**
   - Orquestração via Docker Compose com PostgreSQL 16 Alpine exposto na porta externa `5433` (mapeada para `5432` interna) para evitar colisão com instâncias locais.
   - Volumes persistentes nomeados (`brick_survivors_postgres_data`) e healthchecks configurados.
   - Variáveis de ambiente configuráveis e fallback seguro.

2. **Back-End (NestJS 12):**
   - Configurado em `back-workspace/` com TypeORM e driver `pg`.
   - Estrutura desacoplada em módulos, controllers, services e DTOs.
   - Padrão estrito de Migrations TypeORM com prefixo de timestamp em milissegundos (`Date.now()`, 13 dígitos) para ordenação determinística.
   - Suíte de testes automatizados com **Vitest** (Unitários e E2E via Supertest).
   - Linter com oxlint configurado para type-checking ágil.

3. **Front-End (Angular 22):**
   - Configurado em `Front-Workspace/` com arquitetura baseada em Standalone Components.
   - Roteamento nativo e CSS vanilla estilizado sem bibliotecas pesadas de terceiros.
   - Configurado com **Vitest** e jsdom para testes unitários rápidos.
   - Preparado para integração do canvas WebGL Three.js.

4. **Diretrizes e Skills de Agentes:**
   - 5 Skills ativas e documentadas em `.agents/skills/`:
     - `clean-code`: Princípios SOLID, DRY, KISS, YAGNI e checklist de qualidade.
     - `backend-architecture`: Arquitetura em camadas NestJS, validação com DTOs.
     - `frontend-architecture`: Separação Smart/Dumb components, a11y, estado unidirecional.
     - `qa-testing`: Pirâmide de testes com Vitest, mocks e padrões AAA.
     - `game-architecture`: ECS (Entity Component System), game loop autoritativo em fixed timestep (60Hz), predição de cliente, reconciliação de servidor, spatial partitioning e object pooling.
   - Regras globais consolidadas em `AGENTS.md`.

---

## 2. Estrutura Atual de Pastas

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
│   ├── src/
│   │   ├── database/             # Data Source e Migrations (prefixo ms)
│   │   ├── modules/
│   │   ├── app.module.ts
│   │   └── main.ts
│   ├── test/
│   ├── Dockerfile
│   └── package.json
├── Front-Workspace/              # Aplicação Angular 22 Standalone + Three.js + Vitest
│   ├── src/
│   │   ├── app/
│   │   │   ├── components/
│   │   │   │   └── game-viewport/ # GameViewportComponent (WebGL Canvas, Three.js)
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
├── docker-compose.yml            # Orquestração do PostgreSQL (5433) e API
├── AGENTS.md                     # Diretrizes mandatórias para agentes de IA
└── package.json                  # Scripts unificados na raiz do monorepo
```

---

## 3. Registro de Entregas da Fase 2 (Concluída com Sucesso)

A **Fase 2: Cena 3D Local no Front-End (Three.js & Viewport)** foi totalmente concluída e auditada:

1. **Instalação do Three.js:**
   - Adicionadas as dependências `three` (`^0.186.1`) e `@types/three` (`^0.186.0`) no `Front-Workspace/package.json`.
2. **Criação do `GameViewportComponent`:**
   - Implementado como **Dumb Component** isolado com `ChangeDetectionStrategy.OnPush` em `src/app/components/game-viewport/`.
   - Renderizador `THREE.WebGLRenderer` responsivo acoplado a `ResizeObserver`, adaptando aspect ratio e dimensões sem distorção.
   - Iluminação: `THREE.AmbientLight` (luz difusa suave), `THREE.HemisphereLight` e `THREE.DirectionalLight` com mapa de sombras PCF suave (`castShadow = true`).
   - Arena estilo brinquedo de montar: piso com textura procedural de pinos (LEGO-style studs) via `THREE.CanvasTexture`, grid tático sobreposto e muretas de contenção em blocos amarelos e vermelhos.
   - Herói geométrico provisório: montado com geometrias puras de blocos (pernas articuladas azuis, quadril cinza, tronco vermelho, cabeça amarela cilíndrica com stud superior, visor ciano emissivo e mochila survivor traseira com núcleo de energia).
   - Câmera orbital em terceira pessoa: coordenadas esféricas com interpolação suave (Damping/Lerp), sensível a arraste de ponteiro (mouse drag) para rotação horizontal e vertical, zoom via scroll do mouse e rotação automática sutil quando ocioso.
   - Game Loop estável a 60 FPS: executado fora da zona do Angular (`NgZone.runOutsideAngular`), eliminando ciclos desnecessários de Change Detection.
   - Gestão de Memória e Ciclo de Vida: método `cleanup()` no `ngOnDestroy` descartando texturas, geometrias, materiais (via travessia da cena), cancelando `requestAnimationFrame`, desconectando `ResizeObserver` e removendo listeners.
3. **Auditoria e Qualidade (QA):**
   - Suíte de testes unitários: 8 testes aprovados (100% de sucesso via Vitest).
   - Build de produção: `npm run build:frontend` compilado com sucesso (`dist/Front-Workspace`).
   - Conformidade: Zero uso de `any`, estrita tipagem TypeScript, código alinhado a `AGENTS.md` e `.agents/skills/clean-code/SKILL.md`.

---

## 4. Comandos para Execução e Testes Locais

A partir da raiz do monorepo (`GDD-Brick-Survivors-Overdrive/`):

### Banco de Dados (Docker):
```bash
npm run docker:up:db     # Subir PostgreSQL na porta 5433
npm run docker:up        # Subir Postgres + Backend
npm run docker:down      # Parar contêineres
npm run docker:logs      # Visualizar logs
```

### Desenvolvimento Local:
```bash
npm run start:backend    # Iniciar API NestJS (watch mode)
npm run start:frontend   # Iniciar Front-End Angular (porta 4200)
```

### Testes e Verificação de Qualidade:
```bash
npm run test:backend     # Testes unitários do backend
npm run test:frontend    # Testes unitários do frontend (8 testes passando)
npm run build:backend    # Compilação de produção NestJS
npm run build:frontend   # Compilação de produção Angular
```
