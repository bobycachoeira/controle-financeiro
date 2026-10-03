---
description: "Task list for PWA Instalável e Notificações Configuráveis (Fase 5)"
---

# Tasks: PWA Instalável e Notificações Configuráveis

**Input**: Design documents from `/specs/002-pwa-notifications/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/

**Tests**: Obrigatórios (Princípio IV): regras de agendamento/quiet hours/dedup, notifier
com push mockado, isolamento por `household` nas rotas.

**Organization**: Tarefas por user story. Convenção de paths: monorepo `apps/web/`,
`apps/pocketbase/`, `apps/notifier/`, `packages/shared/`.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: pode rodar em paralelo (arquivos diferentes)
- **[Story]**: US1..US4 conforme `spec.md`

---

## Phase 1: Setup

- [x] T001 Criar o serviço `apps/notifier` (`package.json`, `tsconfig.json`, `vitest.config.ts`) e scripts raiz (`test:notifier`, `vapid:generate`)
- [x] T002 [P] Adicionar dependências do notifier (`web-push`, `node-cron`, `zod`, `tsx`, `vitest`, `typescript`) e tipos
- [x] T003 [P] Criar `apps/notifier/.env.example` e atualizar `apps/web/.env.example`/`apps/pocketbase/.env.example` com `CF_VAPID_*`, `CF_POCKETBASE_*`, `CF_NOTIFIER_CRON`
- [x] T004 [P] Adicionar serviço `notifier` em `docker/docker-compose.yml` + `apps/notifier/Dockerfile`
- [x] T005 [P] Adicionar `pnpm test:notifier` ao CI em `.github/workflows/ci.yml`

---

## Phase 2: Foundational (blocking)

- [x] T006 Schemas Zod, defaults e `REMINDER_DAYS_OPTIONS` em `packages/shared/src/domain/notifications.ts`
- [x] T007 [P] Funções puras (`isQuietHours`, `nextAllowedTime`, `dueReminderDays`, `isDeliveryDuplicate`) em `packages/shared/src/domain/notifications.ts`
- [x] T008 [P] Testes das regras de notificação em `packages/shared/tests/notifications.test.ts`
- [x] T009 Migração das collections `push_subscriptions`, `notification_preferences`, `notification_deliveries` em `apps/pocketbase/pb_migrations/`
- [x] T010 Implementar rotas de notificações (preferências, inscrições, chave VAPID, teste, entregas) em `apps/pocketbase/pb_hooks/lib/handlers/notifications.js`
- [x] T011 Registrar rotas em `apps/pocketbase/pb_hooks/main.pb.js`
- [x] T012 [P] Testes de integração das rotas em `apps/pocketbase/tests/notifications.test.ts`
- [x] T013 [P] Cliente `apps/web/src/api/notifications-api.ts`
- [x] T014 [P] Store/estado em `apps/web/src/stores/notifications.ts` e composable `apps/web/src/composables/usePushNotifications.ts`
- [x] T015 Tabela local de preferências/inscrições no Dexie em `apps/web/src/db/schema.ts`

---

## Phase 3: User Story 1 - Ativar notificações e teste (P1)

- [x] T016 [US1] UI de ativação/teste/desativação em `apps/web/src/features/settings/NotificationsView.vue`
- [x] T017 [US1] Service worker custom (`apps/web/src/sw.ts`) com eventos `push`/`notificationclick` e `injectManifest` em `vite.config.ts`
- [x] T018 [P] [US1] Teste de contrato do cliente em `apps/web/tests/contract/notifications-api.test.ts`
- [x] T019 [US1] Teste unitário do composable/estado em `apps/web/tests/unit/notifications.test.ts`
- [x] T020 [US1] E2E de ativação em `apps/web/tests/e2e/notifications.spec.ts`

---

## Phase 4: User Story 2 - Preferências (P1)

- [x] T021 [US2] Formulário de preferências (tipos, dias antes, horário, quiet hours) em `NotificationsView.vue`
- [x] T022 [US2] Salvar/validar preferências com `@cf/shared` no store
- [x] T023 [US2] Teste unitário de validação/persistência das preferências
- [x] T024 [US2] E2E de preferências

---

## Phase 5: User Story 3 - Lembretes agendados (P2)

- [x] T025 [US3] Cliente REST do PocketBase (admin) em `apps/notifier/src/pocketbase.ts`
- [x] T026 [US3] Seleção de itens elegíveis + dedup em `apps/notifier/src/schedule.ts`
- [x] T027 [US3] Envio com `web-push` e registro de entrega em `apps/notifier/src/sender.ts`
- [x] T028 [US3] Entrypoint/agendador e CLI `run-once` em `apps/notifier/src/index.ts`
- [x] T029 [P] [US3] Testes do notifier (push mockado) em `apps/notifier/tests/`
- [x] T030 [US3] Descartar lembretes pendentes ao pagar/cancelar/excluir conta/fatura em `apps/pocketbase/pb_hooks/lib/handlers/sync.js`
- [x] T031 [P] [US3] Teste de integração de dedup/descarte em `apps/pocketbase/tests/notifications.test.ts`

---

## Phase 6: User Story 4 - PWA instalável e atualização (P3)

- [x] T032 [US4] Atalho "Novo Lançamento" no manifest em `apps/web/vite.config.ts`
- [x] T033 [US4] Componente de aviso de atualização em `apps/web/src/components/PwaUpdatePrompt.vue` e integração no `App.vue`
- [x] T034 [US4] Rota de atalho (`?new=1` → novo lançamento) em `apps/web/src/router/index.ts`
- [x] T035 [US4] E2E de instalação/atalho/update em `apps/web/tests/e2e/pwa.spec.ts`

---

## Phase 7: Polish

- [x] T036 [P] Documentar VAPID/notifier/deploy no `README.md` e quickstart
- [x] T037 Executar `pnpm lint`, `pnpm typecheck` e todas as suítes; corrigir pendências
- [x] T038 Verificar conformidade com a constituição (isolamento, segredos VAPID, dedup) e registrar

---

## Dependencies & Execution Order

- Setup → Fundação (T006–T015) bloqueia as user stories.
- US1 (ativação) é pré-requisito de US2/US3 (sem inscrição não há envio); US2 habilita US3;
  US4 é independente após a Fundação.
- Polish por último.

## Parallel Opportunities

- Setup T002–T005; Fundação T007–T008, T012–T014; US3 T029/T031.

## Notes

- Segredos VAPID nunca no cliente/servidor web; apenas no notifier.
- `web-push` deve ser mockado nos testes de CI.
