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
│       ├── interfaces/        # Interfaces e contratos de dados tipados isolados
│       ├── entities/          # Modelos de domínio ou entidades de persistência
│       ├── repositories/      # Interfaces e implementações de persistência
│       └── [feature].module.ts # Declaração e encapsulamento do módulo
├── common/                    # Utilitários compartilhados, decorators, filtros, guards
│   └── interfaces/            # Interfaces globais/compartilhadas entre módulos
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

5. **Interfaces (`interfaces/`)**:
   - Toda e qualquer interface ou contrato de dados tipados deve residir obrigatoriamente em pasta dedicada `interfaces/` (seja por módulo em `src/modules/[feature]/interfaces/` ou em `src/common/interfaces/`).
   - **Regra Estrita**: Nunca declare interfaces soltas dentro de arquivos de services, controllers ou gateways, mantendo a responsabilidade única de cada arquivo e a máxima legibilidade do código.

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

---

## 4. Banco de Dados e Migrations (TypeORM)

Para garantir integridade do esquema, rastreabilidade e consistência entre ambientes, todas as migrations devem seguir regras estritas de nomenclatura e versionamento:

### 4.1 Timestamp Obrigatório em Milissegundos

- **Padrão Obrigatório**: Toda migration gerada ou criada **deve obrigatoriamente utilizar o timestamp Unix em milissegundos (`Date.now()`, 13 dígitos)** como prefixo do arquivo e no sufixo do nome da classe.
- **Formato do Arquivo**: `src/database/migrations/<timestamp_em_milissegundos>-<NomeDaMigration>.ts`
  - *Exemplo correto*: `1728938123456-CreatePlayerTable.ts`
  - *Incorreto*: `20261014120000-CreatePlayerTable.ts` (data formatada) ou `1728938123-CreatePlayerTable.ts` (timestamp em segundos).
- **Formato da Classe**: `export class <NomeDaMigration><timestamp_em_milissegundos> implements MigrationInterface`
  - *Exemplo correto*: `export class CreatePlayerTable1728938123456 implements MigrationInterface`
- **Motivo Técnico**: A tabela de controle de migrations criada pelo TypeORM (`migrations`) define a coluna `"timestamp" bigint NOT NULL`. O TypeORM extrai o timestamp numérico de 13 dígitos para ordenar e registrar o histórico de execução. O uso de formatos manuais ou em segundos quebra a compatibilidade nativa e pode causar inconsistência na ordem de execução.

### 4.2 Execução e Criação de Migrations

Utilize sempre os scripts padronizados no `package.json` passando o caminho em `src/database/migrations/`:

```bash
# Gerar migration automaticamente a partir da comparação entre entidades e banco de dados:
npm run migration:generate -- src/database/migrations/NomeDaMigration

# Criar migration manual vazia:
npm run migration:create -- src/database/migrations/NomeDaMigration

# Aplicar migrations pendentes:
npm run migration:run

# Reverter a última migration aplicada:
npm run migration:revert

# Listar histórico de migrations:
npm run migration:show
```

### 4.3 Boas Práticas de Migrations

1. **Reversibilidade Garantida**: Todo método `up(queryRunner: QueryRunner)` deve possuir a contraparte exata no método `down(queryRunner: QueryRunner)` para permitir reversão limpa.
2. **Imutabilidade**: Nunca edite uma migration que já foi executada ou commitada em branches compartilhadas. Caso precise alterar uma estrutura, crie uma nova migration corretiva.
3. **Transações**: Utilize o `queryRunner` para garantir que alterações DDL/DML ocorram dentro de uma transação segura.

