---
description: "Task list for Controle Financeiro Familiar Offline-First (MVP – Fases 1–4)"
---

# Tasks: Controle Financeiro Familiar Offline-First

**Input**: Design documents from `/specs/001-family-finance-offline/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/

**Tests**: Incluídos como obrigatórios — o Princípio IV da constituição exige testes
automatizados das regras de negócio (cartão/fatura/parcelas, transferências, sync/conflitos)
e o Princípio I exige teste de isolamento por `household`.

**Organization**: Tarefas agrupadas por user story para implementação e teste independentes.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Pode rodar em paralelo (arquivos diferentes, sem dependências pendentes)
- **[Story]**: US1..US10 conforme `spec.md`
- Caminhos de arquivo exatos em cada tarefa
- Convenção de paths: monorepo `apps/web/`, `apps/pocketbase/`, `packages/shared/`

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Inicialização do monorepo e ferramental

- [x] T001 Criar a estrutura do monorepo (`apps/web`, `apps/pocketbase`, `packages/shared`, `docker/`) conforme `plan.md`
- [x] T002 Configurar workspace pnpm em `pnpm-workspace.yaml` + `package.json` raiz (scripts `lint`, `typecheck`, `test:shared`, `test:web`, `test:contract`, `test:pb`, `test:e2e`, `build:hooks`) + `tsconfig.base.json` (TypeScript `strict`, sem `any` implícito)
- [x] T003 [P] Inicializar o app PWA em `apps/web` (Vue 3 + Vite + TS) com `index.html`, `vite.config.ts`, `tsconfig.json`
- [x] T004 [P] Inicializar o pacote `@cf/shared` em `packages/shared` com `tsconfig.json` e `package.json`
- [x] T005 [P] Configurar Tailwind CSS e shadcn-vue em `apps/web/tailwind.config.ts` e `apps/web/src/components/ui/`
- [x] T006 [P] Configurar ESLint + Prettier na raiz (`.eslintrc.cjs`, `.prettierrc`) com regras de imports e proibição de `any`
- [x] T007 [P] Configurar Vitest em `packages/shared/vitest.config.ts` e `apps/web/vitest.config.ts`
- [x] T008 [P] Configurar Playwright em `apps/web/playwright.config.ts`
- [x] T009 Configurar PWA (Workbox, update prompt controlado) em `apps/web/vite.config.ts`
- [x] T010 [P] Criar `docker/Dockerfile.pocketbase` e `docker/docker-compose.yml` com volume `pb_data`
- [x] T011 [P] Criar `.env.example` em `apps/pocketbase/.env.example` e `apps/web/.env.example` (`CF_ENCRYPTION_KEY`, `CF_MAIL_*`, `CF_CORS_ORIGINS`, `CF_STEPUP_TTL`, `VITE_API_URL`)
- [x] T012 [P] Criar workflow de CI (lint, typecheck, testes) em `.github/workflows/ci.yml`
- [x] T013 Criar `README.md` raiz com pré-requisitos e comandos do monorepo

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Contrato compartilhado, base do PocketBase, motor de sync genérico, camada Dexie e shell de UI. **Bloqueia todas as user stories.**

**⚠️ CRITICAL**: Nenhuma user story pode começar antes desta fase.

### Contrato compartilhado (`packages/shared`)

- [x] T014 Definir enums e constantes de domínio (papéis `owner|partner|teen|child|viewer`, status de transação `pago|a_pagar`, tipo `receita|despesa|transferencia`, atribuição, tipos de conta, status de fatura `aberta|fechada|paga|vencida`) em `packages/shared/src/constants/`
- [x] T015 [P] Implementar utilitários de dinheiro em centavos + formatação BRL em `packages/shared/src/domain/money.ts`
- [x] T016 [P] Implementar utilitários de data/fuso e clamp de dia de fechamento/vencimento em `packages/shared/src/domain/dates.ts`
- [x] T017 [P] Implementar o resolver de conflito LWW (`updated_at` do servidor; empate → servidor; retorno `conflict=true`) em `packages/shared/src/domain/conflict.ts`
- [x] T018 Criar schema base de entidade sincronizável (`id`, `household`, `sync_id`, `updated_by`, `deleted_at`, `created`, `updated`) e schema de erro `{ error: { code, message, details } }` em `packages/shared/src/api/base.ts`
- [x] T019 [P] Schemas de entidades de identidade em `packages/shared/src/entities/household.ts` (households, household_members, invites)
- [x] T020 [P] Schemas de entidades financeiras em `packages/shared/src/entities/finance.ts` (accounts, credit_cards, categories)
- [x] T021 [P] Schemas de movimentações em `packages/shared/src/entities/movements.ts` (transactions, installments, invoices, transfers, bills)
- [x] T022 Criar schemas de `POST /sync/push` e `GET /sync/pull` (operação, resultado `applied|conflict|ignored|error`, `PullChange`) em `packages/shared/src/api/sync.ts` conforme `contracts/sync-api.yaml`
- [x] T023 Criar script `packages/shared/scripts/bundle-for-hooks.mjs` (esbuild → `apps/pocketbase/pb_hooks/lib/shared.js`)

### Backend PocketBase

- [x] T024 Criar migração dos campos custom de `users` (name, avatar, active, twofa_*, recovery_codes_hashed, webauthn_credentials, last_known_device, last_login_at) em `apps/pocketbase/pb_migrations/`
- [x] T025 [P] Criar migração das collections `households`, `household_members` (índice único `(household,user)`), `invites` em `apps/pocketbase/pb_migrations/`
- [x] T026 [P] Criar migração das collections `accounts`, `credit_cards` (1–1 com account tipo `cartao_credito`), `categories` (campo `system`) em `apps/pocketbase/pb_migrations/`
- [x] T027 [P] Criar migração das collections `transactions`, `installments`, `invoices` (índice único `(credit_card, reference_month)`), `transfers`, `bills` em `apps/pocketbase/pb_migrations/`
- [x] T028 [P] Criar migração de `sync_events` (índice único `(household, entity, sync_id)`), `audit_logs`, `trusted_devices` e da tabela SQLite `change_log(seq INTEGER PRIMARY KEY AUTOINCREMENT, ...)` em `apps/pocketbase/pb_migrations/`
- [x] T029 Aplicar regras de acesso por collection (isolamento `household` + RBAC) em `apps/pocketbase/pb_migrations/`
- [x] T030 Criar bootstrap de rotas em `apps/pocketbase/pb_hooks/main.pb.js` e carregamento de `shared.js`
- [x] T031 Implementar helpers de auth/middleware (`session`, `household`, `requireRole`, `requireStepUp`) em `apps/pocketbase/pb_hooks/lib/auth.js`
- [x] T032 [P] Implementar lib de auditoria (write em `audit_logs` sem dados sensíveis) em `apps/pocketbase/pb_hooks/lib/audit.js`
- [x] T033 [P] Implementar lib de rate limiting (magic-link 5/15min, 2FA 5/10min, convite 10/dia, sync 60/min) em `apps/pocketbase/pb_hooks/lib/ratelimit.js`
- [x] T034 [P] Implementar lib de criptografia AES-GCM do segredo 2FA em `apps/pocketbase/pb_hooks/lib/crypto.js`
- [x] T035 [P] Implementar writer de `change_log` em `apps/pocketbase/pb_hooks/lib/changelog.js`
- [x] T036 Implementar `POST /api/sync/push` (aplicação genérica, idempotência por `sync_id`, validação Zod, conflito LWW, tombstone vence) em `apps/pocketbase/pb_hooks/routes/sync.pb.js`
- [x] T037 Implementar `GET /api/sync/pull?since=&limit=` (delta via `change_log`, inclui soft deletes) em `apps/pocketbase/pb_hooks/routes/sync.pb.js`
- [x] T038 Implementar envelope de erro e logger estruturado em `apps/pocketbase/pb_hooks/lib/http.js`
- [x] T039 Criar migração de seed das categorias padrão BR (`system=true`) em `apps/pocketbase/pb_migrations/`

### Base do cliente (`apps/web`)

- [x] T040 [P] Definir schema Dexie e migrações locais (espelho das collections + tabelas `outbox` e `meta`) em `apps/web/src/db/schema.ts`
- [x] T041 Implementar repositórios Dexie (CRUD local + enqueue na Outbox + escrita otimista) em `apps/web/src/db/repositories.ts`
- [x] T042 Implementar HTTP client (Bearer, refresh, header `X-Step-Up-Token`, tratamento do envelope de erro) em `apps/web/src/api/client.ts`
- [x] T043 Implementar store de sessão/auth (tokens, step-up, logout) em `apps/web/src/stores/session.ts`
- [x] T044 Implementar router e guards (auth → 2FA → household) em `apps/web/src/router/index.ts`
- [x] T045 Implementar shell de UI mobile-first acessível (layout, tema, toasts, foco, ARIA) em `apps/web/src/App.vue` e `apps/web/src/components/ui/`
- [x] T046 [P] Implementar composable `useOnline` e store de sync (estado, cursor, pendências) em `apps/web/src/composables/useOnline.ts` e `apps/web/src/stores/sync.ts`
- [x] T047 Implementar helper de formatação pt-BR/R$ (Intl) em `apps/web/src/lib/format.ts`

### Testes de fundação

- [x] T048 [P] Testes unitários de dinheiro/datas no limite do mês em `packages/shared/tests/money-dates.test.ts`
- [x] T049 [P] Testes unitários do resolver de conflito LWW (incl. empate → servidor) em `packages/shared/tests/conflict.test.ts`
- [x] T050 [P] Testes de contrato dos schemas push/pull em `apps/web/tests/contract/sync-schema.test.ts`
- [x] T051 Criar harness de PocketBase efêmero (data dir temporário + migrações) e smoke test de isolamento em `apps/pocketbase/tests/harness.ts` e `apps/pocketbase/tests/isolation.test.ts`

**Checkpoint**: Fundação pronta — user stories podem começar.

---

## Phase 3: User Story 1 - Acesso seguro da família (Magic Link + 2FA step-up) (Priority: P1) 🎯 MVP

**Goal**: Login sem senha por Magic Link, 2FA TOTP step-up, dispositivos confiáveis e recovery codes.

**Independent Test**: Solicitar link, autenticar, ativar 2FA, marcar dispositivo e relogar sem novo 2FA; ação sensível exige step-up.

### Tests for User Story 1 ⚠️

- [x] T052 [P] [US1] Teste de contrato das rotas de auth em `apps/web/tests/contract/auth-api.test.ts`
- [x] T053 [P] [US1] Teste de integração: Magic Link uso único/expiração, step-up, recovery e revogação de dispositivo em `apps/pocketbase/tests/auth.test.ts`

### Implementation for User Story 1

- [x] T054 [P] [US1] Implementar lib de Magic Link (token CSPRNG, hash, expiração 10–15 min, uso único) em `apps/pocketbase/pb_hooks/lib/magic-link.js`
- [x] T055 [P] [US1] Implementar envio de e-mail (SMTP/API) em `apps/pocketbase/pb_hooks/lib/mailer.js`
- [x] T056 [US1] Implementar rotas `magic-link/request`, `magic-link/verify`, `auth/me`, `auth/logout` em `apps/pocketbase/pb_hooks/routes/auth.pb.js`
- [x] T057 [US1] Implementar TOTP (RFC 6238) + rotas `2fa/setup`, `2fa/confirm`, `2fa/verify`, `2fa/disable` (toggle exigindo step-up) em `apps/pocketbase/pb_hooks/lib/totp.js` e `routes/auth.pb.js`
- [x] T058 [US1] Implementar recovery codes (10, hash, uso único, exibidos uma vez) e regeneração (via step-up) em `apps/pocketbase/pb_hooks/lib/recovery.js`
- [x] T059 [US1] Implementar dispositivos confiáveis (token opaco, 30 dias, listar/revogar) em `apps/pocketbase/pb_hooks/routes/devices.pb.js`
- [x] T060 [US1] Implementar emissão e validação do token de step-up (`CF_STEPUP_TTL`) em `apps/pocketbase/pb_hooks/lib/stepup.js`
- [x] T061 [P] [US1] Implementar cliente de auth no web em `apps/web/src/api/auth-api.ts`
- [x] T062 [P] [US1] Implementar store de 2FA/dispositivos em `apps/web/src/stores/auth-2fa.ts`
- [x] T063 [US1] UI de login por Magic Link em `apps/web/src/features/auth/LoginView.vue`
- [x] T064 [US1] UI de configuração/verificação de 2FA e exibição única dos recovery codes em `apps/web/src/features/auth/TwoFactorView.vue`
- [x] T065 [US1] UI de gestão de dispositivos confiáveis e diálogo de step-up em `apps/web/src/features/auth/DevicesView.vue`
- [x] T066 [US1] E2E do fluxo de auth/2FA/step-up/dispositivo em `apps/web/tests/e2e/auth.spec.ts`

**Checkpoint**: US1 funcional e testável isoladamente.

---

## Phase 4: User Story 2 - Família, convites e papéis (RBAC) (Priority: P1)

**Goal**: Househould com papéis, convites de uso único e isolamento total.

**Independent Test**: Criar household, convidar `partner`, aceitar e confirmar que nenhum membro acessa dados de outra família.

### Tests for User Story 2 ⚠️

- [x] T067 [P] [US2] Teste de integração de RBAC e limite de 2 adultos em `apps/pocketbase/tests/rbac.test.ts`
- [x] T068 [P] [US2] Teste de isolamento por household em leitura e escrita em `apps/pocketbase/tests/isolation.test.ts`

### Implementation for User Story 2

- [x] T069 [US2] Implementar matriz de permissões por papel (FR-010) em `apps/pocketbase/pb_hooks/lib/permissions.js`
- [x] T070 [US2] Implementar rota `POST /households` com seed de categorias em `apps/pocketbase/pb_hooks/routes/household.pb.js`
- [x] T071 [US2] Implementar criação de convite de uso único (token CSPRNG, 15–30 min, step-up) em `apps/pocketbase/pb_hooks/routes/invites.pb.js`
- [x] T072 [US2] Implementar aceite de convite com limite rígido de 2 adultos plenos (retorno `409`) em `apps/pocketbase/pb_hooks/routes/invites.pb.js`
- [x] T073 [US2] Implementar remoção/alteração de papel (owner only; partner não altera owner) + auditoria em `apps/pocketbase/pb_hooks/routes/household.pb.js`
- [x] T074 [P] [US2] Aplicar RBAC nas operações de sync (negar e registrar fora do escopo) em `apps/pocketbase/pb_hooks/routes/sync.pb.js`
- [x] T075 [US2] Store de household/membros no web em `apps/web/src/stores/household.ts`
- [x] T076 [US2] UI de criação de household e lista de membros em `apps/web/src/features/household/HouseholdView.vue`
- [x] T077 [US2] UI de convites e papéis em `apps/web/src/features/household/InvitesView.vue`
- [x] T078 [US2] E2E de convite/RBAC/limite em `apps/web/tests/e2e/household.spec.ts`

**Checkpoint**: US1 e US2 funcionam independentemente.

---

## Phase 5: User Story 3 - Contas e lançamentos manuais (Priority: P1)

**Goal**: Cadastrar contas e lançar receitas/despesas com atribuição e status.

**Independent Test**: Criar conta e despesa; saldo e visão por atribuição refletem o lançamento.

### Tests for User Story 3 ⚠️

- [x] T079 [P] [US3] Testes unitários de cálculo de saldo e totais por atribuição em `apps/web/tests/unit/balances.test.ts`
- [x] T080 [P] [US3] Teste de integração de lançamento inválido rejeitado e soft delete + auditoria em `apps/pocketbase/tests/transactions.test.ts`

### Implementation for User Story 3

- [x] T081 [US3] Implementar regras de saldo e totais por atribuição em `packages/shared/src/domain/balances.ts`
- [x] T082 [US3] Aplicar validações de `transactions` (valor > 0, categoria obrigatória, child só próprio) em `apps/pocketbase/pb_hooks/lib/domain/transaction.js`
- [x] T083 [US3] Registro de soft delete + auditoria em exclusões de lançamento em `apps/pocketbase/pb_hooks/lib/domain/transaction.js`
- [x] T084 [P] [US3] Store de contas em `apps/web/src/stores/accounts.ts`
- [x] T085 [P] [US3] Store de transações em `apps/web/src/stores/transactions.ts`
- [x] T086 [US3] UI de contas (lista/criar/editar) em `apps/web/src/features/accounts/AccountsView.vue`
- [x] T087 [US3] UI de novo lançamento (valor primeiro, atribuição, conta/cartão, pago/a pagar, categoria) em `apps/web/src/features/transactions/NewTransactionView.vue`
- [x] T088 [US3] UI de lista de lançamentos com filtros (mês, conta, categoria, atribuição, status, cartão) em `apps/web/src/features/transactions/TransactionsView.vue`
- [x] T089 [US3] E2E de criar conta + lançamento e conferir saldo/atribuição em `apps/web/tests/e2e/transactions.spec.ts`

**Checkpoint**: US1–US3 funcionam independentemente.

---

## Phase 6: User Story 4 - Dashboard básico com 8 blocos (Priority: P1)

**Goal**: Tela inicial offline-first com os 8 blocos; os blocos "Vencimentos próximos" (US7) e "Faturas abertas" (US8) exibem estado vazio gracioso até as respectivas stories.

**Independent Test**: Com dados de US3, os blocos de saldo, saldos por conta, gastos Eu/Ela/Ambos, recentes, total a pagar e status sync exibem valores coerentes offline; vencimentos/faturas exibem estado vazio até US7/US8.

### Tests for User Story 4 ⚠️

- [x] T090 [P] [US4] Testes unitários dos seletores dos 8 blocos em `apps/web/tests/unit/dashboard-selectors.test.ts`

### Implementation for User Story 4

- [x] T091 [US4] Implementar seletores dos 8 blocos em `apps/web/src/features/dashboard/selectors.ts`
- [x] T092 [US4] UI do dashboard (saldo total, saldos por conta, gastos Eu/Ela/Ambos, vencimentos 7 dias, faturas abertas, recentes, a pagar 30 dias, status sync) em `apps/web/src/features/dashboard/DashboardView.vue`
- [x] T093 [US4] Integrar atualização reativa do dashboard após sync (sem bloquear UI) em `apps/web/src/features/dashboard/DashboardView.vue`
- [x] T094 [US4] E2E de dashboard offline e com dados em `apps/web/tests/e2e/dashboard.spec.ts`

**Checkpoint**: US1–US4 prontas (base do MVP).

---

## Phase 7: User Story 5 - Offline-first com fila Outbox e sincronização (Priority: P1)

**Goal**: Operação offline, Outbox FIFO, sincronização idempotente e conflitos previsíveis.

**Independent Test**: Offline criar/editar/excluir, reconectar e convergir sem duplicar nem ressuscitar deletados.

### Tests for User Story 5 ⚠️

- [x] T095 [P] [US5] Testes unitários da Outbox (FIFO, retry, órfãos descartados) com fake-indexeddb em `apps/web/tests/unit/outbox.test.ts`
- [x] T096 [P] [US5] Teste de integração de idempotência (`sync_id`) e conflitos LWW no servidor em `apps/pocketbase/tests/sync.test.ts`

### Implementation for User Story 5

- [x] T097 [US5] Implementar fila Outbox (enqueue, FIFO, tentativas, último erro, status) em `apps/web/src/sync/outbox.ts`
- [x] T098 [US5] Implementar pusher (lote, backoff, aplicação dos resultados `applied|conflict|ignored|error`) em `apps/web/src/sync/pusher.ts`
- [x] T099 [US5] Implementar puller (cursor `seq`, tombstone local, reconciliação) em `apps/web/src/sync/puller.ts`
- [x] T100 [US5] Implementar resolução local de conflitos e descarte de órfãos com aviso em `apps/web/src/sync/conflict.ts`
- [x] T101 [US5] Implementar sincronização automática ao reconectar + "Sincronizar agora" em `apps/web/src/stores/sync.ts`
- [x] T102 [US5] UI do indicador offline/sync (badge, contagem Outbox, último erro) em `apps/web/src/features/sync/SyncStatus.vue`
- [x] T103 [US5] E2E offline → reconectar → convergir e cenários de conflito em `apps/web/tests/e2e/offline-sync.spec.ts`

**Checkpoint**: MVP completo (US1–US5).

---

## Phase 8: User Story 6 - Transferências entre contas (Priority: P2)

**Goal**: Movimentar valores entre contas sem afetar receita/despesa.

**Independent Test**: Transferir e verificar saldos; totais de receita/despesa inalterados.

### Tests for User Story 6 ⚠️

- [x] T104 [P] [US6] Testes unitários da regra de transferência (não afeta receita/despesa; origem ≠ destino) em `packages/shared/tests/transfer.test.ts`

### Implementation for User Story 6

- [x] T105 [US6] Implementar regra de transferência (transações origem/destino) em `packages/shared/src/domain/transfer.ts`
- [x] T106 [US6] Aplicar validação server-side de transferência em `apps/pocketbase/pb_hooks/lib/domain/transfer.js`
- [x] T107 [US6] UI de transferência em `apps/web/src/features/transfers/TransferView.vue`
- [x] T108 [US6] E2E de transferência em `apps/web/tests/e2e/transfers.spec.ts`

**Checkpoint**: US6 funcional independentemente.

---

## Phase 9: User Story 7 - Contas fixas e variáveis (Priority: P2)

**Goal**: Contas a pagar/receber fixas/variáveis com status e totais previstos.

**Independent Test**: Cadastrar fixas/variáveis e conferir pendentes/pagas e totais do mês.

### Tests for User Story 7 ⚠️

- [x] T109 [P] [US7] Testes unitários de totais previstos por tipo/atribuição em `packages/shared/tests/bills.test.ts`

### Implementation for User Story 7

- [x] T110 [US7] Implementar totais previstos de contas em `packages/shared/src/domain/bills.ts`
- [x] T111 [US7] Aplicar validações e transições de `bills` (pendente→pago/cancelado, reativação auditada) em `apps/pocketbase/pb_hooks/lib/domain/bill.js`
- [x] T112 [US7] Store/Ui de contas a pagar (a pagar/pagas, tipo, atribuição, totais) em `apps/web/src/features/bills/BillsView.vue`
- [x] T113 [US7] E2E de contas fixas/variáveis em `apps/web/tests/e2e/bills.spec.ts`

**Checkpoint**: US7 funcional independentemente.

---

## Phase 10: User Story 8 - Cartões de crédito com faturas e parcelas (Priority: P2)

**Goal**: Cartões, faturas por ciclo (linha de corte inclusiva) e parcelas rateadas.

**Independent Test**: Lançar compra no fechamento e parcelada; parcelas distribuem uma por ciclo.

### Tests for User Story 8 ⚠️

- [x] T114 [P] [US8] Testes unitários do ciclo de fatura (linha de corte inclusiva, compra no fechamento, clamp de mês) em `packages/shared/tests/invoice-cycle.test.ts`
- [x] T115 [P] [US8] Testes unitários do rateio de parcelas (soma = compra; uma por ciclo) em `packages/shared/tests/installments.test.ts`
- [x] T116 [P] [US8] Teste de integração de transições de fatura (aberta→fechada→paga; vencida) em `apps/pocketbase/tests/invoices.test.ts`

### Implementation for User Story 8

- [x] T117 [US8] Implementar regra de ciclo/fatura (closing/due day, alocação) em `packages/shared/src/domain/invoice.ts`
- [x] T118 [US8] Implementar geração de parcelas e alocação por fatura em `packages/shared/src/domain/installments.ts`
- [x] T119 [US8] Aplicar cálculo/alocação server-side (fatura e parcelas) em `apps/pocketbase/pb_hooks/lib/domain/invoice.js`
- [x] T120 [US8] Aplicar transições de status de fatura em `apps/pocketbase/pb_hooks/lib/domain/invoice.js`
- [x] T121 [US8] Store de cartões/faturas no web em `apps/web/src/stores/cards.ts`
- [x] T122 [US8] UI de cartões/faturas (abertas/fechadas/pagas/vencidas) em `apps/web/src/features/cards/CardsView.vue`
- [x] T123 [US8] UI de compra parcelada no novo lançamento em `apps/web/src/features/transactions/NewTransactionView.vue`
- [x] T124 [US8] E2E de cartão/fatura/parcela em `apps/web/tests/e2e/cards.spec.ts`

**Checkpoint**: US8 funcional independentemente.

---

## Phase 11: User Story 9 - Categorias padrão em pt-BR (Priority: P2)

**Goal**: Seed BR com categorias de sistema não excluíveis.

**Independent Test**: Novo household já tem categorias; sistema não exclui; custom exclui.

### Tests for User Story 9 ⚠️

- [x] T125 [P] [US9] Teste de integração do seed e da regra `system=true` não excluível em `apps/pocketbase/tests/categories.test.ts`

### Implementation for User Story 9

- [x] T126 [US9] Definir categorias seed BR por grupo/tipo em `packages/shared/src/constants/categories-seed.ts`
- [x] T127 [US9] Aplicar regra de não exclusão de categoria de sistema + auditoria em `apps/pocketbase/pb_hooks/lib/domain/category.js`
- [x] T128 [US9] UI de gestão de categorias (editar/ocultar/criar custom) em `apps/web/src/features/categories/CategoriesView.vue`
- [x] T129 [US9] E2E de categorias em `apps/web/tests/e2e/categories.spec.ts`

**Checkpoint**: US9 funcional independentemente.

---

## Phase 12: User Story 10 - App Lock com biometria (opcional) (Priority: P3)

**Goal**: Bloqueio local por WebAuthn Platform Auth após inatividade.

**Independent Test**: Ativar com 1 min e confirmar reautenticação biométrica ao retornar.

### Tests for User Story 10 ⚠️

- [x] T130 [P] [US10] Testes unitários do controle de inatividade/estado do lock em `apps/web/tests/unit/app-lock.test.ts`

### Implementation for User Story 10

- [x] T131 [US10] Implementar composable `useAppLock` (WebAuthn Platform Auth + tempo de inatividade) em `apps/web/src/composables/useAppLock.ts`
- [x] T132 [US10] UI de configuração do App Lock e tela de desbloqueio em `apps/web/src/features/settings/AppLockView.vue`
- [x] T133 [US10] Tratar indisponibilidade de biometria com aviso sem bloqueio em `apps/web/src/composables/useAppLock.ts`
- [x] T134 [US10] E2E de App Lock em `apps/web/tests/e2e/app-lock.spec.ts`

**Checkpoint**: Todas as user stories independentemente funcionais.

---

## Phase 13: Polish & Cross-Cutting Concerns

**Purpose**: Endurecimento, observabilidade, acessibilidade e validação final

- [x] T135 [P] Revisar acessibilidade (teclado, foco, contraste, ARIA) em todas as telas do MVP
- [x] T136 [P] Garantir formatação pt-BR/R$ e textos em português em `apps/web/src/lib/format.ts` e views
- [x] T137 [P] Revisar logs estruturados de sync/auth/ações sensíveis (sem segredos) em `apps/pocketbase/pb_hooks/lib/`
- [x] T138 [P] Adicionar/verificar rate limiting e CORS allowlist em `apps/pocketbase/pb_hooks/lib/ratelimit.js` e config
- [x] T139 [P] Ajustar prompt de atualização do PWA para não interromper sync em `apps/web/vite.config.ts`
- [x] T140 Revisar idempotência e casos de borda de sync (reenvio, tombstone, pull com soft delete) e ampliar testes em `apps/pocketbase/tests/sync.test.ts`
- [x] T141 [P] Documentar variáveis de ambiente e deploy (Cloudflare Pages/Vercel + Docker/VPS) em `README.md` e `docker/`
- [x] T142 Executar `quickstart.md` (cenários V1–V9) e registrar evidências
- [x] T143 Rodar `pnpm lint`, `pnpm typecheck` e todas as suítes de teste; corrigir pendências
- [x] T144 [P] Verificar conformidade com a constituição (isolamento, TS strict, Zod server-side, soft delete, auditoria) e registrar no PR

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: sem dependências.
- **Foundational (Phase 2)**: depende do Setup — BLOQUEIA todas as user stories.
- **User Stories (Phase 3+)**: dependem da Fase 2.
- **Polish (Fase 13)**: depende das stories desejadas.

### User Story Dependencies

- **US1 (P1)**: sem dependência de outras stories (após Fase 2).
- **US2 (P1)**: depende de US1 (sessão/step-up) para convites e RBAC.
- **US3 (P1)**: depende da Fase 2 (sync/Dexie) e de US2 (household).
- **US4 (P1)**: depende de US3; integra com US5 (atualização pós-sync), US7 (vencimentos) e US8 (faturas); blocos dependentes degradam graciosamente até lá.
- **US5 (P1)**: base de sync genérica já na Fase 2; entrega comportamento offline/conflito.
- **US6, US7, US9 (P2)**: dependem de US3 (contas/transações/categorias).
- **US8 (P2)**: depende de US3 (lançamentos) e US5 (sync).
- **US10 (P3)**: depende de US1 (sessão).

### Within Each User Story

- Testes antes da implementação (falham primeiro).
- Schemas/regras puras antes de hooks; hooks antes de UI; UI antes de E2E.

### Parallel Opportunities

- Setup: T003–T012 em paralelo.
- Foundational: schemas (T015–T022), migrações (T025–T028), libs de hooks (T032–T035), base web (T040, T046) e testes (T048–T050) em paralelo.
- User stories com capacidade de time: US1, US5 e US9 podem avançar em paralelo após a Fase 2; US3/US6/US7/US8 compartilham o domínio financeiro.

---

## Parallel Example: Foundational

```bash
# Schemas em paralelo:
Task: "Schemas de entidades de identidade em packages/shared/src/entities/household.ts"
Task: "Schemas de entidades financeiras em packages/shared/src/entities/finance.ts"
Task: "Schemas de movimentações em packages/shared/src/entities/movements.ts"

