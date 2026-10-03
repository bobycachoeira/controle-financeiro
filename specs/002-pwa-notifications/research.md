# Research & Technical Decisions — PWA Instalável e Notificações Configuráveis

**Fase 0** — resolve as decisões técnicas da Fase 5. Sem `NEEDS CLARIFICATION`.

## R1. Onde enviar o Web Push

- **Decision**: serviço Node dedicado (`apps/notifier`) usando a biblioteca `web-push`,
  acionado por agendador.
- **Rationale**: Web Push exige JWT VAPID (ES256) e criptografia de payload (ECDH +
  HKDF + AES-GCM), indisponíveis no runtime JS dos hooks do PocketBase (Goja). Um worker
  pequeno e isolado mantém o backend PocketBase como source-of-truth e concentra o segredo
  VAPID.
- **Alternatives considered**: implementar criptografia Web Push em JS puro nos hooks
  (complexo e frágil); plugin Go compilado no PocketBase (exige build custom, contraria a
  simplicidade); serviço externo de push (lock-in e custo).

## R2. Chaves VAPID

- **Decision**: par de chaves gerado uma vez; pública exposta ao cliente, privada apenas no
  notifier via `CF_VAPID_PRIVATE_KEY`/`CF_VAPID_PUBLIC_KEY`/`CF_VAPID_SUBJECT`.
- **Rationale**: segue o padrão da indústria; a chave privada nunca chega ao navegador.
- **Alternatives considered**: chaves por household (complexidade sem ganho no MVP).

## R3. Service Worker e PWA

- **Decision**: migrar para `vite-plugin-pwa` com estratégia `injectManifest` para um
  `sw.ts` custom, adicionando o listener `push` e `notificationclick`; manter precache de
  assets e `registerType: "prompt"` (atualização controlada).
- **Rationale**: o evento `push` exige código próprio no SW; `injectManifest` preserva o
  precache do Workbox.
- **Alternatives considered**: `generateSW` puro (não permite handler de push); auto-update
  (interromperia sync).

## R4. Agendamento e horário

- **Decision**: rotina diária (`node-cron`) que, no início de cada hora, seleciona usuários
  cujo `horario_envio` cai na janela e processa os itens elegíveis; cálculos no fuso
  `America/Sao_Paulo`.
- **Rationale**: evita depender de precisão ao segundo e respeita o horário preferido;
  reusa funções puras de data de `@cf/shared`.
- **Alternatives considered**: cron por usuário (explosão de jobs); envio apenas em horário
  fixo global (ignora preferência).

## R5. Deduplicação e observabilidade

- **Decision**: collection `notification_deliveries` com índice único
  `(user, kind, entity, entity_id, scheduled_date)`; o notifier faz "claim" antes de enviar.
- **Rationale**: garante FR-014 (sem duplicidade) de forma idempotente e registra
  sucesso/falha (FR-017).
- **Alternatives considered**: dedup em memória (perde em restart); confiar só no provedor
  (sem garantia).

## R6. Preferências por usuário

- **Decision**: `notification_preferences` (1 por usuário/household) com JSON de tipos,
  dias antes, quiet hours e horário; inscrições em `push_subscriptions` (N por usuário).
- **Rationale**: separa preferência (lógica) de inscrições (dispositivos), permitindo
  múltiplos dispositivos (FR-002) e edição simples.
- **Alternatives considered**: JSON único com subscription embutida (não suporta vários
  dispositivos de forma limpa).

## R7. Quiet hours e dias antes

- **Decision**: janela de silêncio pode cruzar a meia-noite; envios que caem no silêncio são
  adiados para o fim do silêncio; `dias_antes` é multi-select com valores predefinidos por
  tipo.
- **Rationale**: atende exatamente à configuração pedida (#9) e evita notificações noturnas.
- **Alternatives considered**: bloquear o envio (perda do lembrete); antecipar antes do
  silêncio (pode cair em horário indesejado).

## R8. Compatibilidade

- **Decision**: suportar Android/Chrome/Edge e iOS 16.4+ (PWA instalado); quando não
  suportado ou permissão negada, informar e manter o app funcional.
- **Rationale**: evita promessa de entrega onde a plataforma não suporta.
- **Alternatives considered**: esconder a opção (usuário não entende ausência).

## R9. Testes

- **Decision**: regras puras em `@cf/shared` (Vitest); notifier com `web-push` mockado;
  rotas de preferências/inscrição em PocketBase efêmero; E2E Playwright para ativação e
  preferências (permissão simulada via contexto).
- **Rationale**: cobre o Princípio IV e não depende de push real em CI.
- **Alternatives considered**: teste de push real (instável/indisponível em CI).

## Itens fora de escopo (adiados)

Email/SMS como canal alternativo, recorrências automáticas (Fase 6) e multimoeda ativa
(Fase 7).
