# Diretrizes do Projeto - Brick Survivors Overdrive

Este repositório segue padrões rigorosos de engenharia de software para garantir código limpo, arquitetura desacoplada, alta qualidade visual e cobertura consistente de testes.

---

## 🧭 Skills Disponíveis para Agentes

As seguintes skills estão configuradas e prontas para uso em `.agents/skills/`:

1. **Clean Code & Boas Práticas**: [`.agents/skills/clean-code/SKILL.md`](./.agents/skills/clean-code/SKILL.md)
   - Princípios SOLID, DRY, KISS, YAGNI, convenções de nomenclatura e refatoração.
2. **Back-End (NestJS)**: [`.agents/skills/backend-architecture/SKILL.md`](./.agents/skills/backend-architecture/SKILL.md)
   - Arquitetura em camadas, Controllers enxutos, Services de domínio, DTOs com validação e tratamento de exceções.
3. **Front-End**: [`.agents/skills/frontend-architecture/SKILL.md`](./.agents/skills/frontend-architecture/SKILL.md)
   - Separação Smart/Dumb components, gerenciamento de estado, tokens de design, acessibilidade (a11y) e design moderno.
4. **Garantia de Qualidade & Testes (QA)**: [`.agents/skills/qa-testing/SKILL.md`](./.agents/skills/qa-testing/SKILL.md)
   - Pirâmide de testes (Unitários, Integração, E2E), padrão AAA, mocks e checklists pré-commit.

---

## 🛠️ Regras Obrigatórias para Qualquer Implementação

1. **Tipagem Estrita**: Nunca utilize `any` arbitrário no TypeScript sem justificativa técnica plausível.
2. **Validação de Entrada**: Toda comunicação externa (endpoints REST, formulários de UI) deve ser validada na fronteira.
3. **Sem Efeitos Colaterais Ocultos**: Funções puras sempre que possível; separe claramente leitura de escrita/modificação de estado.
4. **Verificação Automatizada**: Todo código novo ou refatorado deve passar sem erros nos comandos:
   - `npm run lint`
   - `npm test`
   - `npm run build`