# Libs de hooks em paralelo:
Task: "Auditoria em apps/pocketbase/pb_hooks/lib/audit.js"
Task: "Rate limiting em apps/pocketbase/pb_hooks/lib/ratelimit.js"
Task: "Criptografia AES-GCM em apps/pocketbase/pb_hooks/lib/crypto.js"
```

---

## Implementation Strategy

### MVP First

1. Fase 1 (Setup) → Fase 2 (Foundational) → US1 → US2 → US3 → US4 → US5.
2. **STOP e VALIDAR** cada story; US1–US5 formam o MVP (Fases 1–4 do plano).
3. Deploy/demo.

### Incremental Delivery

1. Fundação pronta → US1 (auth) → validar.
2. US2 (família) → US3 (lançamentos) → US4 (dashboard) → US5 (offline/sync).
3. P2: US6 → US7 → US8 → US9.
4. P3: US10 (App Lock).
5. Polish e validação do `quickstart.md`.

### Parallel Team Strategy

1. Time completa Setup + Foundational junto.
2. Depois: Dev A = US1/US2; Dev B = US3/US4; Dev C = US5; Dev D = US8.
3. Stories integram via contrato de `@cf/shared` e sync API.

---

## Addendum: Correções dos gaps de análise

**Origem**: `checklists/security-sync-cards.md` + `/speckit.analyze`. Cobrem FR-057/FR-058/FR-059 e NFR-015.

- [x] T145 [US1] Implementar resposta a incidente de segurança (bloqueio 5 falhas/15min, revogação de sessões/dispositivos, e-mail, auditoria) em `apps/pocketbase/pb_hooks/lib/security-response.js` (FR-057/NFR-015)
- [x] T146 [US5] Exibir conflitos `conflict=true` no indicador de sync com revisão/aceite em `apps/web/src/features/sync/ConflictPanel.vue` (FR-058)
- [x] T147 [US8] Recalcular fatura ao editar/excluir lançamento vinculado em `apps/pocketbase/pb_hooks/lib/domain/invoice.js` (FR-059)
- [x] T148 [US8] Testes de clamp de mês/ano bissexto e de não dupla contagem de cartão em `packages/shared/tests/invoice-cycle.test.ts`
- [x] T149 [US1] Teste da resposta a incidentes de segurança em `apps/pocketbase/tests/auth.test.ts`
- [x] T150 [US8] Teste de edição/exclusão de lançamento em fatura (recálculo) em `apps/pocketbase/tests/invoices.test.ts`

---

## Notes

- `[P]` = arquivos diferentes, sem dependência pendente.
- `[Story]` mapeia a tarefa à user story para rastreabilidade.
- Testes das regras de negócio são obrigatórios (Princípio IV): fatura/parcelas,
  transferências, sync/conflitos e isolamento.
- Commit após cada tarefa ou grupo lógico; parar em checkpoints para validar a story.
- Evitar dependências entre stories que quebrem a independência.
