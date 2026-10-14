# Notas do Projeto - Brick Survivors: Overdrive

**Data de Início:** Outubro de 2026  
**Status Geral:** Fase 1 Concluída com Sucesso | Fase 2 Em Andamento  
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
├── Front-Workspace/              # Aplicação Angular 22 Standalone + Vitest
│   ├── src/
│   │   ├── app/
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

## 3. Comandos para Execução e Testes Locais

A partir da raiz do monorepo (`GDD-Brick-Survivors-Overdrive/`):

### Banco de Dados (Docker):
```bash
# Subir apenas o banco de dados PostgreSQL
npm run docker:up:db

# Subir toda a infraestrutura (Postgres + Backend)
npm run docker:up

# Parar contêineres
npm run docker:down

# Visualizar logs
npm run docker:logs
```

### Desenvolvimento Local:
```bash
# Iniciar o servidor Back-End (NestJS watch mode)
npm run start:backend

# Iniciar o cliente Front-End (Angular dev server)
npm run start:frontend
```

### Testes e Verificação de Qualidade:
```bash
# Executar testes unitários do backend
npm run test:backend

# Executar testes unitários do frontend
npm run test:frontend

# Build de produção do backend
npm run build:backend

# Build de produção do frontend
npm run build:frontend
```

---

## 4. Registro de Entregas da Fase 2

- **Item 1:** Criação da documentação estruturada em `docs/` (`NOTAS-DO-PROJETO.md`, `ROADMAP.md`, `architecture.md`, `DECISOES-TECNICAS.md`).
- **Item 2 (Em progresso):** Instalação de dependências do Three.js (`three`, `@types/three`) no `Front-Workspace/`.
- **Item 3 (Em progresso):** Implementação do `GameViewportComponent` (Dumb Component isolado para canvas WebGL, iluminação, chão estilo arena e herói de blocos).
- **Item 4 (Em progresso):** Câmera orbital e perspectiva em terceira pessoa.
- **Item 5 (Em progresso):** Validação com `npm run build:frontend` e `npm run test:frontend`.
