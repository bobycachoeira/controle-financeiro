---
description: "Task list for Integrações, Multimoeda e Passkeys (Fase 7)"
---

# Tasks: Integrações, Multimoeda e Passkeys

**Input**: `/specs/004-integrations-multicurrency/`

**Tests**: Obrigatórios (Princípio IV).

## Phase 1: Setup

- [x] T001 Definir schema Zod de `exchange_rates` e campos `origin`/`external_ref` em `packages/shared`
- [x] T002 [P] Adicionar `exchange_rates` às entidades sincronizáveis (`constants/sync.ts`)

## Phase 2: Foundational

- [x] T003 Implementar `packages/shared/src/domain/import.ts` (detect, parseCSV, parseOFX)
- [x] T004 Implementar `packages/shared/src/domain/currency.ts` (convert, pickRate, consolidate)
- [x] T005 [P] Testes de import em `packages/shared/tests/import.test.ts`
- [x] T006 [P] Testes de moeda em `packages/shared/tests/currency.test.ts`
- [x] T007 Migração `exchange_rates` + campos em `transactions` em `apps/pocketbase/pb_migrations/`
- [x] T008 Incluir `exchange_rates` no sync e no schema map dos hooks
- [x] T009 [P] Teste de integração (sync `exchange_rates` + campos de import) em `apps/pocketbase/tests/integrations.test.ts`
- [x] T010 Rota pública de feature-flags em `apps/pocketbase/pb_hooks/lib/handlers/features.js`
- [x] T011 Tabela Dexie `exchange_rates` em `apps/web/src/db/schema.ts` e repositórios

## Phase 3: User Story 1 - Importar CSV/OFX (P1)

- [x] T012 [US1] Store de importação em `apps/web/src/stores/import.ts`
- [x] T013 [US1] UI de importação (prévia/confirmar) em `apps/web/src/features/import/ImportView.vue`
- [x] T014 [US1] Rota e link no `MoreView`
- [x] T015 [P] [US1] E2E de importação em `apps/web/tests/e2e/import.spec.ts`

## Phase 4: User Story 2 - Multimoeda (P2)

- [x] T016 [US2] Store de cotações em `apps/web/src/stores/rates.ts`
- [x] T017 [US2] UI de cotações e exibição consolidada em `apps/web/src/features/settings/CurrenciesView.vue`
- [x] T018 [US2] Conversão no dashboard/seletores
- [x] T019 [P] [US2] Teste unitário dos seletores de conversão
- [x] T020 [US2] E2E de cotações

## Phase 5: US3/US4 - Passkeys e Open Finance (P3)

- [ ] T021 [US3] Cadastro/listagem/revogação de passkey (cliente) em `apps/web/src/features/auth/PasskeysView.vue`
- [ ] T022 [US3] Preparar verificação server-side de passkey no step-up (adiado)
- [x] T023 [US4] Feature-flag de Open Finance na UI e rota de flags
- [ ] T024 [US4] Conexão Open Finance real (provedor) — adiado

## Phase 6: Polish

- [x] T025 Atualizar README/quickstart
- [x] T026 Executar `pnpm lint`, `pnpm typecheck` e suítes
- [x] T027 Verificar conformidade com a constituição

## Notes
- US1/US2 são entregues integralmente.
- US3 (verificação server-side de passkey) e US4 (conexão real) dependem de
  runtime/provedor externos e ficam preparados/feature-flagged.
