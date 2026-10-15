---
name: frontend-architecture
description: >-
  Guides modern front-end development, UI component architecture, state management,
  responsive design, accessibility (a11y), and clean design system integration.
---

# Arquitetura e Padrões de Front-End

Este guia define as boas práticas de desenvolvimento front-end para criação de interfaces modernas, performáticas, acessíveis e fáceis de manter.

---

## 1. Organização e Arquitetura de Componentes

Adote uma estrutura modular baseada em responsabilidades:

```text
src/
├── assets/            # Imagens, fontes e ícones estáticos
├── components/        # Componentes de UI reutilizáveis (botões, inputs, cards, modais)
│   ├── ui/            # Componentes base atômicos / design system
│   └── feedback/      # Loaders, toasts, banners de erro
├── features/          # Módulos com regras de negócio e telas específicas
│   └── [feature]/
│       ├── components/# Componentes específicos desta feature
│       ├── hooks/     # Hooks customizados para regras de estado
│       ├── services/  # Chamadas de API da feature
│       └── types/     # Tipos TypeScript específicos
├── hooks/             # Hooks globais (useTheme, useMediaQuery, useAuth)
├── services/          # Cliente HTTP base (Axios / Fetch) e interceptors
├── styles/            # Variáveis CSS, temas globais e resets
└── types/             # Tipos globais e modelos compartilhados
```

---

## 2. Padrões de Componentes

### 2.1 Separação entre Apresentação e Lógica (Smart vs. Dumb)
- **Componentes de Apresentação (Dumb/UI)**:
  - Recebem dados e callbacks via `props`.
  - Não realizam chamadas diretas de API nem dependem de regras globais complexas.
  - Fáceis de testar em isolamento e de reutilizar em diferentes telas.
- **Componentes Container (Smart/Feature)**:
  - Consomem hooks, orquestram estados e chamadas de API.
  - Repassam dados tratados para os componentes de apresentação.

### 2.2 Gerenciamento de Estado
1. **Estado Local**: Use o estado nativo (`useState`, `useReducer`, `signal`) apenas para controle de interface local (abrir/fechar modal, tabs, digitação em inputs).
2. **Estado do Servidor**: Use bibliotecas especializadas (como TanStack Query ou SWR) para cache, sincronização e revalidação de dados remotos. Não replique dados de API em estados globais desnecessariamente.
3. **Estado Global**: Para preferências do usuário (tema, idioma, sessão autenticada), utilize gerenciadores enxutos (Zustand, Signals ou Context com escopo delimitado).

### 2.3 Separação Estrita de Interfaces e Tipos (`interfaces/` ou `types/`)
- **Regra Obrigatória**: Toda interface de componente, contratos de dados, payloads de rede, assinaturas de eventos e tipos de entidades/sistemas devem residir obrigatoriamente em pastas dedicadas (`interfaces/` ou `types/`).
- **Arquivos de Implementação Limpos**: Arquivos `.component.ts`, `.service.ts` ou `.system.ts` devem conter exclusivamente a implementação da sua classe, sistema ou função. As interfaces correspondentes devem ser extraídas e importadas explicitamente de seus respectivos arquivos (ex: `interfaces/game-viewport.interface.ts`, `types/vehicle.types.ts`).
- **Legibilidade e Reuso**: Essa separação evita arquivos inflados com dezenas de linhas de tipagem, desacopla as definições de dados de seus consumidores e facilita a leitura e manutenção imediata do código.

---

## 3. Experiência Visual e Design System

- **Tokens de Design**: Centralize cores, espaçamentos, tipografia e raios de borda em variáveis CSS (`--color-primary`, `--spacing-md`, etc.). Evite cores e medidas *hardcoded* espalhadas no código.
- **Estados de Interface Obrigatórios**: Toda tela ou componente que consome dados assíncronos deve cobrir explicitamente 4 estados:
  1. **Loading**: Skeletons ou indicadores visuais suaves (evite layouts que pulam abruptamente).
  2. **Error**: Mensagens claras com ação de recuperação ("Tentar novamente").
  3. **Empty**: Feedback amigável quando não houver registros a exibir.
  4. **Success**: Exibição dos dados com transições suaves.
- **Responsividade**: Desenvolva pensando em Mobile-First, utilizando *flexbox*, *grid* e *media queries* consistentes.

---

## 4. Acessibilidade (a11y) e Performance

1. **HTML Semântico**: Prefira sempre tags nativas (`<button>`, `<main>`, `<nav>`, `<article>`, `<header>`) antes de recorrer a `<div>` com eventos de clique.
2. **Navegação por Teclado**: Elementos interativos devem ser focáveis (`tabindex`), ter estados de `:focus-visible` evidentes e responder às teclas `Enter` e `Space`.
3. **Legibilidade e Contraste**: Garanta contraste adequado entre textos e planos de fundo (padrão WCAG AA).
4. **Otimização**: Utilize divisão de código (*code splitting* / lazy loading) para rotas pesadas e otimize formatos de imagens (WebP, SVGs).
