# Implementation Plan: Recorrências (RRULE) e Orçamentos por Categoria

**Branch**: `003-recurrences-budgets` | **Date**: 2026-10-02 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/003-recurrences-budgets/spec.md`

## Summary

Entregar a Fase 6: recorrências no padrão RRULE (RFC 5545) que geram automaticamente
lançamentos e contas a pagar/receber de forma idempotente, e orçamentos por categoria com
acompanhamento de gasto e alertas de aproximação/estouro. Recorrências e orçamentos são
entidades sincronizáveis (mesmo motor de sync das fases anteriores) e a geração roda no
backend via rotina diária.

**Abordagem técnica**: as regras de recorrência usam a biblioteca `rrule` dentro de
`@cf/shared`, empacotada para os hooks do PocketBase. Os hooks adicionam um cron diário que
calcula as ocorrências vencidas e cria transações/bills, marcando `last_run`/`next_run` e
evitando duplicatas por `(recurrence, data)`. Orçamentos são calculados no cliente com
funções puras em `@cf/shared` (gasto por categoria/período) e persistidos como entidade
sincronizável.

## Technical Context

**Language/Version**: TypeScript 5.4+ (web/shared), PocketBase 0.23+ (hooks JS em Goja).

**Primary Dependencies**: `rrule` 2.x (RRULE), Zod, Vue 3/Pinia/Dexie, `@cf/shared`.

**Storage**: PocketBase SQLite; novas collections `recurrences` e `budgets`; espelho local
em Dexie.

**Testing**: Vitest (regras RRULE e orçamento em `@cf/shared`), integração PocketBase
efêmero (sync/isolamento + geração idempotente), E2E Playwright (criar recorrência,
orçamento e verificar alerta).

**Target Platform**: PWA + backend Linux (Docker/VPS).

**Project Type**: Web application (PWA + PocketBase), reutilizando o monorepo.

**Performance Goals**: geração diária processa o household em segundos; cálculo de
orçamento < 50 ms sobre o cache local.

**Constraints**: fuso `America/Sao_Paulo`; geração idempotente; valores em centavos; BRL;
isolamento por `household`.

**Scale/Scope**: MVP 2–6 membros, dezenas de recorrências e orçamentos por household.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Princípio | Gate | Status |
|-----------|------|--------|
| I. Segurança/Privacidade | Entidades isoladas por `household` via sync/RBAC; geração server-side; auditoria de execuções. | PASS |
| II. Offline-First | Recorrências/orçamentos sincronizáveis; geração no servidor; cliente continua offline-first. | PASS |
| III. Qualidade/Tipagem | Schemas Zod em `@cf/shared` no cliente e nos hooks; TS strict. | PASS |
| IV. Testes de Regras | RRULE, idempotência e orçamento com testes dedicados. | PASS |
| V. Simplicidade | Reutiliza sync e o contrato existentes; sem novo serviço. | PASS |
| VI. UX Mobile-First/a11y/pt-BR | Telas acessíveis, pt-BR e valores em R$. | PASS |
| VII. Observabilidade/Versionamento | `last_run`/`next_run` e logs de geração; API versionada. | PASS |

## Project Structure

### Documentation (this feature)

```text
specs/003-recurrences-budgets/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   └── recurrences-budgets.md
└── tasks.md
```

### Source Code (repository root)

```text
packages/shared/src/domain/
├── recurrence.ts          # RRULE + ocorrências/idempotência
└── budget.ts              # gasto por categoria/período e alertas
apps/pocketbase/
├── pb_migrations/         # recurrences, budgets
├── pb_hooks/lib/handlers/recurrences.js  # geração (cron)
└── tests/recurrences.test.ts, budgets.test.ts
apps/web/src/
├── stores/recurrences.ts, stores/budgets.ts
├── features/recurrences/RecurrencesView.vue
├── features/budgets/BudgetsView.vue
└── tests/{unit,contract,e2e}/
```

## Testing Strategy

1. `pnpm test:shared`: RRULE (frequência/intervalo/limites, clamp de dia) e cálculo de
   orçamento (período, alertas, arredondamento).
2. `pnpm test:pb`: sync das novas entidades, isolamento, geração idempotente e limites.
3. `pnpm test:e2e`: criar recorrência/orçamento e verificar alerta.

## Complexity Tracking

> Sem violações. Nenhuma entrada necessária.
