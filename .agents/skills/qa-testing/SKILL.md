---
name: qa-testing
description: >-
  Guides Quality Assurance (QA) and testing strategies, covering unit tests,
  integration tests, E2E testing, mocking standards, and automated quality checks
  using Vitest, Supertest, and linters.
---

# Padrões de Testes e Garantia de Qualidade (QA)

Este guia estabelece as práticas de Quality Assurance e testes automatizados para manter a estabilidade, confiabilidade e prevenção de regressões em todo o projeto.

---

## 1. Pirâmide de Testes

1. **Testes Unitários (Base da Pirâmide - Maior Volume)**:
   - Focam em uma única função, método ou classe em isolamento total.
   - Devem ser extremamente rápidos e não depender de rede, disco ou banco de dados real.
   - Dependências externas devem ser substituídas por mocks (`vi.fn()`, `vi.spyOn()`).

2. **Testes de Integração (Meio da Pirâmide)**:
   - Validam a comunicação entre duas ou mais camadas (ex: Controller + Service, Service + Banco de Dados em memória).
   - Verificam se DTOs, filtros de exceção e pipes do NestJS estão operando em harmonia.

3. **Testes de Ponta a Ponta / E2E (Topo da Pirâmide)**:
   - Simulam a jornada completa do usuário final da requisição até a resposta.
   - No back-end, utilizam o `supertest` para disparar chamadas HTTP reais na aplicação NestJS em execução.

---

## 2. Estrutura Padrão de um Teste (Padrão AAA)

Todo teste automatizado deve seguir a divisão clara de três fases:

```typescript
describe('ScoreCalculatorService', () => {
  it('deve aplicar multiplicador de combo quando acertar blocos consecutivos', () => {
    // 1. Arrange (Preparação)
    const service = new ScoreCalculatorService();
    const baseScore = 100;
    const comboStreak = 5;

    // 2. Act (Ação / Execução)
    const finalScore = service.calculate(baseScore, comboStreak);

    // 3. Assert (Afirmação / Verificação)
    expect(finalScore).toBe(250);
  });
});
```

---

## 3. Padrões de Teste no NestJS com Vitest

### 3.1 Testes Unitários de Serviços
- Utilize o utilitário `Test.createTestingModule` para simular o contêiner de injeção de dependência do NestJS:
  ```typescript
  describe('PlayerService', () => {
    let service: PlayerService;
    let repository: vi.Mocked<PlayerRepository>;

    beforeEach(async () => {
      const moduleRef = await Test.createTestingModule({
        providers: [
          PlayerService,
          {
            provide: PlayerRepository,
            useValue: {
              findById: vi.fn(),
              save: vi.fn(),
            },
          },
        ],
      }).compile();

      service = moduleRef.get<PlayerService>(PlayerService);
      repository = moduleRef.get(PlayerRepository);
    });

    it('deve lançar NotFoundException quando o jogador não for encontrado', async () => {
      repository.findById.mockResolvedValue(null);

      await expect(service.findById('invalid-id')).rejects.toThrow(NotFoundException);
    });
  });
  ```

### 3.2 Testes E2E com Supertest
- Localizados na pasta `test/` (ex: `test/app.e2e-spec.ts`).
- Devem inicializar a aplicação com `app.init()` no `beforeAll` e encerrar com `app.close()` no `afterAll`.

---

## 4. Cobertura de Cenários Críticos

Ao criar testes para qualquer funcionalidade, garanta a validação de:
- **Caminho Feliz (Happy Path)**: Entrada correta produz a saída esperada com status de sucesso (`200 OK`, `201 Created`).
- **Validação de Entrada (Bad Request)**: Envio de campos ausentes, tipos incorretos ou fora dos limites permitidos (`400 Bad Request`).
- **Recursos Inexistentes**: IDs não encontrados no banco (`404 Not Found`).
- **Casos de Limite (Edge Cases)**: Arrays vazios, strings em branco, números zero ou negativos, valores nulos e caracteres especiais.
- **Autorização**: Requisições sem credenciais ou com permissões insuficientes (`401 Unauthorized`, `403 Forbidden`).

---

## 5. Checklist de Qualidade Antes de Submeter Código

Antes de abrir Pull Request ou commitar alterações:
```bash
# 1. Executar o linter e análise estática
npm run lint

# 2. Executar a suíte de testes unitários
npm run test

# 3. Executar o build para verificar tipos do TypeScript
npm run build
```
