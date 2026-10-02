# Plano Finalizado – App de Controle Financeiro (Casal + Família)

> **Status:** Finalizado e Consolidado  
> **Foco:** PWA Offline-First, Magic Link + 2FA por Step-up, App Lock com Biometria, Dashboard Básico no MVP e preparado para evolução/migração futura.

## 1) Premissas e Direcionamentos

Com base nas confirmações fornecidas, as principais decisões foram definidas da seguinte forma:

| Resposta | Interpretação | Decisão de Design |
|---|---|---|
| **1. PWA + Offline (ok)** | Quer ver offline, adicionar lançamentos e sincronizar depois. | **Offline-first PWA**. Tudo criado/offline vai para uma fila (`Outbox`) e sincroniza ao voltar a conexão (com resolução de conflitos simples). |
| **2. Biometria (ótimo)** | Deseja App Lock com biometria. | **App Lock com biometria opcional e configurável por usuário** (WebAuthn Platform Auth: Face ID/Touch ID/Biometria/PIN do SO). Configurável por tempo de inatividade. |
| **3. Magic Link + 2FA (segunda opção p/ MVP)** | Prioriza praticidade com segurança. | **Magic Link + 2FA por Step-up**. Dispositivos confiáveis podem ser lembrados, com exigência de 2FA apenas em situações de maior risco. |
| **+ Dashboard básico no MVP** | Deve estar disponível desde o primeiro release. | **Dashboard Básico elevado para P0**, obrigatório no MVP. |

## 2) Autenticação (Magic Link + 2FA por Step-up)

A abordagem escolhida equilibra praticidade e segurança.

| Cenário | Exige 2FA? | Motivo |
|---|---|---|
| **Primeiro login / dispositivo desconhecido** | **Sim (Step-up)** | Reduz risco caso o link seja acessado em um dispositivo não reconhecido. |
| **Dispositivo confiável (lembrado)** | **Não** | Mantém a praticidade no dia a dia. |
| **Ações sensíveis** | **Sim (Step-up)** | Convidar/remover membros, alterar papéis (roles), excluir conta/transação em lote ou exportar dados. |
| **Alterar configurações críticas (2FA/Biometria)** | **Sim** | Protege alterações relacionadas à segurança da conta/família. |
| **Login recorrente (dispositivo confiável)** | **Não** | Garante fluidez no uso diário. |

**Detalhes de Implementação:**

- **Magic Link:** Token único e aleatório (CSPRNG), com expiração entre **10–15 minutos**, uso único e inválido imediatamente após o login.
- **2FA:** **TOTP (RFC 6238)** no MVP (Google Authenticator, Microsoft Authenticator, Authy, etc.). Estrutura preparada para suportar **WebAuthn (Passkeys)** na Fase 7.
- **Dispositivos confiáveis:** Opção "Lembrar este dispositivo por 30 dias". Possibilidade de **listar e revogar todos os dispositivos** a qualquer momento.
- **Códigos de Recuperação (Recovery Codes):** Gerados **10 códigos únicos** no momento da ativação do 2FA, exibidos **apenas uma vez**. Devem ser armazenados offline pelo usuário, sendo utilizados exclusivamente em caso de perda do autenticador.

## 3) App Lock + Biometria (Opcional e Configurável)

Atende ao requisito de ter biometria como uma camada extra de proteção local.

| Configuração | Opções Sugeridas | Observação |
|---|---|---|
| **App Lock** | **Desativado por padrão** (opcional). Pode ser ativado por usuário. | Não obriga no primeiro uso, respeitando preferências individuais. |
| **Tempo de inatividade** | `1 min / 5 min / 10 min / 30 min / Nunca` | Reautenticação biométrica ao retornar ao app após inatividade (funciona no PWA em modo `standalone`). |
| **Bloquear ao minimizar/voltar ao fundo** | Configurável (Ligado/Desligado) | Protege o app quando estiver em segundo plano, principalmente no celular. |
| **Reautenticação para ações sensíveis** | Opcional (Toggle) | Possibilidade futura (não MVP) para exigir biometria em lançamentos de valores altos. |
| **Tecnologia de Suporte** | **WebAuthn Platform Auth** | Compatível com Android (Biometria/Face/PIN), iOS (Face ID/Touch ID). Funciona bem em PWA instalado (Chrome/Safari). |

**Nota de Pragmatismo de Segurança:** O IndexedDB não será criptografado por senha no PWA (complexidade desproporcional para este caso). A mitigação adotada é **App Lock + Sessões + 2FA por Step-up + Server como Source-of-Truth**, o que oferece um nível de proteção adequado e prático para o uso proposto.

