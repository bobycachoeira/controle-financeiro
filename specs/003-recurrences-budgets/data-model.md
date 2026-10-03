# Data Model — Recorrências e Orçamentos

**Fase 1** — novas collections no PocketBase espelhadas no Dexie.

## Recurrences

| Campo | Tipo | Regras |
|-------|------|--------|
| `household` | relation | obrigatório |
| `name` | text | 1–80 |
| `rrule` | text | regra RRULE (RFC 5545), obrigatória |
| `timezone` | text | default `America/Sao_Paulo` |
| `start_date` | date | data inicial |
| `end_date` | date | nullable (UNTIL alternativo) |
| `count` | number | nullable (número de ocorrências) |
| `active` | bool | default `true` |
| `last_run` | date | última ocorrência processada |
| `next_run` | date | próxima ocorrência prevista |
| `target` | select | `transaction \| bill` |
| `creates_status` | select | `pago \| a_pagar` (para transaction) |
| `template` | json | modelo: `amount_cents`, `type`, `account`, `credit_card`, `category`, `attribution`, `nature`, `description`, `payer_user` |
| sync fields | — | `sync_id`, `updated_by`, `deleted_at` |

**Validações**: `rrule` deve iniciar com `FREQ=` e ser parseável; `amount_cents > 0`;
`target=bill` requer `nature`; `target=transaction` requer `account` e `type`.

## Budgets

| Campo | Tipo | Regras |
|-------|------|--------|
| `household` | relation | obrigatório |
| `name` | text | 1–80 |
| `period` | select | `mensal \| trimestral \| anual` |
| `currency` | text | default `BRL` |
| `total_cents` | number | inteiro > 0 |
| `alert_pct` | number | 1–100, default 80 |
| `active` | bool | default `true` |
| `reference_month` | text | `YYYY-MM` (base do período) |
| `categories` | json | `[{ category, limit_cents? }]` |
| sync fields | — | padrão |

**Validações**: `alert_pct` entre 1 e 100; `total_cents > 0`; ao menos uma categoria.

## Regras de negócio (shared)

`domain/recurrence.ts`:
- `parseRecurrence(rrule, dtstart, options): RecurrenceRule`
- `occurrencesBetween(rule, afterISO, untilISO): string[]` (clamp de dia).
- `nextOccurrence(rule, fromISO): string | null`.
- `isValidRRule(rrule): boolean`.

`domain/budget.ts`:
- `budgetPeriodRange(period, referenceMonth): { start, end }`.
- `computeBudgetUsage(budget, transactions): { totalSpentCents, percent, perCategory, status }`
  com `status ∈ { ok, alerta, estouro }`.

## Impacto em entidades existentes

- `transactions`: usa `recurrence` (texto) para vincular a ocorrência gerada + `date`.
- `bills`: usa `recurrence` (texto) + `due_date`.
