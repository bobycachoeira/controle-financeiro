<!--
Sync Impact Report
- Version change: (initial) → 1.0.0
- Modified principles: N/A (criação inicial)
- Added sections:
  - Core Principles I–VII
  - Stack e Restrições Técnicas
  - Fluxo de Desenvolvimento e Portões de Qualidade
  - Governance
- Removed sections: N/A
- Templates/commands: dependentes leem esta constituição em runtime; nenhum template foi alterado.
- Follow-up TODOs: none
-->

# Controle Financeiro do Casal Constitution

## Core Principles

### I. Segurança e Privacidade dos Dados Financeiros (NON-NEGOTIABLE)

Todo dado financeiro pertence a um único `household`, e o isolamento entre households
é obrigatório em todas as camadas. As regras abaixo são invioláveis:

- Toda query, mutação e gravação DEVE filtrar e validar `household_id`; acesso
  cross-household é proibido e DEVE falhar em teste.
- Regras de negócio, RBAC, permissões e validações DEVEM ser aplicadas SEMPRE no
  backend. O frontend NUNCA é fonte de confiança para autorização ou integridade.
- Autenticação usa Magic Link + 2FA por step-up (TOTP); ações sensíveis (convidar/remover
  membros, alterar papéis, exportar dados, excluir em lote, alterar configs de segurança)
  DEVEM revalidar 2FA.
- Menor privilégio é o padrão: papéis (`owner | partner | teen | child | viewer`) recebem
  apenas as permissões necessárias.
- Exclusões DEVEM ser soft delete (`deleted_at`); nenhum dado financeiro é removido
  fisicamente no fluxo normal.
- Ações sensíveis DEVEM gerar registro em `AuditLog` (quem, quando, antes/depois).

**Rationale**: dados financeiros familiares exigem confiança mútua, rastreabilidade e
defesa em profundidade; confiar no cliente é a falha de segurança mais provável.

### II. Offline-First Confiável

O app DEVE funcionar sem rede. A escrita é local-first e a sincronização é previsível:

- Toda criação/edição/exclusão é gravada primeiro no IndexedDB (Dexie.js) e enfileirada
  na **Outbox** antes de qualquer chamada de rede.
- A sincronização DEVE ser idempotente: toda operação carrega `sync_id` (UUID gerado no
  cliente) e o servidor deduplica por `(household_id, sync_id, entidade)`.
- O servidor é o **source-of-truth**; pull DEVE ser por delta (cursor) e incluir
  soft deletes.
- Conflitos seguem regra previsível e documentada: Last-Write-Wins por `updated_at`
  (UTC do servidor), servidor vence em empate, e conflitos DEVEM ser sinalizados
  (`conflict=true`) em vez de sobrescritos silenciosamente.
- A Outbox DEVE preservar ordem (FIFO), suportar retry e registrar falhas; itens órfãos
  (update de registro já deletado) DEVEM ser descartados com aviso, nunca recriados.

**Rationale**: uso real do casal ocorre em trânsito e com rede instável; sem idempotência
e regras de conflito explícitas a base corrompe de forma invisível.

### III. Qualidade e Tipagem Forte

- TypeScript DEVE rodar em modo `strict`; `any` implícito é proibido.
- Validação de entrada e de payloads de sincronização DEVE usar **Zod**, no client e no
  server, com schemas compartilhados como contrato único.
- O backend DEVE revalidar todo payload com Zod, independentemente da validação do client.
- Tipos de domínio (entidades, enums de status/role) DEVEM ser explícitos e reutilizados;
  strings mágicas são proibidas quando existe enum/tipo.

**Rationale**: tipagem estrita e contratos validados eliminam a maior classe de bugs de
sincronização e de fronteira cliente/servidor.

### IV. Testes Automatizados das Regras de Negócio (NON-NEGOTIABLE)

Regras de negócio DEVEM ter testes automatizados e verificáveis antes de serem
consideradas concluídas. Cobertura obrigatória mínima:

- Cartão de crédito: fatura, ciclo de fechamento/vencimento, parcelas e rateio entre ciclos.
- Recorrência: geração de lançamentos, periodicidade e datas previstas.
- Transferências: movimentação entre contas sem afetar receita/despesa.
- Sync/conflitos: idempotência por `sync_id`, delta pull, LWW, soft delete e casos de borda
  (create vs delete, delete vs update, reenvio após retry).
- Segurança: isolamento por `household` e enforcement de RBAC no backend.

Testes DEVEM falhar quando a regra é violada; mocks que contornam a regra real no backend
não são aceitos como evidência.

**Rationale**: são exatamente os domínios onde erros custam dinheiro e corroem a confiança
entre o casal; teste não é opcional.

### V. Simplicidade e Evolução Incremental