## 4) Dashboard Básico (Já no MVP – P0)

Incluído conforme solicitado, com foco em dar uma visão clara, objetiva e útil desde o primeiro acesso.

| Bloco | Campos/Informações | Objetivo |
|---|---|---|
| **1. Saldo Total da Família** | Soma de contas com `inclui_saldo_total = true` (Corrente, Poupança, Carteira e valores relevantes). | Responde: *"O que temos de dinheiro juntos?"*. |
| **2. Saldos por Conta** | Breakdown detalhado por conta (Corrente, Poupança, Carteira, Cartões, etc.). | Visão rápida e organizada do dinheiro distribuído. |
| **3. Gastos do Mês (Eu x Ela x Ambos)** | Totais do mês atual agrupados por `atribuicao` (Meu / Dela / Ambos). Exibe valores, percentuais e barra comparativa. | Atende diretamente ao requisito: *"gastos de cada um e os dois juntos"*. |
| **4. Vencimentos Próximos** | Contas a pagar/receber com vencimento nos **próximos 7 dias** + vencidas (quando existirem). Exibe título, valor, data e atribuição. | Facilita o planejamento e evita esquecimentos. |
| **5. Faturas de Cartão (Abertas)** | Cartões com fatura **aberta/fechada e não paga**, com data de fechamento/vencimento e valor parcial/total estimado. | Prioriza o uso de **Cartão de Crédito** (item 6 das respostas). Com link direto para a fatura. |
| **6. Lançamentos Recentes** | Últimos 5–10 lançamentos realizados. | Visão rápida do movimento mais recente da família. |
| **7. Total a Pagar (Próximos 30 dias)** | Soma estimada de saídas pendentes (`a_pagar`) com vencimento até +30 dias. | Projeção simples e útil para o planejamento financeiro. |
| **8. Status Offline/Sync** | Badge "Offline", "Sincronizando...", quantidade de itens na **Outbox** (pendentes) e botão "Sincronizar agora". | Feedback claro e transparente para o funcionamento Offline-First. |

**UX:** O Dashboard será a **tela inicial** pós-login. Ele carrega **primeiro a partir do cache (IndexedDB)** para funcionar offline e é atualizado automaticamente assim que a sincronização for concluída, sem bloquear a interface.

## 5) Modelagem de Dados

A modelagem foi pensada para garantir isolamento total por família, suportar cartões, offline-first, RBAC, multimoeda futura e trilhas de auditoria.

