# Quickstart & Validação — Controle Financeiro Familiar Offline-First

Guia para subir o ambiente e validar o MVP end-to-end. Não substitui `tasks.md`; descreve
como provar que a feature funciona. Detalhes de modelagem em
[`data-model.md`](./data-model.md) e contratos em [`contracts/`](./contracts/).

## Pré-requisitos

- Node.js 20 LTS + pnpm 9+.
- Binário do PocketBase 0.23+ (baixado do release oficial) — não versionado.
- Docker + Docker Compose (opcional para o backend).
- Navegador Chromium para testes; Playwright instalado.

## Estrutura e setup

```bash
# 1) Instalar dependências do monorepo
pnpm install

# 2) Gerar o bundle de schemas/regras para os hooks do PocketBase
pnpm --filter @cf/shared build:hooks   # esbuild -> apps/pocketbase/pb_hooks/lib/shared.js

# 3) Variáveis de ambiente
cp apps/pocketbase/.env.example apps/pocketbase/.env
cp apps/web/.env.example apps/web/.env.local
# Variáveis do backend:
#   CF_ENCRYPTION_KEY   chave 32 bytes (hex/base64) para AES-GCM do segredo 2FA
#   CF_MAIL_*           SMTP/API de e-mail para Magic Link
#   CF_CORS_ORIGINS     allowlist do front (ex.: http://localhost:5173)
#   CF_STEPUP_TTL       validade do token de step-up (ex.: 10m)
```

## Executando

```bash
# Backend (PocketBase com migrações)
cd apps/pocketbase && ./pocketbase serve --http=127.0.0.1:8090
# ou: docker compose -f docker/docker-compose.yml up

# Front (Vite)
pnpm --filter @cf/web dev            # http://localhost:5173
```

As migrações em `apps/pocketbase/pb_migrations` criam collections, índices, a tabela
`change_log` e o seed de categorias padrão.

## Comandos de teste

| Comando | Escopo |
|---------|--------|
| `pnpm lint && pnpm typecheck` | ESLint + `vue-tsc --noEmit` (TS strict) |
| `pnpm test:shared` | Regras puras: fatura/parcelas, transferência, conflito, dinheiro |
| `pnpm test:web` | Dexie/Offline, Outbox, stores (fake-indexeddb) |
| `pnpm test:contract` | Schemas de `@cf/shared` vs respostas da API |
| `pnpm test:pb` | Integração PocketBase efêmero: isolamento, RBAC, idempotência |
| `pnpm test:e2e` | Playwright: auth/2FA, offline+sync, conflitos, dashboard |

## Cenários de validação end-to-end

Cada cenário lista a evidência esperada. Os IDs referenciam a spec.

### V1 — Onboarding seguro (FR-001..FR-007)

1. Solicitar Magic Link para um e-mail; consumir o link; se 2FA ativo, informar TOTP.
2. Criar household; verificar seed de categorias (FR-048).
3. **Esperado**: sessão criada; reenvio do link falha (`410`); dispositivo marcado como
   confiável reloga sem 2FA; ação sensível exige step-up (`403 step_up_required`).

### V2 — Isolamento e RBAC (FR-009..FR-015)

1. Criar duas famílias A e B; convidar `partner` para A.
2. Autenticado em B, tentar ler/escrever dados de A via `/sync/pull|push`.
3. **Esperado**: operação negada (`403`) e registrada em `audit_logs`; nenhum dado vaza.
4. Convidar um 3º adulto para A. **Esperado**: `409` (limite de 2 adultos plenos).

### V3 — Contas, lançamentos e transferências (FR-016..FR-025)

1. Criar conta corrente e poupança; lançar despesa paga e receita.
2. Transferir valor entre as contas.
3. **Esperado**: saldos corretos; transferência não altera totais de receita/despesa;
   lançamento inválido rejeitado (`400`).

### V4 — Cartão, fatura e parcelas (FR-030..FR-035)

1. Criar cartão com `closing_day`/`due_day`; lançar compra no dia do fechamento e compra no
   dia seguinte; lançar compra em 3x.
2. **Esperado**: compra no fechamento entra na fatura que fecha nesse dia (linha inclusiva);
   a do dia seguinte entra na próxima; parcelas distribuídas uma por ciclo somando o total.
3. Fechar/pagar fatura e conferir status `aberta → fechada → paga`; vencida quando atrasada.

### V5 — Offline-first e sync (FR-036..FR-044, NFR-004/005)

1. DevTools → Offline. Criar/editar/excluir lançamentos; conferir badge e contagem da
   Outbox.
2. Reconectar; aguardar sincronização automática; opcionalmente usar "Sincronizar agora".
3. **Esperado**: UI otimista imediata; Outbox processada em FIFO; nada duplicado.
4. Simular retry: reenviar o mesmo `sync_id`; **esperado** `ignored` (idempotência).

### V6 — Conflitos (FR-042/FR-043)

1. Na web, editar o mesmo lançamento em dois clientes; o cliente B fica offline e edita uma
   versão antiga.
2. Reconectar B.
3. **Esperado**: vence o `updated_at` mais recente (servidor em empate); item retorna com
   `conflict=true` e o estado do servidor em `record`; update de item deletado retorna
   `ignored` (`orphan_update_discarded`) sem recriar.

### V7 — Dashboard 8 blocos (FR-045..FR-047)

1. Com dados de V3/V4, abrir o dashboard (inclusive offline).
2. **Esperado**: os 8 blocos com valores coerentes; renderização do cache; atualização após
   sync sem bloquear a UI.

### V8 — App Lock (FR-050..FR-052)

1. Ativar App Lock, definir inatividade de 1 min; aguardar e retomar.
2. **Esperado**: reautenticação biométrica exigida; em dispositivo sem biometria, aviso e
   sem bloqueio.

### V9 — Acessibilidade e localização (NFR-007/008, SC-010)

1. Navegar por teclado em todas as telas do MVP; inspecionar contrastes/rótulos.
2. **Esperado**: foco visível, operável por teclado, textos em pt-BR e valores em R$.

## Critérios de pronto (portões)

- `pnpm lint`, `pnpm typecheck` e `pnpm test:shared|web|contract|pb|e2e` verdes.
- Nenhum `any` implícito; nenhuma regra de negócio validada apenas no client.
- 100% dos cenários de conflito e de fatura/parcelas cobertos por teste automatizado.

## Solução de problemas

- **Hooks não carregam schemas**: rode `pnpm --filter @cf/shared build:hooks` após alterar
  `packages/shared`.
- **Sync travado em `failed`**: verificar `último erro` no indicador; conferir CORS e token.
- **Seed ausente**: reinspecionar migração de seed; criar household novamente em ambiente
  limpo (`pb_data` temporário).
