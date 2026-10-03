# Controle Financeiro Familiar Offline-First

PWA offline-first de controle financeiro familiar (MVP). Monorepo com frontend Vue 3
(PWA), backend PocketBase self-host e um pacote de contrato compartilhado (`@cf/shared`).

## Estrutura

```text
apps/web          # PWA Vue 3 + Vite + TS (Tailwind, Dexie, Pinia)
apps/pocketbase   # PocketBase: migrations, hooks JS, testes de integração
packages/shared   # @cf/shared: schemas Zod, regras puras e constantes
docker            # Dockerfile e docker-compose do backend
specs/            # Spec Kit: spec, plan, tasks, contratos
```

## Pré-requisitos

- Node.js 20 LTS + pnpm 9+
- Binário do PocketBase 0.23+ em `apps/pocketbase/pocketbase` (não versionado)
- Docker + Docker Compose (opcional)
- Chromium para E2E (Playwright)

## Setup

```bash
pnpm install
pnpm build:hooks                 # gera apps/pocketbase/pb_hooks/lib/shared.js

cp apps/pocketbase/.env.example apps/pocketbase/.env
cp apps/web/.env.example apps/web/.env.local
```

Variáveis principais do backend: `CF_ENCRYPTION_KEY`, `CF_MAIL_*`, `CF_CORS_ORIGINS`,
`CF_STEPUP_TTL`, `CF_APP_URL`. Do frontend: `VITE_API_URL`.

## Executando

```bash
# Backend (PocketBase com migrações)
cd apps/pocketbase && ./pocketbase serve --http=127.0.0.1:8090
# ou: docker compose -f docker/docker-compose.yml up

# Frontend
pnpm --filter @cf/web dev          # http://localhost:5173
```

Obs.: sem SMTP configurado, o Magic Link é impresso no log do PocketBase (modo dev).

## Testes

| Comando | Escopo |
|---------|--------|
| `pnpm lint` | ESLint |
| `pnpm typecheck` | `vue-tsc --noEmit` + `tsc` (TS strict) |
| `pnpm test:shared` | Regras puras: fatura, parcelas, transferência, conflito, dinheiro |
| `pnpm test:web` | Dexie/Outbox/stores/seletores (fake-indexeddb) |
| `pnpm test:pb` | Integração PocketBase efêmero: isolamento, RBAC, sync, faturas |
| `pnpm test:e2e` | Playwright (requer o app rodando) |

## Deploy

- Frontend: Cloudflare Pages/Vercel (build `pnpm --filter @cf/web build`).
- Backend: Docker/VPS com `docker/docker-compose.yml`, volume `pb_data` persistente e
  as variáveis de ambiente acima.

## Notificações push (Fase 5)

O envio de Web Push roda em um worker dedicado (`apps/notifier`) porque o runtime JS dos
hooks do PocketBase não expõe a criptografia necessária.

```bash
# 1) Gerar chaves VAPID (uma vez) e copiar para os .env
pnpm --filter @cf/notifier vapid:generate

# 2) Configurar conexão do notifier com o PocketBase
cp apps/notifier/.env.example apps/notifier/.env

# 3) Executar
pnpm --filter @cf/notifier start        # agendador (CF_NOTIFIER_CRON)
pnpm --filter @cf/notifier run-once     # processa uma vez (útil em teste)
```

Preferências e inscrições são gerenciadas em `Configurações → Notificações`. A rotina
respeita horário preferido, quiet hours, dias antes por tipo e evita duplicidade por
`(usuário, tipo, item, dia)`.

## Recorrências e Orçamentos (Fase 6)

- Recorrências usam RRULE (RFC 5545) e geram lançamentos ou contas automaticamente. A
  geração roda em rotina diária no backend (`cronAdd`) e é idempotente por
  `(recorrência, data)`. Para acionar manualmente (admin):
  `POST /api/recurrences/run` com `{ "today": "YYYY-MM-DD" }` (opcional).
- Orçamentos por categoria são calculados no cliente a partir dos lançamentos locais, com
  alertas de aproximação e estouro (`alerta_pct`).

## Conformidade com a constituição

- **I. Segurança/Privacidade**: collections fechadas por padrão (sem acesso direto do
  cliente); isolamento por `household` e RBAC validados nos hooks; Zod no cliente e no
  servidor; 2FA step-up server-side; soft delete; `audit_logs`. Coberto por
  `apps/pocketbase/tests/{isolation,rbac,sync}.test.ts`.
- **II. Offline-First**: Dexie + Outbox, `sync_id` UUID, idempotência, pull por delta com
  soft deletes e LWW com `updated_at` do servidor. Coberto por `sync.test.ts` e
  `apps/web/tests/unit/outbox.test.ts`.
- **III. Qualidade/Tipagem**: TypeScript strict sem `any` implícito; `@cf/shared` é o
  contrato único (Zod) usado por cliente e hooks.
- **IV. Testes de Regras**: fatura/parcelas, transferências e conflitos têm suíte própria
  (`packages/shared/tests`, `apps/pocketbase/tests`).
- **V. Simplicidade**: PocketBase evita backend custom; escopo limitado ao MVP.
- **VI. UX Mobile-First/a11y/pt-BR**: layout mobile-first, componentes acessíveis,
  formatação `Intl` pt-BR e valores em R$.
