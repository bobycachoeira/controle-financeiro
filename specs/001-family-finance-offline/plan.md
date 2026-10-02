# Implementation Plan: Controle Financeiro Familiar Offline-First

**Branch**: `001-family-finance-offline` | **Date**: 2026-10-01 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/001-family-finance-offline/spec.md`

## Summary

Entregar o MVP (Fases 1–4 do plano) de um PWA offline-first de controle financeiro
familiar: autenticação por Magic Link + 2FA TOTP step-up, família com RBAC e convites,
contas e lançamentos manuais, transferências, contas fixas/variáveis, cartões de crédito
com faturas/parcelas, sincronização offline via Outbox com idempotência (`sync_id`) e
Dashboard com 8 blocos.

**Abordagem técnica**: PWA Vue 3 + Vite + TypeScript (strict) com Tailwind CSS e
shadcn-vue; persistência local em IndexedDB (Dexie.js) espelhando as entidades e uma fila
Outbox; backend PocketBase self-host com collections, regras de acesso e hooks JavaScript;
validação com Zod compartilhada (pacote `@cf/shared`) entre client e hooks. A sincronização
usa exclusivamente `POST /api/sync/push` (lote da Outbox, idempotente por `sync_id`) e
`GET /api/sync/pull?since=<cursor>` (delta via change log), incluindo soft deletes. O
servidor é o source-of-truth; conflitos resolvem por Last-Write-Wins no `updated_at` do
servidor com marcação de conflito. App Lock por WebAuthn Platform Auth é client-side.

## Technical Context

**Language/Version**: TypeScript 5.4+ (`strict`), Node.js 20 LTS; PocketBase 0.23+
(JavaScript hooks no runtime Goja).

**Primary Dependencies**:
- Frontend: Vue 3.4, Vite 5, vue-router 4, Pinia 2, Tailwind CSS 3, shadcn-vue (Reka UI),
  Dexie.js 4, vite-plugin-pwa (Workbox 7), Zod 3, @vueuse/core, date-fns, otpauth,
  @simplewebauthn/browser.
- Backend: PocketBase (collections + access rules + JS hooks), Zod (bundle para hooks),
  otpauth (TOTP), crypto nativo (AES-GCM para segredo 2FA).
- Qualidade: Vitest, @vue/test-utils, fake-indexeddb, MSW, Playwright, vue-tsc, ESLint,
  Prettier.

**Storage**: cliente IndexedDB (Dexie); servidor SQLite gerenciado pelo PocketBase
(`pb_data/`), com tabela auxiliar `change_log` (AUTOINCREMENT) para delta de sync.

**Testing**: Vitest (unit + contract das regras puras e schemas), fake-indexeddb (Dexie),
Playwright (E2E incl. modo offline e PWA), e integração de backend contra instância
PocketBase efêmera (data dir temporário).

**Target Platform**: PWA instalável (Android Chrome/Edge, iOS 16.4+); backend Linux via
Docker/VPS.

**Project Type**: Web application (frontend PWA + backend PocketBase) em monorepo com
pacote compartilhado.

**Performance Goals**: feedback local de UI < 100 ms (otimista); dashboard renderiza do
cache antes de qualquer rede; `push`/`pull` de 50 itens < 2 s p95; app abre e navega offline.

**Constraints**: 100% offline-capable; isolamento por `household` obrigatório; nenhuma
regra de negócio apenas no front; TypeScript strict sem `any` implícito; Zod no client e no
server; pt-BR e valores em R$; valores monetários em centavos inteiros.

**Scale/Scope**: MVP por household de 2–6 membros, milhares de transações por household,
~10 telas, 14 collections.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Princípio | Gate | Status |
|-----------|------|--------|
| I. Segurança/Privacidade (NON-NEGOTIABLE) | Toda collection filtra `household`; regras de negócio e RBAC em hooks do PocketBase; Zod server-side; 2FA step-up no backend; soft delete; `audit_logs`. | PASS |
| II. Offline-First Confiável | Dexie + Outbox, `sync_id` UUID, dedup server-side, pull por delta com soft deletes, LWW com `updated_at` do servidor. | PASS |
| III. Qualidade/Tipagem | TS strict, `@cf/shared` com Zod usado no client e nos hooks, sem `any` implícito, enums tipados. | PASS |
| IV. Testes de Regras (NON-NEGOTIABLE) | Suítes Vitest para fatura/parcelas, transferências, sync/conflitos; E2E offline; testes de isolamento. | PASS |
| V. Simplicidade | Fases 1–4 apenas; PocketBase evita back-end custom; campos futuros (moeda) presentes mas inertes. | PASS |
| VI. UX Mobile-First/a11y/pt-BR | Layout mobile-first, componentes acessíveis shadcn-vue, formatação `Intl` pt-BR, ARIA. | PASS |
| VII. Observabilidade/Versionamento | Logs estruturados nos hooks; `audit_logs`; indicador de sync; API versionada em `/api`. | PASS |

Nenhuma violação identificada. Sem necessidade de justificativa em Complexity Tracking.

## Project Structure

### Documentation (this feature)

```text
specs/001-family-finance-offline/
├── plan.md              # Este arquivo (/speckit.plan)
├── research.md          # Fase 0 (/speckit.plan)
├── data-model.md        # Fase 1 (/speckit.plan)
├── quickstart.md        # Fase 1 (/speckit.plan)
├── contracts/           # Fase 1 (/speckit.plan)
│   ├── README.md
│   ├── auth-api.yaml
│   └── sync-api.yaml
├── checklists/
│   └── requirements.md
└── tasks.md             # Fase 2 (/speckit.tasks — não criado aqui)
```

### Source Code (repository root)

```text
apps/
├── web/                              # PWA Vue 3 + Vite + TypeScript
│   ├── src/
│   │   ├── main.ts
│   │   ├── App.vue
│   │   ├── router/                   # rotas + guards (auth, 2FA, app lock)
│   │   ├── stores/                   # Pinia (session, household, sync, ui)
│   │   ├── db/                       # Dexie schema, repositórios, migrações locais
│   │   ├── sync/                     # outbox, pusher, puller, conflict resolver, cursors
│   │   ├── api/                      # http client, auth-api, sync-api, dispositivos
│   │   ├── features/                 # auth, household, accounts, transactions,
│   │   │                             # transfers, bills, cards, dashboard, categories
│   │   ├── components/ui/            # componentes shadcn-vue
│   │   ├── composables/              # useOnline, useAppLock, useSync, useMoney
│   │   ├── lib/                      # money (cents/BRL), dates/tz, rrule helpers
│   │   └── assets/
│   ├── public/
│   ├── tests/
│   │   ├── unit/                     # Vitest (regras puras, stores, dexie)
│   │   ├── contract/                 # schemas vs respostas da API
│   │   └── e2e/                      # Playwright (offline, sync, fluxos)
│   ├── index.html
│   ├── vite.config.ts
│   ├── tailwind.config.ts
│   ├── tsconfig.json
│   └── package.json
└── pocketbase/
    ├── pb_migrations/                # collections, índices, change_log, seed categorias
    ├── pb_hooks/
    │   ├── main.pb.js                # bootstrap de rotas (routerAdd)
    │   ├── routes/                   # auth.pb.js, sync.pb.js, household.pb.js
    │   └── lib/                      # domain rules, validation, audit, totp, magic-link,
    │                                 #   crypto, ratelimit, shared.js (bundle @cf/shared)
    ├── Dockerfile
    ├── pocketbase                    # binário (não versionado)
    └── pb_data/                      # dados locais (gitignored)

