---
description: "Task list for Recorrências (RRULE) e Orçamentos por Categoria (Fase 6)"
---

# Tasks: Recorrências (RRULE) e Orçamentos por Categoria

**Input**: Design documents from `/specs/003-recurrences-budgets/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/

**Tests**: Obrigatórios (Princípio IV): RRULE, idempotência da geração, cálculo de
orçamento e isolamento por `household`.

## Format: `[ID] [P?] [Story] Description`

---

## Phase 1: Setup

- [x] T001 Adicionar a dependência `rrule` em `packages/shared/package.json` e ao bundle dos hooks
- [x] T002 Definir enums/schemas Zod de `recurrences` e `budgets` em `packages/shared/src/entities/`

## Phase 2: Foundational

- [x] T003 Implementar `packages/shared/src/domain/recurrence.ts` (parse, ocorrências, próximo, clamp)
- [x] T004 Implementar `packages/shared/src/domain/budget.ts` (período, gasto, status/alerta)
- [x] T005 [P] Testes de RRULE em `packages/shared/tests/recurrence.test.ts`
- [x] T006 [P] Testes de orçamento em `packages/shared/tests/budget.test.ts`
- [x] T007 Migração das collections `recurrences` e `budgets` em `apps/pocketbase/pb_migrations/`
- [x] T008 Incluir `recurrences`/`budgets` no sync (entidades, schema map e RBAC) em `apps/pocketbase/pb_hooks/lib/handlers/sync.js` e `packages/shared`
- [x] T009 Gerar ocorrências (cron diário) em `apps/pocketbase/pb_hooks/lib/handlers/recurrences.js` e registrar cron em `main.pb.js`
- [x] T010 [P] Teste de integração da geração idempotente em `apps/pocketbase/tests/recurrences.test.ts`
- [x] T011 [P] Teste de integração de orçamento/sync em `apps/pocketbase/tests/budgets.test.ts`
- [x] T012 Tabelas locais `recurrences`/`budgets` no Dexie em `apps/web/src/db/schema.ts`
- [x] T013 [P] Store de recorrências em `apps/web/src/stores/recurrences.ts`
- [x] T014 [P] Store de orçamentos em `apps/web/src/stores/budgets.ts`

---

## Phase 3: User Story 1 - Recorrências (P1)

- [x] T015 [US1] UI de recorrências (criar/editar/ativar/excluir) em `apps/web/src/features/recurrences/RecurrencesView.vue`
- [x] T016 [US1] Rota e link em `MoreView` para recorrências
- [x] T017 [P] [US1] Testes unitários do store/validação de recorrência
- [x] T018 [US1] E2E de recorrência em `apps/web/tests/e2e/recurrences.spec.ts`

---

## Phase 4: User Story 2 - Orçamentos (P1)

- [x] T019 [US2] UI de orçamentos com gasto/percentual/alertas em `apps/web/src/features/budgets/BudgetsView.vue`
- [x] T020 [US2] Rota e link em `MoreView` para orçamentos
- [x] T021 [P] [US2] Testes unitários dos seletores de orçamento
- [x] T022 [US2] E2E de orçamento em `apps/web/tests/e2e/budgets.spec.ts`

---

## Phase 5: User Story 3 - Recorrência de contas (P2)

- [x] T023 [US3] Suporte a `target=bill` na geração e na UI
- [x] T024 [P] [US3] Teste de integração da geração de bills por recorrência

---

## Phase 6: Polish

- [x] T025 Atualizar README/quickstart com recorrências e orçamentos
- [x] T026 Executar `pnpm lint`, `pnpm typecheck` e todas as suítes; corrigir pendências
- [x] T027 Verificar conformidade com a constituição (idempotência, isolamento, limites)

## Dependencies & Execution Order

- Setup → Fundação (T003–T014) bloqueia as user stories.
- US1 e US2 podem avançar em paralelo após a Fundação; US3 depende de US1.

## Notes

- A geração é idempotente por `(recurrence, data de competência)`.
- Orçamento considera despesas do período (pago + a pagar), em centavos.
