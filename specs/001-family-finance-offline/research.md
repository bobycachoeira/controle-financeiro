# Research & Technical Decisions — Controle Financeiro Familiar Offline-First

**Fase 0** — resolve as decisões técnicas e incertezas do plano antes do design. Não restam
`NEEDS CLARIFICATION`; cada item abaixo registra decisão, justificativa e alternativas.

## R1. Backend: PocketBase self-host

- **Decision**: PocketBase 0.23+ self-host com collections, regras de acesso e hooks JS.
- **Rationale**: definido no plano; API-First, baixo overhead, SQLite embutido, regras e
  hooks claros, self-host em Docker/VPS e caminho de migração futura.
- **Alternatives considered**: Supabase (RLS Postgres forte, mas mais infra/overhead e
  lock-in maior para o MVP); backend Node/Fastify custom (mais liberdade, muito mais código
  e manutenção — rejeitado por contrariar o Princípio V).

## R2. Modelo de sincronização: tudo via Outbox + sync API

- **Decision**: toda escrita do cliente passa pela Outbox e por `POST /api/sync/push`;
  toda leitura incremental vem de `GET /api/sync/pull?since=<cursor>`. Não há caminho
  alternativo de escrita direta (online vs offline).
- **Rationale**: um único caminho idempotente reduz casos de borda, garante auditoria e
  mantém o servidor como source-of-truth, atendendo ao Princípio II.
- **Alternatives considered**: CRUD direto online + sincronização apenas offline (dois
  caminhos, regras duplicadas, conflitos difíceis); replicação bidirecional genérica
  (overengineering para o MVP).

## R3. Idempotência por `sync_id`

- **Decision**: cada operação recebe `sync_id` (UUID v4 gerado no cliente). O servidor
  mantém `sync_events` com índice único `(household, entity, sync_id)` e ignora reenvios já
  aplicados, devolvendo o resultado anterior.
- **Rationale**: retries/reconexões são inevitáveis; dedup determinística evita duplicatas
  (FR-040).
- **Alternatives considered**: dedup por hash de payload (colide com edições legítimas);
  sem dedup (gera duplicatas em retry).

## R4. Cursor delta via change log sequencial

- **Decision**: tabela SQLite `change_log(seq INTEGER PRIMARY KEY AUTOINCREMENT,
  household_id TEXT, entity TEXT, entity_id TEXT, operation TEXT, changed_at TEXT)`,
  criada por migração; hooks inserem uma linha a cada mutação. `pull` retorna os registros
  distintos com `seq > since` do household, incluindo soft-deleted.
- **Rationale**: `updated_at` sozinho tem risco de empate/relógio e perde alterações;
  um inteiro monotônico é robusto e barato (FR-041).
- **Alternatives considered**: cursor por timestamp do servidor (empates e granularidade);
  `sync_events` como cursor (mistura responsabilidades e não cobre mudanças de outros
  usuários).

## R5. Conflitos: Last-Write-Wins + servidor vence + marcação

- **Decision**: LWW comparando `updated_at` (UTC do servidor); em empate o servidor vence;
  o item resultante é marcado `conflict=true` quando a versão do cliente é descartada;
  update de registro deletado é descartado (tombstone vence).
- **Rationale**: previsibilidade para uso em casal/família e transparência; confirmado na
  clarificação (FR-042).
- **Alternatives considered**: servidor sempre vence (perde edições offline legítimas);
  cliente sempre vence (risco de sobrescrever dados corretos); merge campo a campo
  (complexidade desproporcional no MVP).

## R6. Autenticação: Magic Link + TOTP step-up

- **Decision**: rotas customizadas em hooks: `magic-link/request` gera token CSPRNG de uso
  único (hash persistido, validade 10–15 min) e envia por e-mail; `magic-link/verify`
  autentica; TOTP (RFC 6238) implementado com `otpauth`; dispositivos confiáveis com token
  opaco de 30 dias (hash); recovery codes hasheados. Ações sensíveis exigem token de
  step-up de curta duração emitido por `2fa/verify`.
- **Rationale**: atende à decisão do plano e ao Princípio I; step-up precisa de validação
  server-side (FR-003/FR-015).
- **Alternatives considered**: apenas senha (rejeitado pelo plano); OTP embutido do
  PocketBase (não é magic link e não cobre step-up/recovery); Passkeys (Fase 7).

## R7. Criptografia do segredo 2FA

- **Decision**: `twofa_secret_encrypted` protegido com AES-GCM usando chave de ambiente
  (`CF_ENCRYPTION_KEY`); nunca retornar o segredo em respostas/logs.
- **Rationale**: segredo TOTP é credencial equivalente a senha (NFR-002).
- **Alternatives considered**: texto plano (inaceitável); chave por usuário derivada de
  senha (não há senha no fluxo).

