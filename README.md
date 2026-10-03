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

## Deploy em produção (PocketBase + Vercel)

Arquitetura: **front na Vercel** (estático) + **PocketBase + notifier num VPS** (com TLS via
Caddy) + **domínio próprio**. A Vercel não roda o PocketBase (stateful) nem o cron do
notifier — por isso o backend fica em Docker/VPS.

Fluxo:

```
Navegador ──HTTPS──> Vercel (PWA)
                 └──HTTPS──> api.seudominio.com (Caddy) ──> PocketBase (8090) + notifier
```

### A) Backend (VPS com Docker)

Pré-requisito: um VPS com Docker + portas 80/443 abertas e o DNS `api.seudominio.com`
apontando para o IP do VPS.

```bash
git clone <repo> && cd controle-financeiro

# 1) Variáveis de ambiente (crie um .env no diretório docker/ ou exporte)
mkdir -p docker
cat > docker/.env <<'EOF'
CF_API_DOMAIN=api.seudominio.com
CF_APP_URL=https://app.seudominio.com
CF_ENCRYPTION_KEY=<32+ bytes aleatórios>        # openssl rand -base64 32
CF_STEPUP_TTL=10m
CF_TIMEZONE=America/Sao_Paulo
# SMTP (para enviar o Magic Link) — ajuste conforme seu provedor
CF_MAIL_HOST=smtp.seudominio.com
CF_MAIL_PORT=587
CF_MAIL_USER=no-reply@seudominio.com
CF_MAIL_PASSWORD=<senha>
CF_MAIL_FROM=no-reply@seudominio.com
# Notificações push (opcional)
CF_VAPID_PUBLIC_KEY=
CF_VAPID_PRIVATE_KEY=
CF_VAPID_SUBJECT=mailto:no-reply@seudominio.com
CF_POCKETBASE_ADMIN_EMAIL=admin@seudominio.com
CF_POCKETBASE_ADMIN_PASSWORD=<senha-forte>
EOF

# 2) Subir (Caddy emite o TLS automaticamente)
CF_API_DOMAIN=api.seudominio.com docker compose \
  --env-file docker/.env -f docker/docker-compose.prod.yml up -d --build
```

As **migrações rodam sozinhas** na primeira subida (collections + seed de categorias).
O banco fica no volume `pb_data` (persistente).

Pós-deploy no backend (uma vez):
1. Crie o **superusuário** do PocketBase (para acessar o painel em
   `https://api.seudominio.com/_/`):
   ```bash
   docker compose -f docker/docker-compose.prod.yml exec pocketbase \
     /pb/pocketbase superuser upsert admin@seudominio.com <senha> --dir=/pb/pb_data
   ```
2. O **SMTP** já é configurado automaticamente a partir de `CF_MAIL_*` no boot.

### B) Frontend (Vercel)

1. Importe o repositório na Vercel.
2. **Root Directory**: `apps/web`.
3. **Framework Preset**: Vite (build `pnpm build` → `dist`). O `apps/web/vercel.json` já
   adiciona o *rewrite* de SPA (rotas como `/bills` funcionam em refresh).
4. **Environment Variable**: `VITE_API_URL = https://api.seudominio.com/api`.
5. Deploy. Serviço em `https://app.seudominio.com` (o HTTPS é obrigatório para o PWA/SW).

### C) Domínio e DNS

| Registro | Tipo | Valor |
|----------|------|-------|
| `app.seudominio.com` | CNAME | `cname.vercel-dns.com` |
| `api.seudominio.com` | A | IP do VPS |

### D) Primeiro uso

1. No painel do PocketBase (`https://api.seudominio.com/_/`), crie o **primeiro usuário**
   em Collections → `users` (e-mail, `name`, senha, `active=true`).
2. No app, faça login por Magic Link → crie a família (household) → convide os demais em
   **Mais → Família e convites**.
3. **Mais → Pessoas**: ajuste os nomes/atribuições (titular de contas e cartões).

