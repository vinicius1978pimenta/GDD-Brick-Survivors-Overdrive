# Registro de Decisões Técnicas (ADR) - Brick Survivors: Overdrive

Este documento reúne os Registros de Decisões Arquiteturais (ADRs) fundamentais tomadas no projeto, explicando o contexto, as alternativas avaliadas e os motivos da escolha.

---

## ADR 001: Adoção do Vitest em Substituição ao Jest

- **Status:** Aprovado e Implementado
- **Contexto:** O projeto utiliza TypeScript moderno com módulos ESM nativos no Front-End (Angular 22) e Back-End (NestJS 12).
- **Problema do Jest:** O Jest historicamente apresenta problemas severos com ESM nativo (`SyntaxError: Cannot use import statement outside a module`), tempo de inicialização lento com `ts-jest` e alto consumo de memória.
- **Decisão:** Utilizar **Vitest** tanto no `Front-Workspace/` quanto no `back-workspace/`.
- **Benefícios:**
  1. Suporte nativo e transparente a ESM e TypeScript.
  2. Execução extremamente rápida (transformações paralelas com esbuild/vite).
  3. API idêntica e familiar (`describe`, `it`, `expect`, `vi.fn`).
  4. Execução de testes unitários em milissegundos.

---

## ADR 002: Padrão de Migrations TypeORM com Timestamp em Milissegundos (`Date.now()`, 13 Dígitos)

- **Status:** Aprovado e Mandatório
- **Contexto:** O TypeORM armazena o histórico de execuções na tabela interna `migrations` onde a coluna `timestamp` é tipada como `bigint`.
- **Problema:** Quando migrations utilizam convenções de nomes arbitrárias ou datas formatadas (`20261014-Nome.ts`), o TypeORM falha na conversão numérica ou gera desordem na sequência de execução.
- **Decisão:** Toda migration deve obrigatoriamente utilizar timestamp numérico em milissegundos (`Date.now()`, 13 dígitos) no nome do arquivo (`<timestamp>-<Nome>.ts`) e na classe (`class <Nome><timestamp>`).
- **Benefícios:**
  1. Compatibilidade nativa com a coluna `timestamp bigint`.
  2. Ordem estrita e determinística de execução.
  3. Prevenção de conflitos entre branches de desenvolvimento concorrentes.

---

## ADR 003: Mapeamento de Porta Externa do PostgreSQL para 5433 no Docker

- **Status:** Aprovado e Implementado
- **Contexto:** O serviço do banco de dados PostgreSQL roda encapsulado no Docker Compose.
- **Problema:** A porta padrão `5432` é amplamente utilizada por instâncias locais de bancos de dados já instaladas na máquina do desenvolvedor, gerando colisões de bind de porta (`bind: address already in use`).
- **Decisão:** Expor o contêiner na porta externa do host `5433` (`5433:5432`), mantendo internamente a porta `5432` na rede de contêineres Docker (`brick_network`).
- **Benefícios:**
  1. Execução sem conflito em qualquer máquina de desenvolvimento.
  2. Transparência para o contêiner NestJS que se conecta diretamente via host de rede `postgres:5432`.
  3. Ferramentas locais de administração de banco (DBeaver, pgAdmin) conectam na porta `5433`.

---

## ADR 004: Frontend em Angular Standalone com CSS Vanilla

- **Status:** Aprovado e Implementado
- **Contexto:** O jogo necessita de alto desempenho visual (60 FPS contínuos) e baixa latência de renderização de interface.
- **Decisão:** Utilizar Angular Standalone Components sem bibliotecas de componentes externas (como Angular Material ou Bootstrap), adotando CSS vanilla estruturado com tokens de design e variáveis CSS nativas.
- **Benefícios:**
  1. Redução máxima do tamanho do bundle final de carregamento.
  2. Eliminação de conflitos de renderização ou render-blocking com o canvas WebGL.
  3. Facilidade de personalização estética com identidade visual de brinquedos de blocos.

---

## ADR 005: Desacoplamento da Lógica ECS do Renderizador Three.js

- **Status:** Aprovado e Mandatório
- **Contexto:** O jogo terá netcode autoritativo onde a simulação física deve ser validada tanto no cliente (predição local) quanto no servidor NestJS (reconciliação e combate autoritativo).
- **Problema:** Three.js possui acoplamento forte com o ecossistema WebGL/DOM (`HTMLCanvasElement`, `WebGLRenderer`), inviabilizando sua execução direta no Node.js sem emulações pesadas e lentas de headless WebGL.
- **Decisão:** As classes e sistemas de simulação do ECS manipulam exclusivamente estruturas matemáticas primitivas (`x`, `y`, `z`, vetores simples, caixas de colisão AABB). O Three.js atua estritamente como visualizador/consumidor na camada de apresentação do front-end.
- **Benefícios:**
  1. Lógica compartilhável entre cliente e servidor sem dependências externas de renderização.
  2. Testabilidade unitária de alta velocidade (testes de física e lógica rodam sem carregar WebGL).
  3. Flexibilidade futura para trocar ou atualizar o motor de renderização sem alterar as regras de gameplay.
