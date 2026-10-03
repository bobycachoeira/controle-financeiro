# Quickstart & Validação — Integrações, Multimoeda e Passkeys

## Comandos

```bash
pnpm install && pnpm build:hooks
cd apps/pocketbase && ./pocketbase serve --http=127.0.0.1:8090
pnpm --filter @cf/web dev
```

| Comando | Escopo |
|---------|--------|
| `pnpm test:shared` | Parsers CSV/OFX, idempotência e conversão de moeda |
| `pnpm test:pb` | Sync de `exchange_rates` e campos de importação |
| `pnpm test:e2e` | Importar extrato e cadastrar cotação |

## Cenários

### I1 — Importar CSV
1. Colar/selecionar CSV com cabeçalho (data;valor;descrição).
2. **Esperado**: prévia com itens válidos/ inválidos; confirmar cria transações na conta.

### I2 — Importar OFX
1. Importar OFX com `<STMTTRN>`.
2. **Esperado**: lançamentos reconhecidos; reimportar não duplica (`FITID`).

### I3 — Multimoeda
1. Criar conta USD; cadastrar cotação da data; lançar despesa.
2. **Esperado**: total consolidado em BRL = valor × cotação; sem cotação, sinaliza.

### I4 — Open Finance (flag)
1. Com a flag desligada, não há opção; ligada sem provedor, mostra indisponível.

## Critérios de pronto
- `pnpm lint`, `pnpm typecheck` e suítes verdes.
- 0 duplicatas ao reimportar; totais corretos ao centavo.
