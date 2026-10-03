# Quickstart & Validação — PWA Instalável e Notificações Configuráveis

Guia para subir e validar a Fase 5. Detalhes em [`data-model.md`](./data-model.md) e
[`contracts/notifications-api.yaml`](./contracts/notifications-api.yaml).

## Pré-requisitos

- Node.js 20 LTS + pnpm 9+.
- Binário do PocketBase 0.23+ em `apps/pocketbase/pocketbase`.
- Par de chaves VAPID (gerado uma vez).
- Navegador Chromium (Playwright) e, para push real, um dispositivo/navegador compatível.

## Setup

```bash
pnpm install
pnpm build:hooks

# Gerar chaves VAPID (uma vez)
pnpm --filter @cf/notifier vapid:generate
# copiar a chave pública/privada para os .env abaixo

cp apps/pocketbase/.env.example apps/pocketbase/.env
cp apps/web/.env.example apps/web/.env.local
cp apps/notifier/.env.example apps/notifier/.env
```

Variáveis novas:
- Backend/notifier: `CF_VAPID_PUBLIC_KEY`, `CF_VAPID_PRIVATE_KEY`, `CF_VAPID_SUBJECT`
  (`mailto:`), `CF_POCKETBASE_URL`, `CF_POCKETBASE_ADMIN_EMAIL`,
  `CF_POCKETBASE_ADMIN_PASSWORD`, `CF_NOTIFIER_CRON`.
- Frontend: `VITE_VAPID_PUBLIC_KEY` (ou obtida em runtime por
  `GET /api/notifications/vapid-public-key`).

## Executando

```bash
cd apps/pocketbase && ./pocketbase serve --http=127.0.0.1:8090
pnpm --filter @cf/notifier start      # scheduler de lembretes
pnpm --filter @cf/web dev             # http://localhost:5173
# ou: docker compose -f docker/docker-compose.yml up
```

## Comandos de teste

| Comando | Escopo |
|---------|--------|
| `pnpm lint && pnpm typecheck` | ESLint + TS strict |
| `pnpm test:shared` | Regras puras: D-N, quiet hours, janela de envio, dedup |
| `pnpm test:notifier` | Seleção de itens e envio (web-push mockado) |
| `pnpm test:pb` | Integração: preferências/inscrição isoladas, teste, RBAC |
| `pnpm test:e2e` | Playwright: ativação, preferências, instalação, update |

## Cenários de validação

### P1 — Ativação e notificação de teste

1. Abrir `Configurações → Notificações`; ativar e conceder permissão.
2. **Esperado**: inscrição registrada; "Enviar teste" exibe a notificação; desativar remove
   a inscrição e interrompe envios.

### P2 — Preferências

1. Definir tipos, dias antes (multi-select), horário `08:30` e quiet hours `22:00–07:00`.
2. Recarregar e reabrir.
3. **Esperado**: valores persistem; tipo desabilitado não gera lembrete.

### P3 — Lembrete de conta

1. Criar conta a pagar vencendo em 3 dias; habilitar `dias_antes=[3]`.
2. Rodar a rotina do notifier (`pnpm --filter @cf/notifier run-once`).
3. **Esperado**: `notification_deliveries` com `status=enviado` e sem duplicar em nova
   execução no mesmo dia; conta paga/cancelada vira `descartado`.

### P4 — Fatura de cartão

1. Ter fatura a vencer em 1 dia; habilitar `fatura_cartao` `dias_antes=[1]`.
2. **Esperado**: notificação de fatura priorizada, com valor e vencimento.

### P5 — Quiet hours

1. Configurar horário preferido dentro da quiet hours.
2. **Esperado**: envio adiado para o fim do silêncio; 0 envios no período de silêncio.

### P6 — PWA instalável e atualização

1. Instalar o app; usar o atalho "Novo Lançamento".
2. Publicar nova versão; abrir sincronizando.
3. **Esperado**: app standalone; atalho abre o formulário; aviso de atualização não
   interrompe a sincronização.

## Critérios de pronto (portões)

- `pnpm lint`, `pnpm typecheck` e `pnpm test:shared|notifier|pb|e2e` verdes.
- 0 envios dentro da quiet hours; 0 duplicidade por `(user, kind, entity, entity_id,
  scheduled_date)`.
- Itens pagos/cancelados/removidos nunca geram lembrete.
