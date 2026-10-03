# Contrato — Recorrências e Orçamentos

Não há endpoints HTTP novos. As entidades `recurrences` e `budgets` são sincronizáveis
pelas rotas existentes (feature 001):

- `POST /api/sync/push` — operações `create|update|delete` para `recurrences` e `budgets`
  (validação Zod server-side; isolamento por `household`).
- `GET /api/sync/pull?since=` — delta das novas entidades (soft deletes incluídos).

A geração de ocorrências não expõe rota: roda em rotina diária no backend e cria
`transactions`/`bills` com vínculo `recurrence`.

## Schemas (Zod em `@cf/shared`)

```ts
recurrenceSchema = {
  id, household, sync_id,
  name, rrule, timezone?,
  start_date, end_date?, count?,
  active, last_run?, next_run?,
  target: "transaction" | "bill",
  creates_status: "pago" | "a_pagar",
  template: {
    amount_cents, type, account?, credit_card?, category?,
    attribution, nature?, description?, payer_user?
  }
}

budgetSchema = {
  id, household, sync_id,
  name, period: "mensal" | "trimestral" | "anual",
  currency?, total_cents, alert_pct, active, reference_month,
  categories: [{ category, limit_cents? }]
}
```

## Efeitos observáveis

- `recurrences.next_run`/`last_run` refletem a última execução.
- Lançamentos/contas gerados aparecem no `pull` como qualquer outro registro.
- Alterar/desativar/excluir recorrência interrompe gerações futuras; registros já criados
  permanecem (FR-015).
