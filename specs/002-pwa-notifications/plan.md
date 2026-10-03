# Implementation Plan: PWA Instalável e Notificações Configuráveis

**Branch**: `002-pwa-notifications` | **Date**: 2026-10-02 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/002-pwa-notifications/spec.md`

## Summary

Entregar a Fase 5: (a) PWA instalável com atalho "Novo Lançamento" e atualização
controlada; (b) notificações push opt-in por dispositivo, com preferências por usuário
(tipos de lembrete, dias antes, quiet hours e horário de envio); e (c) uma rotina agendada
que avalia contas a pagar/receber e faturas de cartão e envia lembretes no horário
preferido, sem duplicar e respeitando o fuso de negócio.

**Abordagem técnica**: o envio de Web Push (VAPID + criptografia de payload) roda em um
pequeno serviço Node (`apps/notifier`) agendado, porque o runtime JS dos hooks do
PocketBase (Goja) não expõe as primitivas de criptografia de Web Push. O serviço lê
inscrições e preferências e os itens a vencer via API do PocketBase, envia com a biblioteca
`web-push` e registra entregas em `notification_deliveries` (idempotência/observação). O
PWA usa `vite-plugin-pwa` (já configurado) com `injectManifest` para tratar eventos `push`
no service worker, além do prompt de atualização controlado e dos shortcuts do manifest.

## Technical Context

**Language/Version**: TypeScript 5.4+ (web/notifier), Node.js 20 LTS; PocketBase 0.23+
(hooks JS no runtime Goja).

**Primary Dependencies**:
- Frontend: `vite-plugin-pwa` (Workbox/`injectManifest`), `web-push` (apenas tipos no
  cliente), Pinia, Dexie, Zod (`@cf/shared`).
- Notifier: `web-push` 3.x, `node-cron` 3.x, Zod, fetch nativo.
- Backend: PocketBase (collections + hooks JS), Zod server-side.

**Storage**: PocketBase SQLite (`pb_data`). Novas collections: `push_subscriptions`,
`notification_preferences`, `notification_deliveries`.

**Testing**: Vitest (regras de agendamento/silêncio/dias-antes em `@cf/shared`), testes
unitários do notifier com `web-push` mockado, integração de rotas de preferências/inscrição
no PocketBase efêmero, e E2E Playwright para o fluxo de ativação e preferências.

**Target Platform**: PWA Android Chrome/Edge e iOS 16.4+ (instalado); backend/notifier
Linux via Docker/VPS.

**Project Type**: Web application (PWA + PocketBase) com um serviço worker adicional.

**Performance Goals**: lembrete entregue em até 15 min do horário preferido (p95); ativação
+ notificação de teste < 1 min; rotina diária processa o household em segundos.

**Constraints**: opt-in explícito; 0 envios dentro da quiet hours; 0 duplicidade por
(item, usuário, dia); timezone de negócio `America/Sao_Paulo`; sem dados sensíveis nos logs;
PWA continua 100% funcional sem suporte a push.

**Scale/Scope**: MVP por household (2–6 membros), poucos dispositivos por usuário, ~4
telas/fluxos novos (ativação, preferências, aviso de atualização, atalho).

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Princípio | Gate | Status |
|-----------|------|--------|
| I. Segurança/Privacidade | Inscrições e preferências isoladas por `household`; rotas autenticadas; `VAPID_PRIVATE_KEY` só no notifier; logs sem segredos nem payloads sensíveis; auditoria de ativação/desativação. | PASS |
| II. Offline-First | Preferências e inscrições persistidas no Dexie e sincronizadas; ativação exige rede (permissão do navegador), mas o app segue offline. | PASS |
| III. Qualidade/Tipagem | Tipos e schemas Zod em `@cf/shared` usados no cliente, no notifier e nos hooks; TS strict. | PASS |
| IV. Testes de Regras | Regras de dias-antes, quiet hours, fuso e dedup com testes dedicados; integração das rotas; notifier testado com mock. | PASS |
| V. Simplicidade | Worker pequeno e isolado; sem novo banco; reuso do PocketBase e do contrato compartilhado. | PASS |
| VI. UX Mobile-First/a11y/pt-BR | Tela de preferências mobile-first, acessível e em pt-BR; feedback claro de permissão negada. | PASS |
| VII. Observabilidade/Versionamento | `notification_deliveries` para diagnóstico; logs estruturados; API em `/api`. | PASS |

Nenhuma violação identificada. Sem justificativa em Complexity Tracking.

## Project Structure

### Documentation (this feature)

```text
specs/002-pwa-notifications/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   └── notifications-api.yaml
├── checklists/
│   └── requirements.md
└── tasks.md             # /speckit.tasks (não criado aqui)
```

### Source Code (repository root)

```text
apps/
├── web/
│   ├── src/
│   │   ├── api/notifications-api.ts        # cliente de preferências/inscrição/teste
│   │   ├── stores/notifications.ts          # estado e operações
│   │   ├── composables/usePushNotifications.ts
│   │   ├── features/settings/NotificationsView.vue
│   │   ├── components/PwaUpdatePrompt.vue
│   │   └── sw.ts                            # service worker (injectManifest) c/ evento push
│   └── tests/{unit,contract,e2e}/
├── pocketbase/
│   ├── pb_migrations/                       # push_subscriptions, preferences, deliveries
│   ├── pb_hooks/lib/handlers/notifications.js
│   └── tests/notifications.test.ts
└── notifier/                                # NOVO serviço worker
    ├── src/
    │   ├── index.ts                         # scheduler (node-cron)
    │   ├── pocketbase.ts                    # client REST (admin)
    │   ├── schedule.ts                      # cálculo de D-N/quiet hours (reusa @cf/shared)
    │   └── sender.ts                        # web-push + registro de entrega
    ├── tests/
    ├── package.json
    └── Dockerfile
packages/
└── shared/
    └── src/domain/notifications.ts          # regras puras de agendamento/silêncio
docker/
└── docker-compose.yml                       # + serviço notifier
```

**Structure Decision**: mantém o monorepo. Adiciona `apps/notifier` como worker Node
separado porque o envio de Web Push exige VAPID/criptografia indisponível no Goja. As
regras puras ficam em `@cf/shared` para serem usadas pelo notifier, pelo cliente e testadas
isoladamente.

## Testing Strategy

1. **Regras puras** (`pnpm test:shared`): cálculo de `D-N` no fuso, janela de envio, quiet
   hours cruzando meia-noite e deduplicação.
2. **Notifier** (`pnpm test:notifier`): seleção de itens elegíveis e envio com `web-push`
   mockado; sem envios duplicados; quiet hours adia.
3. **Integração PocketBase** (`pnpm test:pb`): CRUD de preferências/inscrição isolado por
   household; notificação de teste; RBAC.
4. **E2E** (`pnpm test:e2e`): ativação (permissão simulada), preferências persistem,
   instalação/atalho e aviso de atualização.

## Complexity Tracking

> Sem violações de Constitution Check. Nenhuma entrada necessária.

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| — | — | — |