packages/
└── shared/                           # @cf/shared
    ├── src/
    │   ├── entities/                 # schemas Zod por entidade
    │   ├── api/                      # schemas de request/response + erros
    │   ├── domain/                   # regras puras: fatura, parcelas, transferência,
    │   │                             #   recorrência, conflito (LWW), dinheiro (cents)
    │   └── constants/                # enums, papéis, status, categorias seed BR
    ├── scripts/bundle-for-hooks.mjs  # esbuild -> pocketbase/pb_hooks/lib/shared.js
    └── package.json

docker/
└── docker-compose.yml                # pocketbase + volume pb_data

specs/
```

**Structure Decision**: Monorepo com dois apps (`apps/web` PWA e `apps/pocketbase`) e um
pacote de contrato `packages/shared` (`@cf/shared`). O pacote compartilhado é a única fonte
dos schemas Zod e das regras puras, garantindo um contrato único entre cliente e hooks do
PocketBase (o pacote é empacotado para JS e copiado para `pb_hooks/lib/shared.js`).
Essa separação é necessária para atender aos princípios III e IV sem duplicar validação.

## Testing Strategy

Hierarquia de testes e comandos (executados via pnpm na raiz do monorepo):

1. **Regras puras de domínio (unit, obrigatório)** — `pnpm test:shared`
   - Fatura/cartão: linha de corte inclusiva, compra no dia do fechamento, status.
   - Parcelas: rateio e alocação um por ciclo, parcela que cruza fechamento.
   - Transferência: debita/credita e não afeta receita/despesa.
   - Recorrência (futuro): geração por RRULE.
   - Conflito: LWW por `updated_at`, empate → servidor.
   - Dinheiro: conversões centavos/BRL sem ponto flutuante.
2. **Dexie/Offline (unit + integração local)** — `pnpm test:web`
   - Repositórios e transações; Outbox FIFO; retry; fake-indexeddb; optimistic UI stores.
3. **Contrato (contract)** — `pnpm test:contract`
   - Respostas de `push`/`pull`/auth validadas contra os schemas Zod de `@cf/shared`.
4. **Backend/integração (integração)** — `pnpm test:pb`
   - PocketBase efêmero (data dir temporário) com migrações; testa isolamento por
     `household`, RBAC, idempotência de `sync_id`, soft delete, auditoria, rate limit.
5. **E2E (Playwright)** — `pnpm test:e2e`
   - Fluxo de auth/2FA, CRUD offline + reconexão, cenários de conflito, dashboard 8 blocos,
     PWA service worker/update.

Portões (ver `quickstart.md`): lint + `vue-tsc --noEmit` sem erros; todas as suítes de
regras de negócio verdes; nenhum `any` implícito; nenhuma regra de negócio validada apenas
no client.

## Threat Model & Trust Boundaries

- **Fronteiras de confiança**: navegador/PWA (não confiável) ↔ API PocketBase (confiável);
  IndexedDB local não criptografado ↔ memória da aplicação.
- **Superfícies de ataque**: Magic Link/2FA, convites, sync push/pull, rotas anônimas.

| Ameaça | Mitigação | Princípio |
|--------|-----------|-----------|
| Cross-household (IDOR) | `household` derivado da sessão + regras/hooks no backend | I |
| Roubo/reuso de Magic Link | token CSPRNG de uso único + expiração curta | I |
| Força bruta 2FA | rate limit + bloqueio + revogação + notificação | I |
| Vazamento de segredos | AES-GCM + campos ocultos + logs sem segredos | I |
| Cliente malicioso | Zod server-side + regras no backend (nunca confiar no front) | I/III |
| Duplicação/replay de sync | idempotência por `sync_id` + dedup | II |
| Perda/ressurreição de dados | soft delete + tombstone vence + LWW | II |
| XSS/CSRF/CORS | CSP restritivo, CORS allowlist, cookies HttpOnly/Secure | I |

## Complexity Tracking

> Sem violações de Constitution Check. Nenhuma entrada necessária.

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| — | — | — |