| Entidade | Campos Principais | Observação |
|---|---|---|
| **Household (Família)** | `id`, `nome`, `moeda_base` (default: `BRL`), `moedas_suportadas[]`, `configuracoes` (JSON), `criado_por`, `created_at`, `updated_at` | Espaço único da família. Prepara para **multimoeda futuro** (#3), sem complicar o MVP. |
| **User** | `id`, `nome`, `email`, `avatar`, `ativo`, `2fa_enabled`, `2fa_setup_completed`, `2fa_secret_encrypted`, `webauthn_credentials` (JSON), `trusted_devices` (JSON), `last_known_device`, `last_login_at` | Suporta **dispositivos confiáveis** para o fluxo Magic Link + Step-up. Preparado para Passkeys. |
| **HouseholdMember** | `id`, `household_id`, `user_id`, `role` (`owner \| partner \| teen \| child \| viewer`), `convite_status` (aceito/pendente), `permissions` (JSON opcional), `joined_at` | **RBAC por família** (#4). Recomenda-se limitar a **2 adultos plenos** (`owner/partner`). Filhos podem ter permissões restritas. |
| **Invite (Convite)** | `id`, `household_id`, `role`, `token` (único/aleatório), `expires_at`, `used_at`, `usado_por`, `email_invitado`, `max_uses` (1), `single_use` (true) | **Token único + expiração (15–30 min) + uso único**. Garante convites seguros, sem links permanentes. |
| **Account (Conta)** | `id`, `household_id`, `nome`, `tipo` (`corrente \| poupança \| carteira \| cartao_credito \| investimento \| outros`), `moeda` (`BRL` default), `saldo_inicial`, `inclui_saldo_total` (bool), `ativo`, `ordem`, `cor/icone` | Suporta Débito/Carteira/Pix e serve de base para Cartão de Crédito. |
| **CreditCard (Cartão de Crédito)** | `id`, `household_id`, `account_id` (FK p/ Account tipo `cartao_credito`), `banco`, `limite`, `moeda`, `dia_fechamento` (1–31), `dia_vencimento` (1–31), `compra_no_credenciamento` (bool), `usar_saldo_para_fatura` (bool), `ativo` | **Essencial para prioridade #6** (cartão de crédito). Modela ciclo de fechamento ↔ vencimento. Relacionamento 1–1 com Account. |
| **Category (Categoria)** | `id`, `household_id`, `nome`, `tipo` (`entrada \| saida`), `grupo`, `cor`, `icone`, `sistema` (bool p/ padrão), `ativo`, `ordem` | **Categorias padrão + custom** (#10). Categorias com `sistema=true` não podem ser excluídas (apenas editadas/ocultadas). |
| **Transaction (Transação)** | `id`, `household_id`, `account_id`, `credit_card_id` (nullable), `valor`, `moeda`, `tipo` (`receita \| despesa \| transferencia`), `data`, `data_lancamento`, `atribuicao` (`meu \| dela \| ambos \| indefinido`), `pagador_user_id` (nullable), `categoria_id`, `descricao`, `status` (`pago \| a_pagar`), `recorrente_id`, `parcela_id`, `fatura_id`, `transferencia_id`, `anexo_url`, `tags[]`, `observacao`, `sync_id` (UUID), `updated_by`, `deleted_at` (soft delete) | Núcleo para **"Eu x Ela x Ambos"**. Suporta parcelas, fatura (cartão), recorrências, transferências e sincronização offline. |
| **Installment (Parcela)** | `id`, `household_id`, `parcela_grupo_id`, `transaction_id` (raiz), `numero_parcela`, `total_parcelas`, `valor_parcela`, `data_prevista`, `fatura_id`, `pago` | Essencial para **compras parceladas no cartão de crédito**. Distribui corretamente por ciclo de fechamento. |
| **Invoice (Fatura Cartão)** | `id`, `household_id`, `credit_card_id`, `account_id`, `mes_ano` (YYYY-MM), `data_fechamento`, `data_vencimento`, `valor_total`, `valor_pago`, `status` (`aberta \| fechada \| paga \| vencida`), `fechada_em`, `paga_em`, `observacao` | Permite visualizar **Faturas Abertas/Fechadas/Pagas/Vencidas**. Agrupa lançamentos pelo ciclo correto. |
| **Transfer (Transferência)** | `id`, `household_id`, `origem_account_id`, `destino_account_id`, `valor`, `moeda`, `data`, `descricao`, `transaction_id_origem`, `transaction_id_destino` | Não é considerada gasto/receita (apenas movimentação entre contas). Essencial p/ Débito↔Poupança/Carteira. |
| **Bill (Conta a Pagar/Receber)** | `id`, `household_id`, `titulo`, `valor`, `moeda`, `tipo` (`fixa \| variavel`), `natureza` (`saida \| entrada`), `vencimento`, `periodicidade` (`unica \| mensal \| bimestral \| trimestral \| anual \| personalizada`), `status` (`pendente \| pago \| cancelado`), `atribuicao` (`meu \| dela \| ambos`), `responsavel_user_id`, `categoria_id`, `recorrente_id`, `lembrete_config` (JSON), `ultima_geracao`, `proxima_geracao` | Suporta **fixas/variáveis, pagas/a pagar**. O campo `lembrete_config` viabiliza as notificações **configuráveis por tipo + dias antes** (#9). |
| **Recurrence (Recorrência)** | `id`, `household_id`, `nome`, `regra_rrule` (RFC 5545 RRULE) ou `frequencia`, `dia`, `ativo`, `ultima_execucao`, `proxima_execucao`, `fim_em`, `count`, `cria_com_status` (`pago \| a_pagar`) | Gera lançamentos recorrentes de forma previsível e flexível. |
| **Budget (Orçamento)** | `id`, `household_id`, `nome`, `periodo` (`mensal \| trimestral \| anual`), `moeda`, `valor_total`, `alerta_pct` (ex.: 80%), `ativo`, `categoria_ids[]` | Estruturado para crescimento (Fase 6), sem pesar o MVP. |
| **BudgetCategory** | `budget_id`, `categoria_id`, `limite`, `gasto_atual` (calculado) | Granularidade por categoria. |
| **NotificationPreference (Prefs Push)** | `id`, `user_id`, `household_id`, `push_enabled`, `webpush_subscription` (JSON), `lembretes` (JSON): `{ contas_a_pagar: { dias_antes: [1,3,7], habilitado: true }, fatura_cartao: { dias_antes: [3,7,1], habilitado: true }, fixas: {...}, recorrentes: {...}, quiet_hours: {inicio:"22:00",fim:"07:00",ativar:true}, horario_envio: "08:30" }` | **Atende #9 exatamente** (configurável por tipo + dias antes + quiet hours + horário de envio). Por usuário. |
| **SyncEvent/Outbox (Offline Sync)** | `id`, `household_id`, `user_id`, `operacao` (`create \| update \| delete`), `entidade`, `entidade_id`, `payload` (JSON), `client_ts`, `server_ts`, `tentativas`, `ultimo_erro`, `status` (`pending \| syncing \| failed \| synced`), `vector_ts`/`updated_at_client` | **Fila Offline (Outbox)** para garantir ordem, retries, idempotência e reconciliação de dados. |
| **AuditLog (Auditoria)** | `id`, `household_id`, `user_id`, `acao`, `entidade`, `entidade_id`, `dados_antes`, `dados_depois`, `ip`, `user_agent`, `created_at` | Rastreabilidade de ações críticas. Reforça segurança e confiança mútua. |

**Princípios de Segurança de Dados:**

- **Isolamento obrigatório:** Todas as tabelas possuem `household_id` obrigatório. Aplicar **RLS (Postgres/Supabase)** ou **Collection Rules (PocketBase)** como **barreira dupla** (defense-in-depth).
- **Nunca confiar no Front:** Todas as regras de negócio, RBAC e filtros por `household_id` devem ser validados **obrigatoriamente no Backend**.
- **Soft Delete:** Uso de `deleted_at` para evitar perda acidental de dados durante sincronização e resolução de conflitos.

## 6) Offline-First, Sincronização e Resolução de Conflitos

Para atender "ver offline + adicionar + sincronizar depois" (#1, #7), adota-se **estratégia Offline-First com Fila Outbox**.

### 6.1 Estratégia

1. **Leitura Offline-First:** Dados críticos (Contas, Categorias, Transações recentes, Faturas) são armazenados em **IndexedDB (Dexie.js)**. O app abre e funciona **100% offline**.
2. **Escrita Local-First:** Criações/edições/exclusões são gravadas **primeiro no IndexedDB**, geram evento na **Outbox** (`pending`) e a UI é atualizada de forma **otimista** (instantânea).
3. **Sincronização Automática:** Ao detectar conexão (`online` via `navigator.onLine` + eventos), a **Outbox é processada em FIFO** (ordem preservada). Pull por delta com base em `last_sync_at`/cursor.
4. **Detecção de Conexão:** Sincroniza automaticamente ao voltar a conexão, sem necessidade de ação manual do usuário.

### 6.2 Tecnologias Frontend (Offline)

| Ferramenta | Uso | Motivo |
|---|---|---|
| **[Dexie.js](https://dexie.org/)** | IndexedDB ORM | Tipado (TypeScript), transações, queries relacionais leves e excelente para PWA offline-first. |
| **[Vite PWA](https://vite-pwa-org.netlify.app/)** | Service Worker + Workbox | Gerencia cache de assets/páginas (SPA fallback), com estratégias adequadas (StaleWhileRevalidate/CacheFirst). Suporte a instalação "Add to Home Screen" e atualizações controladas. |
| **[localForage](https://localforage.github.io/localForage/)** | Chaves/Valores Simples | Opcional para preferências. Para entidades relacionais, **Dexie.js** é superior. |

**Recomendação:** **Dexie.js + Vite PWA (Workbox)**.

### 6.3 Resolução de Conflitos

Priorizamos **previsibilidade** (uso por casal/família). Regra geral: **Server é o Source-of-Truth**.

| Cenário | Regra Proposta | Justificativa |
|---|---|---|
| **Update vs Update (mesmo registro)** | **Last-Write-Wins (LWW)** com `updated_at` (UTC no servidor) + `updated_by`. Em caso de empate, prioriza **Servidor** e marca `conflict=true` (não sobrescreve silenciosamente). | Simples, seguro e transparente. Permite revisão manual quando necessário. |
| **Create vs Delete (mesmo item)** | Se deletado no servidor (`deleted_at` preenchido) → **manter deletado**. Se criado offline e depois deletado online, processa Outbox em ordem. | Evita ressurgimento indesejado de registros deletados. |
| **Delete vs Update** | Registro com `deleted_at` (servidor) vence → remove localmente. Update pendente para item deletado → **descarta item da Outbox com log/aviso** (não re-cria). | Preserva integridade e evita inconsistências. |
| **Inserções Duplicadas (Retry/Reenvio)** | Usar **`sync_id` (UUID)** gerado no cliente por operação. Servidor faz **deduplicação** por `(household_id, sync_id, entidade)`. | Garante **idempotência** essencial para fila de sincronização e reconexões. |

### 6.4 Design da API de Sincronização

| Endpoint/Abordagem | Função | Observação |
|---|---|---|
| **`POST /api/sync/push`** | Envia lote de itens da Outbox (create/update/delete com `sync_id`, `client_ts`). | Retorna resultado por item (`applied` / `conflict` / `ignored`) + estado atual no servidor. |
| **`GET /api/sync/pull?since=<cursor>`** | Retorna delta (registros criados/alterados/deletados) desde `last_sync_at`/cursor. | Deve **incluir soft-deletes** (`deleted_at`) para manter consistência entre clientes. |
| **Realtime (Opcional)** | Postgres Changes (Supabase) ou Subscriptions (PocketBase). | Funciona quando online para atualizações instantâneas. Com **Offline-First** não é obrigatório (sistema funciona perfeitamente com push/pull). |

## 7) Segurança, Auth e Acesso (Família + Isolamento)

Garante "apenas a família" com o isolamento e RBAC adequados, respeitando as definições de autenticação.

### 7.1 Isolamento e RBAC

| Controle | Implementação | Objetivo |
|---|---|---|
| **Isolamento por Household** | **Filtro obrigatório `household_id` em 100% das queries.** Aplicar **RLS (Postgres/Supabase)** OU **Collection Rules (PocketBase)** como barreira dupla. | Garantir isolamento completo entre famílias (multi-tenant por família). Nunca permitir cross-household. |
| **RBAC por Role** | Policies/Middleware por `role` + `permissions` (JSON) granular. | Casal com plenos privilégios, filhos com escopo restrito (#4). |
| **Limite de Membros** | Ao aceitar convite: validar contagem. **Recomendado: máximo 2 adultos** (`owner/partner`). Filhos sem limite rígido, mas controlável. | Mantém o controle da base "casal + família" conforme desejado. |
| **Convite Seguro** | Token aleatório (CSPRNG), `expires_at` (15–30 min), `single_use=true`, `max_uses=1`, inválido após uso. | Seguro, sem links permanentes ou reutilizáveis. |
| **Auditoria** | `AuditLog` para ações críticas + `deleted_at` (Soft Delete). | Rastreabilidade, segurança mútua e integridade histórica. |

### 7.2 Autenticação – Magic Link + 2FA por Step-up (#3)

Conforme confirmado: **Segunda Opção para o MVP**.

| Elemento | Definição | Observação |
|---|---|---|
| **Método de Login** | **Magic Link** (apenas link enviado por e-mail). | Sem senha. Foco em praticidade com segurança reforçada. |
| **2FA** | **TOTP (RFC 6238)** com **Step-up** conforme cenários da Seção 2. | Obrigatório em dispositivos desconhecidos e ações sensíveis. |
| **Dispositivos Confiáveis** | "Lembrar este dispositivo por 30 dias" + listagem + revogação total. | Reduz fricção no dia a dia sem abrir mão da segurança. |
| **Recovery Codes** | 10 códigos únicos, gerados no setup, **exibidos apenas uma vez**. | Única via de recuperação de emergência (perda do autenticador). |
| **Futuro** | **Passkeys/WebAuthn** preparado (Fase 7). | Evolução natural para autenticação phishing-resistant. |

### 7.3 Sessões, App Lock e Hardening

| Recurso | Sugestão de Implementação | Motivo |
|---|---|---|
| **Sessões** | JWT de curta duração (15–30 min) + **Refresh Token** (`HttpOnly`, `Secure`, `SameSite=Strict/Lax`). Rotação de refresh tokens + revogação por dispositivo. | Seguro para PWA/SPA. Reduz exposição em caso de vazamento. |
| **App Lock (Biometria)** | **Opcional e configurável por usuário** via **WebAuthn Platform Auth** (Seção 3). | Atende exatamente ao pedido (#2). Proteção local em caso de acesso indevido ao dispositivo. |
| **Proteção Local** | Não criptografar IndexedDB inteiro. Estratégia: App Lock + Sessões + Step-up 2FA + Server Source-of-Truth. | Abordagem pragmática, equilibrando segurança e viabilidade no ambiente PWA. |
| **Hardening** | CSP restritivo, CORS por origens permitidas, validação **Zod server-side** (nunca apenas client), **Rate Limiting** (login/Magic Link/convite/sync), proteção CSRF/XSS. | Fortalecimento de segurança em camadas (Defense-in-Depth). |

## 8) PWA, Notificações (#9) e Experiência

### 8.1 PWA (Instalável + Offline)

Configuração via **Vite PWA + Workbox**:

| Configuração | Sugestão | Observação |
|---|---|---|
| **Manifest** | Nome, ícones, `display: standalone`, `theme_color`, `background_color`, `shortcuts` (ex.: "Novo Lançamento"). | Proporciona experiência próxima a app nativo (sem barra do navegador). |
| **Service Worker** | `precache` (assets estáticos) + `runtimeCaching` (API: `NetworkFirst`/`StaleWhileRevalidate` para listas, `CacheFirst` para estáticos). | Híbrido: dados = Offline-First (Dexie), assets = cache via SW. |
| **Atualizações SW** | **Update Prompt Controlado** ("Nova versão disponível – Atualizar"). | Evita interromper sincronizações em andamento. Usuário decide quando atualizar. |
| **App Shortcuts** | Atalho "Novo Lançamento" (PWA Shortcuts). | Melhora UX diária, principalmente no Android. |

### 8.2 Web Push + Notificações Configuráveis (#9)

Utilizar **Web Push com VAPID**.

**Compatibilidade:** Android/Chrome/Edge com bom suporte. iOS suporta Web Push a partir de **iOS 16.4+** (melhorado para PWAs instalados). Em versões anteriores, as funcionalidades offline/core continuam perfeitas.

**Configuração por Usuário (NotificationPreference):**

| Tipo de Lembrete | Dias Antes Configuráveis | Quando Notificar | Observação |
|---|---|---|---|
| **Contas a Pagar (Saídas)** | `1, 2, 3, 5, 7, 15, 30` (multi-select) | Vencimento `D - N` dias | Atende contas fixas/variáveis. |
| **Contas a Receber (Entradas)** | Configurável (mesmo range) | `D - N` dias | Opcional, útil quando houver. |
| **Fatura Cartão de Crédito** | `1, 3, 5, 7, 10, 15` (multi-select) | Próximo vencimento da fatura (aberta/fechada) | **Prioritário** (#6). Destaque para evitar atrasos. |
| **Contas Fixas/Recorrentes** | Configurável | Pré-vencimento/antes da geração | Útil para lembretes antecipados. |
| **Geral** | Horário preferido + Quiet Hours | Baseado em `horario_envio` | Evita notificações fora de horário desejado. |

**Estrutura JSON (Sugerida):**

```json
{
  "contas_a_pagar": { "habilitado": true, "dias_antes": [3, 1] },
  "fatura_cartao":  { "habilitado": true, "dias_antes": [7, 3, 1] },
  "fixas":          { "habilitado": true, "dias_antes": [3] },
  "recorrentes":    { "habilitado": true, "dias_antes": [1] },
  "quiet_hours":    { "inicio": "22:00", "fim": "07:00", "ativar": true },
  "horario_envio":  "08:30"
}
```

**Requisitos:** Opt-in explícito do usuário, armazenamento de `webpush_subscription` por usuário (suporta múltiplos dispositivos). Envio via jobs/cron no backend.

## 9) Categorias Padrão (#10) + UX

### 9.1 Categorias Padrão (Seed BR)

Para acelerar o uso (reduzir cadastros iniciais), sugerem-se as seguintes categorias, com separação por tipo e agrupamento.

| Grupo | Saídas (Despesa) | Entradas (Receita) |
|---|---|---|
| **Moradia** | Aluguel, Condomínio, Energia, Água, Gás, Internet, Telefone, Manutenção | Aluguel Recebido |
| **Alimentação** | Mercado, Feirinha, Restaurantes, Delivery, Lanches, Padaria | — |
| **Transporte** | Combustível, Uber/99, Ônibus/Metrô, Estacionamento, Pedágio, Manutenção Veículo | — |
| **Cartão/Finanças** | Fatura Cartão, Juros/Multa, Anuidade, Empréstimos, Financiamento | Rendimentos (Juros) |
| **Saúde** | Farmácia, Consultas, Exames, Plano de Saúde, Odontologia | Reembolso |
| **Educação** | Escola/Faculdade, Cursos, Material, Creche | Bolsa/Auxílio |
| **Pessoal/Lazer** | Beleza, Academia, Roupas, Calçados, Lazer, Viagens, Presentes, Cinema | Presente Recebido |
| **Casa** | Limpeza, Mercado Doméstico, Reparos | — |
| **Assinaturas** | Streaming, Jogos, Software, Clube | — |
| **Filhos/Família** | Creche, Brinquedos, Material Escolar, Saúde Infantil | Auxílio/Mesada |
| **Trabalho/Outros** | Impostos, Taxas, Despesas Diversas | Salário, Freelance, 13º, Férias, Reembolso, Outros |

**Regra de Seed:** Categorias padrão com `sistema=true` (não deletáveis). Podem ser **editadas (nome/cor/ícone)**, **ocultadas** ou complementadas com **categorias personalizadas** (específicas) conforme a necessidade da família.

### 9.2 Sugestão de Telas (UX)

| Tela | Prioridade | Sugestão de Conteúdo |
|---|---|---|
| **Dashboard** | **P0 (MVP)** | Tela inicial com todos os 8 blocos da Seção 4. Carregamento offline-first. |
| **Novo Lançamento** | **P0** | Fluxo rápido (valor primeiro), atribuição (Eu/Ela/Ambos), Conta/Cartão, Pago/A Pagar, Recorrente/Parcela, Categoria. Incluir FAB + Atalho PWA. |
| **Cartões/Faturas** | **P0 (#6)** | Aba Faturas (Abertas/Fechadas/Pagas/Vencidas), Fechamento/Vencimento, Valor Total/Parcial, link p/ lançamentos da fatura. Destaque faturas a vencer. |
| **Contas (Fixas/Variáveis)** | **P0** | Separação (A Pagar/Pagas), Vencimento, Tipo (Fixa/Variável), Atribuição, Totais previstos por mês. |
| **Lançamentos/Lista** | **P0** | Filtros (Mês, Conta, Categoria, Atribuição, Pago/A Pagar, Cartão), Busca, Agrupamento por dia. |
| **Offline/Sync** | **P0 (#7)** | Indicador visível ("Offline", "Sincronizando..."), contagem de itens na Outbox, botão "Sincronizar agora". |
| **Configurações** | **P1** | Notificações (#9) (tipos + dias antes + quiet hours + horário envio), Família/Membros + Convites (RBAC), **App Lock/Biometria** (opcional/configurável), **2FA (Magic Link+Step-up)**, Dispositivos Confiáveis + Recovery Codes, Moedas (preparação multimoeda #3). |

## 10) Roadmap Proposto (Por Fases)

Dividido para entregar **MVP útil desde o início**, evoluindo com segurança, offline e as funcionalidades solicitadas.

| Fase | Objetivo | Tarefas Principais | Prioridade |
|---|---|---|---|
| **Fase 0 – Plano (Atual)** | Alinhar e consolidar | Confirmações incorporadas. Plano finalizado (este documento). | **Feito** |
| **Fase 1 – Base + Auth + Família** | Fundação segura | Setup [PocketBase](https://pocketbase.io/) (recomendado), **Magic Link + 2FA por Step-up (TOTP)**, Dispositivos Confiáveis + Recovery Codes, Household + Convites, RBAC por Roles (#4), **Categorias Seed BR** (#10). | **P0** |
| **Fase 2 – Core + Dashboard Básico** | **MVP utilizável desde o início** | Contas (Débito/Carteira/Pix), Lançamentos Manuais, Atribuição (Eu/Ela/Ambos), Transferências, **Dashboard Básico** (8 blocos – Seção 4), Contas Fixas/Variáveis + Pagas/A Pagar. | **P0 (MVP Essencial)** |
| **Fase 3 – Cartões de Crédito** | Cobrir uso principal (#6) | `CreditCard` + `Invoice (Faturas)` + `Installment (Parcelas)`, Tela de Faturas, Vínculo Lançamento → Fatura, Status (Aberta/Fechada/Paga/Vencida). | **P0** |
| **Fase 4 – Offline-First + Sync + App Lock** | Robustez + Biometria (#1,#2,#7) | [Dexie.js](https://dexie.org/) + Outbox, Sync Push/Pull + Delta, LWW + `sync_id` + Soft Delete, **App Lock (WebAuthn Platform Auth)** (opcional/configurável por inatividade), Indicador Offline/Sync + Retry automático. Testes práticos offline. | **P0** |
| **Fase 5 – PWA + Notificações Configuráveis** | Conveniência (#9) | [Vite PWA](https://vite-pwa-org.netlify.app/) (Install + SW Update Prompt controlado), **Web Push VAPID**, Preferências por Tipo + Dias Antes + Quiet Hours + Horário de Envio, Jobs/Cron para envio de lembretes. | **P1** |
| **Fase 6 – Recorrências + Orçamentos** | Automação leve | Recorrências com **RRULE (RFC 5545)**, Geração automática de lançamentos, Orçamentos por Categoria + Alerta de % utilizado. | **P2** |
| **Fase 7 – Integrações + Futuro** | Evolução segura | Import CSV/OFX, **Open Finance** (somente leitura, Feature-Flag, quando viável p/ PF), **Passkeys/WebAuthn** (ampliar/fortalecer Step-up), **Multimoeda Ativa** (#3) com cotações por data. | **P3** |

## 11) Stack Tecnológica Recomendada

Equilíbrio entre **praticidade + migrável + offline-first + seguro**.

| Camada | Tecnologia | Justificativa |
|---|---|---|
| **Frontend** | [Vite](https://vitejs.dev/) + [Vue 3](https://vuejs.org/) + [TypeScript](https://www.typescriptlang.org/) | Leve, estável, produtivo e excelente para PWA. |
| **UI** | [Tailwind CSS](https://tailwindcss.com/) + [shadcn-vue](https://www.shadcn-vue.com/) | Componentes consistentes, acessíveis, rápidos para iterar. |
| **PWA + Offline** | [Vite PWA](https://vite-pwa-org.netlify.app/) (Workbox) + [Dexie.js](https://dexie.org/) | Offline-First sólido (ler+adicionar+sincronizar), instalável e com atualização controlada. |
| **Validação** | [Zod](https://zod.dev/) (Client + Server) | Tipado, garante consistência entre API e UI, reduz bugs. |
| **Backend** | **[PocketBase](https://pocketbase.io/)** (Recomendado) | API-First, self-host-ready, baixo overhead, regras/collections claras e **muito bom para migração futura** (#2). **Alternativa:** [Supabase](https://supabase.com/) (RLS Postgres excelente). |
| **Auth** | Magic Link + TOTP (2FA por Step-up) + WebAuthn Platform Auth (App Lock) | Atende #2 e #3 exatamente. Preparado para Passkeys (Fase 7). |
| **Push Notifications** | [Web Push](https://datatracker.ietf.org/doc/html/rfc8030) (VAPID) | Nativo PWA, 100% configurável por tipo+dias antes (#9). Bom em Android e iOS 16.4+. |
| **Hospedagem Frontend** | [Cloudflare Pages](https://pages.cloudflare.com/), [Vercel](https://vercel.com/) ou [Netlify](https://www.netlify.com/) | Ótimo para PWA, HTTPS automático, deploy simples e performático. |
| **Hospedagem Backend** | PocketBase: [Docker](https://www.docker.com/) (Coolify/Portainer/CapRover) ou VPS/RPi (Self-Host). Supabase: Cloud (início) ou Self-Host. | Atende perfeitamente o requisito **"prático + passível de migração depois"** (#2). |

## 12) Escopo do MVP (Recomendado para Lançamento)

**MVP sugerido (menor caminho para ter valor real no dia a dia):**

**Incluir Fases 1 + 2 + 3 + 4**, com **Dashboard Básico já na Fase 2**.

- **Auth:** Magic Link + 2FA por **Step-up** (TOTP), Dispositivos Confiáveis + Recovery Codes.
- **Segurança:** App Lock com Biometria **opcional e configurável por inatividade** (WebAuthn Platform Auth).
- **Core:** Lançamentos Manuais + Cartões de Crédito + Transferências + Contas Fixas/Variáveis.
- **Offline-First:** Ler + Adicionar + Sincronizar Depois (IndexedDB + Outbox + Delta Pull/Push).
- **Visão:** **Dashboard Básico** com 8 blocos essenciais.

Com este escopo, o app já atende **100% dos requisitos 1–10**, sendo **prático no dia a dia desde o primeiro release**, **seguro**, **offline-first** e com **caminho claro de migração futura**.

## Conclusão

O plano está **finalizado, consolidado e pronto para execução**. Todas as confirmações foram incorporadas sem suposições:

- **Biometria:** Opcional, configurável por tempo de inatividade (WebAuthn Platform Auth).
- **Autenticação MVP:** **Magic Link + 2FA por Step-up** (segunda opção), com Dispositivos Confiáveis + Recovery Codes.
- **Dashboard:** **Básico incluído obrigatoriamente no MVP**, com 8 blocos essenciais para atender à visão conjunta de dinheiro, gastos (Eu/Ela/Ambos), contas fixas/variáveis e faturas de cartão.