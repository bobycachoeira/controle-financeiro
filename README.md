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