### E) Deploy SEM VPS (só PocketBase + Vercel)

A Vercel hospeda apenas o front (estático). O PocketBase é **stateful** (SQLite + disco),
então precisa de um host com **volume persistente** — mas **não precisa ser VPS**. Opções:

1. **Fly.io** (mais próximo de "só PocketBase + Vercel"): roda o container com volume
   gerenciado e HTTPS. Config pronta em `apps/pocketbase/fly.toml`. Passos:
   ```bash
   fly launch --no-deploy --config apps/pocketbase/fly.toml
   fly volumes create pb_data --size 1 --region gru --config apps/pocketbase/fly.toml
   fly secrets set --config apps/pocketbase/fly.toml \
     CF_ENCRYPTION_KEY="$(openssl rand -base64 32)" \
     CF_APP_URL="https://app.seudominio.com" \
     CF_MAIL_HOST="..." CF_MAIL_PORT=587 CF_MAIL_USER="..." CF_MAIL_PASSWORD="..." CF_MAIL_FROM="..."
   fly deploy --config apps/pocketbase/fly.toml
   fly ssh console --config apps/pocketbase/fly.toml -C \
     "/pb/pocketbase superuser upsert admin@seudominio.com <senha> --dir=/pb/pb_data"
   ```
   URL do backend: `https://cf-pocketbase.fly.dev` → `VITE_API_URL=https://cf-pocketbase.fly.dev/api`.
2. **Railway / Render**: mesma ideia (container + disco persistente).
3. **PocketBase gerenciado**: PocketBase Cloud / PocketHost (hospedagem gerenciada; sem
   infra). Rode `pnpm build:hooks` e envie `pb_hooks` + `pb_migrations`.
4. **Em casa, sem abrir portas**: rode o PocketBase numa máquina local (ou Raspberry Pi) e
   exponha com **Cloudflare Tunnel** (`cloudflared tunnel --url http://localhost:8090`) —
   HTTPS grátis, sem VPS e sem IP público.

> O **notifier** (push) é opcional: sem ele o app funciona normalmente, só não envia
> notificações. Para a primeira versão, pode ficar de fora.

### F) Notas de produção

- **Backups**: faça backup do volume `pb_data` (ex.: `docker run --rm -v cf_pb_data:/data
  -v $PWD:/backup alpine tar czf /backup/pb-$(date +%F).tgz -C /data .`).
- **CORS**: o PocketBase 0.23 responde com CORS permissivo; como usamos **Bearer token**
  (não cookies), funciona. Se quiser restringir, ajuste `settings` no admin.
- **Segredos**: `CF_ENCRYPTION_KEY` protege o segredo 2FA (AES-GCM). **Não mude** depois de
  ativado o 2FA, ou os segredos existentes não serão decifrados.
- **Notifier**: roda no mesmo compose; requer `CF_VAPID_*` e as credenciais admin do PB.
- **Descarte de itens de sync com erro**: painel de sincronização (tocar no status no topo).
- Alternativas ao VPS: qualquer host que rode **Docker com volume persistente**
  (Fly.io, Railway, Render). Serverless não serve para o PocketBase.

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

## Integrações e Multimoeda (Fase 7)

- **Importar extrato (CSV/OFX)**: em `Mais → Importar extrato`; a prévia mostra itens
  válidos/inválidos e a confirmação cria lançamentos com `origin=import` e `external_ref`,
  evitando duplicatas ao reimportar.
- **Multimoeda ativa**: cadastre cotações em `Mais → Moedas e cotações` (`rate_micros`); o
  dashboard consolida em BRL pela cotação da data e sinaliza moedas sem cotação.
- **Feature-flags**: `GET /api/settings/features` expõe `open_finance_enabled` e
  `passkeys_enabled`.
- **Passkeys e Open Finance**: estrutura preparada e atrás de flag. A verificação
  server-side de passkey e a conexão real de Open Finance dependem de runtime/provedor
  externo e ficam para uma próxima atualização.

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
