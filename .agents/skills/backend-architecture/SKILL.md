---
name: backend-architecture
description: >-
  Guides backend development using NestJS, TypeScript, and Node.js, focusing on
  Clean Architecture, layered separation, DTO validation, REST API standards,
  and robust error handling.
---

# Arquitetura e Padrões de Back-End (NestJS)

Este guia estabelece os padrões de desenvolvimento back-end com NestJS e TypeScript para garantir escalabilidade, testabilidade e separação clara de responsabilidades.

---

## 1. Estrutura de Camadas (Clean / Layered Architecture)

Cada módulo de negócio no back-end deve respeitar rigorosamente a separação em camadas:

```text
src/
├── modules/
│   └── [feature-name]/
│       ├── controllers/       # Camada de entrada (HTTP, REST, validação de payload)
│       ├── services/          # Regras de negócio e casos de uso (orquestração)
│       ├── dto/               # Objetos de transferência de dados (entrada e saída)
│       ├── entities/          # Modelos de domínio ou entidades de persistência
│       ├── repositories/      # Interfaces e implementações de persistência
│       └── [feature].module.ts # Declaração e encapsulamento do módulo
├── common/                    # Utilitários compartilhados, decorators, filtros, guards
├── config/                    # Configurações de ambiente tipadas
└── main.ts                    # Bootstrap da aplicação
```

### 1.1 Responsabilidades de Cada Camada

1. **Controllers**:
   - Devem ser "magros" (*skinny controllers*).
   - Apenas recebem requisições HTTP, delegam para o Service e retornam a resposta formatada com o status HTTP correto (`200`, `201`, `204`, etc.).
   - Nunca devem conter regras de negócio complexas, queries diretas ao banco de dados ou cálculos.

2. **Services**:
   - Contêm as regras de negócio puras e a lógica da aplicação.
   - Orquestram chamadas aos Repositórios, serviços externos e eventos.
   - Devem ser agnósticos a detalhes de transporte HTTP (não devem manipular `Request` ou `Response` do Express diretamente).

3. **DTOs (Data Transfer Objects)**:
   - Definem o formato exato dos dados esperados na entrada e saída dos endpoints.
   - Use propriedades somente leitura (`readonly`).
   - Use decorators de validação (`class-validator` / schema) para garantir que dados inválidos sejam rejeitados antes de alcançar o Service.

4. **Repositories**:
   - Isolam o acesso ao banco de dados ou persistência.
   - Permitem que o Service dependa de uma interface de repositório, facilitando a criação de mocks em testes unitários.

---

## 2. Padrões de Código no NestJS

### 2.1 Injeção de Dependências
- Sempre injete dependências via construtor com modificador `private readonly`:
  ```typescript
  @Injectable()
  export class PlayerService {
    constructor(
      private readonly playerRepository: PlayerRepository,
      private readonly scoreService: ScoreService,
    ) {}
  }
  ```

### 2.2 DTOs e Validação de Entrada
- Todo endpoint que recebe corpo (`@Body()`), parâmetros de URL (`@Param()`) ou query strings (`@Query()`) deve usar um DTO tipado:
  ```typescript
  export class CreateGameSessionDto {
    @IsString()
    @IsNotEmpty()
    readonly playerId: string;

    @IsInt()
    @Min(1)
    readonly level: number;
  }
  ```

### 2.3 Tratamento de Exceções HTTP
- Utilize as exceções nativas do NestJS (`NotFoundException`, `BadRequestException`, `ConflictException`, `ForbiddenException`):
  ```typescript
  async findById(id: string): Promise<Player> {
    const player = await this.playerRepository.findById(id);
    if (!player) {
      throw new NotFoundException(`Jogador com ID "${id}" não foi encontrado.`);
    }
    return player;
  }
  ```

---

## 3. Segurança e Boas Práticas

1. **Validação Global**: Ative o `ValidationPipe` global no `main.ts` com `whitelist: true` e `forbidNonWhitelisted: true` para descartar propriedades maliciosas ou não documentadas.
2. **Variáveis de Ambiente**: Nunca deixe credenciais ou URLs fixas no código. Utilize `@nestjs/config` com validação de esquema de variáveis de ambiente.
3. **CORS e Headers de Segurança**: Configure políticas adequadas de CORS e adicione `helmet` para proteção dos cabeçalhos HTTP.
4. **Log Estruturado**: Utilize o `Logger` nativo do NestJS (`new Logger(MyService.name)`) para logs de informação, aviso e erro, evitando `console.log`.