## R8. App Lock por WebAuthn (client-side)

- **Decision**: WebAuthn Platform Auth (`@simplewebauthn/browser`) roda no cliente e apenas
  bloqueia a UI local após inatividade; não é fator de autenticação do servidor no MVP.
- **Rationale**: definido no plano; proteção local sem exigir mudança no backend; Passkeys
  como fator ficam para a Fase 7.
- **Alternatives considered**: WebAuthn como segundo fator server-side (escopo maior);
  criptografar IndexedDB (complexidade desproporcional, conforme o plano).

## R9. Validação e contrato único com Zod

- **Decision**: `packages/shared` (`@cf/shared`) contém schemas Zod e regras puras; o client
  importa diretamente e os hooks importam um bundle CJS gerado por esbuild
  (`pb_hooks/lib/shared.js`).
- **Rationale**: um contrato único, TS strict de ponta a ponta e validação server-side
  obrigatória (Princípios I e III).
- **Alternatives considered**: schemas duplicados client/servidor (divergem); validação só
  no client (proibida).

## R10. Valores monetários e datas

- **Decision**: dinheiro em inteiros de centavos (`amount_cents`), exibição via
  `Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })`. Datas de calendário
  como `YYYY-MM-DD` (fuso de negócio `America/Sao_Paulo`); timestamps em UTC ISO. Dia de
  fechamento/vencimento > último dia do mês é ajustado para o último dia (clamp).
- **Rationale**: evita erros de ponto flutuante e ambiguidade de fuso (NFR-008, FR-035).
- **Alternatives considered**: `number` decimal (erros de arredondamento); `Date` local
  (bugs de fuso).

## R11. Estado e camada de dados no cliente

- **Decision**: Pinia para estado de sessão/UI; repositórios Dexie para dados; stores
  observam Dexie (`liveQuery`) e aplicam escrita otimista local antes de enfileirar na
  Outbox.
- **Rationale**: offline-first exige UI reativa ao banco local, não à rede (NFR-006).
- **Alternatives considered**: Vuex (menos idiomático em Vue 3); fetch direto na store
  (quebra offline-first).

## R12. PWA, cache e atualização

- **Decision**: `vite-plugin-pwa` (Workbox): precache de assets (`CacheFirst`), fallback de
  navegação SPA; dados sempre via Dexie (API não é fonte de leitura da UI). Service worker
  com prompt de atualização controlado.
- **Rationale**: separa cache de assets (SW) de dados (Dexie) e evita interromper sync
  (FR-044, NFR-014).
- **Alternatives considered**: `StaleWhileRevalidate` para API (dados desatualizados
  competindo com Dexie); auto-update (interrompe sync).

## R13. Segurança de transporte e hardening

- **Decision**: JWT curto + refresh HttpOnly/Secure/SameSite; CORS por allowlist; CSP
  restritivo; rate limiting (magic-link 5/15min, 2FA 5/10min, convite 10/dia, sync 60/min); validação Zod server-side;
  auditoria em `audit_logs`.
- **Rationale**: defesa em profundidade (FR-053–FR-056, NFR-001/002).
- **Alternatives considered**: sessão longa sem refresh (maior exposição); sem rate limit
  (abuso de magic link/convites).

## R14. Testes

- **Decision**: Vitest para regras puras (`@cf/shared`) e stores; fake-indexeddb para Dexie;
  MSW para HTTP; Playwright para E2E com `context.setOffline(true)`; instância PocketBase
  efêmera (data dir temporário + migrações) para testes de integração/isolamento/RBAC.
- **Rationale**: cobre as regras exigidas pelo Princípio IV e o isolamento obrigatório.
- **Alternatives considered**: apenas E2E (lento/frágil); mocks que contornam o backend
  (rejeitados pela constituição).

## R15. Deploy e configuração

- **Decision**: front em Cloudflare Pages/Vercel; backend PocketBase em Docker/VPS via
  `docker-compose` com volume `pb_data`; variáveis: `CF_ENCRYPTION_KEY`, `CF_VAPID_*`,
  `CF_MAIL_*`, `CF_CORS_ORIGINS`, `CF_STEPUP_TTL`.
- **Rationale**: definido no plano; HTTPS automático no front e backend self-host migrável.
- **Alternatives considered**: backend serverless (incompatível com PocketBase stateful).

## Itens adiados (fora do MVP)

- Web Push/VAPID (Fase 5), recorrências automáticas por RRULE e orçamentos (Fase 6),
  Open Finance/CSV/OFX/multimoeda ativa/Passkeys (Fase 7). Estrutura e campos preparados,
  sem ativação.
