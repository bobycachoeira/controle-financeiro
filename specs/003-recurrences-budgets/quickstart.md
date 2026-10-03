# Quickstart & Validação — Recorrências e Orçamentos

## Pré-requisitos

- Node.js 20 LTS + pnpm 9+; binário do PocketBase 0.23+ em `apps/pocketbase/pocketbase`.

## Setup / execução

```bash
pnpm install
pnpm build:hooks
cd apps/pocketbase && ./pocketbase serve --http=127.0.0.1:8090
pnpm --filter @cf/web dev
```

A geração de recorrências roda na rotina diária do backend (hooks/cron).

## Comandos de teste

| Comando | Escopo |
|---------|--------|
| `pnpm test:shared` | RRULE (frequência/intervalo/limites/clamp) e orçamento (período/alertas) |
| `pnpm test:pb` | Sync/isolamento das novas entidades e geração idempotente |
| `pnpm test:e2e` | Criar recorrência/orçamento e verificar alerta |

## Cenários de validação

### R1 — Recorrência mensal

1. Criar recorrência `FREQ=MONTHLY;INTERVAL=1` com início no passado e modelo de despesa.
2. Executar a geração.
3. **Esperado**: um lançamento por ocorrência vencida; `next_run` avançado; sem duplicar em
   nova execução.

### R2 — Limites

1. Criar recorrência com `COUNT=3` (ou `UNTIL`).
2. **Esperado**: no máximo 3 ocorrências; nenhuma além do limite.

### R3 — Dia inexistente

1. Recorrência no dia 31, iniciando em janeiro.
2. **Esperado**: fevereiro usa o último dia (28/29), sem erro.

### R4 — Recorrência de conta a pagar

1. Criar recorrência `target=bill`.
2. **Esperado**: contas pendentes com vencimento conforme a regra; aparecem nos totais.

### R5 — Orçamento e alertas

1. Criar orçamento mensal com limite e `alerta_pct=80`.
2. Lançar despesas na categoria até 80% e depois ultrapassar 100%.
3. **Esperado**: status `ok → alerta → estouro`; percentual e gasto corretos.

## Critérios de pronto

- `pnpm lint`, `pnpm typecheck` e `pnpm test:shared|web|pb|e2e` verdes.
- 0 duplicatas de geração; 0 ocorrências além do limite.
