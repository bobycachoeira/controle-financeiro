# Data Model — Integrações, Multimoeda e Passkeys

## exchange_rates

| Campo | Tipo | Regras |
|-------|------|--------|
| `household` | relation | obrigatório |
| `currency` | text | ISO (ex.: `USD`), ≠ base |
| `date` | date | data da cotação |
| `rate_micros` | number | inteiro; taxa × 1.000.000 (1 USD = 5,20 → 5.200.000) |
| sync fields | — | `sync_id`, `updated_by`, `deleted_at` |

**Índice único**: `(household, currency, date)`.

## transactions (campos novos)

| Campo | Tipo | Regras |
|-------|------|--------|
| `origin` | select | `manual \| import \| recurrence` (default `manual`) |
| `external_ref` | text | referência externa (`FITID`/hash) para idempotência |

## Regras de negócio (shared)

`domain/import.ts`:
- `detectFormat(text): "csv" | "ofx" | null`
- `parseCSV(text): ParsedImportRow[]` (detecta `,`/`;`, cabeçalho, datas pt-BR)
- `parseOFX(text): ParsedImportRow[]` (SGML/XML)
- `ParsedImportRow { date, amountCents, description, nature, externalRef, error? }`

`domain/currency.ts`:
- `convertCents(cents, rateMicros): number` = `Math.round(cents * rateMicros / 1e6)`
- `pickRate(rates, currency, date): rateMicros | null` (mais recente ≤ data)
- `consolidateToBRL(entries, rates): { totalCents, missing: string[] }`

## Passkeys / Open Finance

- `users.webauthn_credentials` (JSON) já existe — estrutura preparada.
- Feature-flag `CF_OPEN_FINANCE_ENABLED` exposta em `GET /api/settings/features`.
