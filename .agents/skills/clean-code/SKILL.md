---
name: clean-code
description: >-
  Provides Clean Code standards, SOLID principles, DRY/KISS/YAGNI guidelines,
  refactoring patterns, and naming conventions for building maintainable, readable,
  and robust software across the entire codebase.
---

# Clean Code & Boas Práticas de Engenharia

Este guia define as diretrizes de Clean Code e arquitetura de software que todos os agentes e desenvolvedores devem seguir neste repositório.

---

## 1. Princípios Fundamentais

### 1.1 SOLID
- **S (Single Responsibility Principle - SRP)**: Cada classe, módulo ou função deve ter apenas uma única razão para mudar. Separe lógica de negócio, persistência de dados e controle de requisições.
- **O (Open/Closed Principle - OCP)**: Entidades devem estar abertas para extensão, mas fechadas para modificação. Utilize interfaces, polimorfismo e injeção de dependência.
- **L (Liskov Substitution Principle - LSP)**: Subtipos devem ser substituíveis por seus tipos base sem alterar a corretude do programa. Evite sobrescrever métodos lançando exceções de "não suportado".
- **I (Interface Segregation Principle - ISP)**: Crie interfaces específicas e enxutas em vez de interfaces genéricas e pesadas. Clientes não devem ser forçados a depender de métodos que não usam.
- **D (Dependency Inversion Principle - DIP)**: Módulos de alto nível não devem depender de módulos de baixo nível; ambos devem depender de abstrações. Abstrações não devem depender de detalhes.

### 1.2 Princípios Práticos
- **KISS (Keep It Simple, Stupid)**: A solução mais simples que resolve o problema completamente é preferível à hiper-engenharia e abstrações prematuras.
- **DRY (Don't Repeat Yourself)**: Evite duplicação de regras de negócio ou de conhecimento no sistema. (Atenção: não force abstrações sobre código que apenas parece semelhante por coincidência).
- **YAGNI (You Aren't Gonna Need It)**: Não implemente funcionalidades, parâmetros ou abstrações para requisitos hipotéticos futuros.
- **Boy Scout Rule**: Deixe o código mais limpo do que quando você o encontrou.

---

## 2. Nomenclatura e Clareza

- **Intenção Clara**: Nomes de variáveis, funções e classes devem revelar seu propósito sem necessidade de comentários explicativos.
  - ❌ `const d = 86400;`
  - ✅ `const SECONDS_IN_A_DAY = 86_400;`
- **Classes e Tipos**: Devem ser substantivos em PascalCase (`UserProfileService`, `CreateOrderDto`, `BrickEntity`).
- **Funções e Métodos**: Devem iniciar com verbos de ação em camelCase (`calculateScore()`, `findUserById()`, `validateInput()`).
- **Booleanos**: Devem soar como predicados afirmativos (`isActive`, `hasPermission`, `canProceed`).
- **Evite Abreviações Crípticas**: Prefira clareza a economizar caracteres (`transactionRepository` em vez de `txRepo`).

---

## 3. Funções e Métodos

1. **Pequenas e Focadas**: Uma função ideal deve ter um único objetivo e caber em uma tela (geralmente menos de 20 a 30 linhas).
2. **Single Level of Abstraction (SLAP)**: Mantenha todas as instruções dentro de uma função no mesmo nível de abstração.
3. **Parâmetros Limitados**: Mantenha no máximo 2 a 3 parâmetros por função. Se precisar de mais dados, utilize um objeto/DTO tipado.
4. **Sem Efeitos Colaterais Inesperados**: Funções de consulta (`get`, `find`, `is`) não devem modificar o estado do sistema. Separe comandos (ações com efeito) de consultas (leitura pura).
5. **Retorno Rápido (Guard Clauses / Early Return)**:
   ```typescript
   // ❌ Aninhamento excessivo
   function processUser(user: User | null) {
     if (user) {
       if (user.isActive) {
         // lógica profunda...
       }
     }
   }

   // ✅ Early return limpo
   function processUser(user: User | null) {
     if (!user) return;
     if (!user.isActive) return;
     
     // fluxo principal no nível raiz
   }
   ```

---

## 4. Tratamento de Erros e Exceções

- **Use Exceções / Erros de Domínio**: Não retorne números mágicos ou códigos de erro (`-1`, `null`). Lance erros semânticos ou exceções tipadas (`NotFoundException`, `ValidationError`).
- **Falhe Rápido (Fail-Fast)**: Valide entradas na fronteira do sistema (DTOs com pipes/validadores) antes de iniciar qualquer processamento complexo.
- **Contexto Informativo**: Mensagens de erro devem ser claras para quem depura, sem expor dados sensíveis ou detalhes internos de infraestrutura ao usuário final.

---

## 5. Checklist de Code Review para o Agente

Ao escrever ou refatorar código, certifique-se de:
- [ ] O código segue os padrões do linter/formatter (`oxlint`, `eslint`, `prettier`).
- [ ] As variáveis e métodos possuem tipagem estrita no TypeScript (sem `any` implícito ou desnecessário).
- [ ] Não há código morto, imports não utilizados ou comentários obsoletos.
- [ ] Cada função tem responsabilidade única e clara.
- [ ] Os testes unitários ou de integração cobrem os cenários principais e de erro.
