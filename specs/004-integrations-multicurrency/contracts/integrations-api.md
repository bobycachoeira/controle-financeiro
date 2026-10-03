# Contrato — Integrações, Multimoeda e Passkeys

Entidades `exchange_rates` são sincronizáveis pelas rotas existentes:

- `POST /api/sync/push` / `GET /api/sync/pull` para `exchange_rates`
  (schema Zod, isolamento por `household`).

Feature flags (público):

- `GET /api/settings/features` → `{ open_finance_enabled: boolean, passkeys_enabled: boolean }`

A importação CSV/OFX é processada no cliente (parsers em `@cf/shared`) e confirmada via
`/sync/push` como transações com `origin="import"` e `external_ref`.

## Schemas

```ts
exchangeRateSchema = { id, household, sync_id, currency, date, rate_micros }

transactionSchema += {
  origin?: "manual" | "import" | "recurrence",
  external_ref?: string | null
}
```

## Efeitos observáveis

- Reimportar o mesmo arquivo não cria duplicatas (por `external_ref`).
- Totais consolidados em BRL usam a cotação da data (ou a anterior mais próxima).
- Sem cotação, o total sinaliza pendência sem quebrar os demais.