- O MVP DEVE ser enxuto e priorizar o caminho de maior valor (Fases 1–4 do plano).
- É proibido overengineering: abstrações, camadas e generalizações DEVEM ter uso concreto
  no escopo atual.
- Complexidade adicionada DEVE ser justificada com requisito verificável.
- Decisões DEVEM manter o sistema migrável (PocketBase hoje; alternativas futuras sem
  reescrita do domínio) e preparado para evolução (multimoeda, Open Finance) sem ativá-los
  prematuramente.

**Rationale**: entregar valor real cedo e manter opções abertas vale mais que completude
teórica.

### VI. UX Mobile-First, Acessível, pt-BR e R$

- A interface DEVE ser mobile-first e utilizável no PWA instalado.
- Acessibilidade DEVE ser tratada como requisito (navegação por teclado, foco, contraste,
  rótulos ARIA), não como melhoria posterior.
- Todo texto ao usuário DEVE estar em **pt-BR**; todo valor monetário DEVE ser exibido em
  **R$** com formatação `pt-BR`.
- A UI DEVE comunicar estado offline/sync de forma explícita (badge, itens pendentes,
  ação de sincronizar) sem bloquear a interação.

**Rationale**: o app é usado no celular, no dia a dia, por mais de uma pessoa; clareza e
acessibilidade são funcionais.

### VII. Observabilidade e Versionamento Claros

- Operações de sync, autenticação e ações sensíveis DEVEM emitir logs estruturados
  (contexto, `household_id`, `user_id`, resultado), sem expor segredos ou dados sensíveis.
- Erros e falhas de sincronização DEVEM ser observáveis e diagnosticáveis pelo usuário e
  pelo operador (contagem de Outbox, último erro, tentativas).
- Versões de API, esquema de dados e service worker DEVEM seguir versionamento claro e
  compatível; mudanças incompatíveis exigem plano de migração.
- Atualizações de PWA DEVEM ser controladas por prompt explícito, sem interromper
  sincronizações em andamento.

**Rationale**: offline-first e múltiplos dispositivos tornam invisível o que não é
observado; versionar com clareza evita quebra silenciosa.

## Stack e Restrições Técnicas

Stack canônica do projeto (não substituir sem emenda à constituição):

- **Frontend**: PWA com Vue 3 + Vite + TypeScript (strict), Tailwind CSS + shadcn-vue.
- **Offline**: Dexie.js (IndexedDB) + Vite PWA (Workbox), Outbox local.
- **Validação**: Zod no client e no server.
- **Backend**: PocketBase self-host (collections, API rules/hooks); alternativa de
  migração futura sem reescrita do domínio.
- **Auth**: Magic Link + TOTP (2FA step-up) + WebAuthn Platform Auth (App Lock opcional).
- **Notificações**: Web Push com VAPID (opt-in explícito por usuário).
- **Sync**: `POST /api/sync/push` e `GET /api/sync/pull?since=<cursor>` com delta,
  `sync_id` e soft delete.
- **Hospedagem**: front em Cloudflare Pages/Vercel; backend em Docker/VPS.

Restrições: entidades multi-tenant exigem `household_id`; exclusões usam `deleted_at`;
contratos entre camadas são validados por Zod; nenhuma regra de negócio pode viver apenas
no frontend.

## Fluxo de Desenvolvimento e Portões de Qualidade

O fluxo SDD do projeto é: `constitution → specify → (clarify) → plan → tasks →
(analyze/checklist) → implement → converge` (ver `COMANDOS.md`).

Portões obrigatórios antes de considerar uma entrega concluída:

- Lint e checagem de tipos (TypeScript strict) passam sem erros.
- Testes das regras de negócio afetadas passam (Princípio IV).
- Nenhuma violação de isolamento por `household` ou de validação server-side.
- Sem `any` implícito e sem validação de negócio exclusivamente no client.
- Complexidade nova justificada por requisito verificável.

## Governance

- Esta constituição supersede demais práticas e convenções do projeto; em conflito, ela
  prevalece.
- Emendas DEVEM ser documentadas, aprovadas e acompanhadas de plano de migração quando
  incompatíveis; o arquivo `COMANDOS.md` e o plano em
  `plano-controle-financeiro-casal-finalizado.md` servem de guia de execução em runtime.
- Versionamento semântico da constituição:
  - **MAJOR**: remoção ou redefinição incompatível de princípios/governança.
  - **MINOR**: novo princípio/seção ou expansão material de orientação.
  - **PATCH**: clarificações, correções de texto e refinamentos não semânticos.
- Toda revisão/PR DEVE verificar conformidade com os princípios; desvios exigem
  justificativa explícita e registrada.
- A conformidade é revisada a cada mudança de princípio e sempre que uma feature tocar
  segurança, sync ou regras de cartão/recorrência/transferência.

**Version**: 1.0.0 | **Ratified**: 2026-10-01 | **Last Amended**: 2026-10-01
