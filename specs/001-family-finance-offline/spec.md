# Feature Specification: Controle Financeiro Familiar Offline-First

**Feature Branch**: `001-family-finance-offline`

**Created**: 2026-10-01

**Status**: Draft

**Input**: User description: "Crie a especificação da feature 'Controle Financeiro Familiar Offline-First' com base no arquivo plano-controle-financeiro-casal-finalizado.md. NÃO reescreva o plano: extraia dele os requisitos. Escopo do MVP = Fases 1 a 4 do plano (auth Magic Link + 2FA step-up, família com RBAC, contas e lançamentos manuais, transferências, contas fixas/variáveis, cartões de crédito com faturas/parcelas, offline-first com Outbox e Dashboard Básico com os 8 blocos). Escreva requisitos funcionais e não funcionais com critérios de aceite verificáveis (Given/When/Then), incluindo casos de borda de sincronização e conflito. Fora do MVP: Open Finance, import CSV/OFX, orçamentos e multimoeda ativa."

## Clarifications

### Session 2026-10-01

- Q: Quais permissões exatas cada papel (`owner`, `partner`, `teen`, `child`, `viewer`) deve ter sobre membros, configurações e lançamentos da família? → A: Option B — Owner: tudo + gerir membros/papéis + configurações; Partner: tudo de finanças + convidar, mas não remover/alterar owner; Teen: cria/edita os próprios lançamentos, vê tudo, sem acesso a configurações/segurança; Child: vê e cria apenas os próprios; Viewer: somente leitura, sem criar.
- Q: O limite de membros por família deve ser um bloqueio rígido no backend ou apenas uma recomendação, e como se aplica a adultos plenos versus filhos? → A: Option A — Bloqueio rígido no backend de 2 adultos plenos (`owner`+`partner`); `teen`/`child`/`viewer` sem limite rígido (configurável).
- Q: Quando uma compra de cartão acontece exatamente no dia do fechamento (ou depois), em qual fatura ela deve entrar? → A: Option A — Linha de corte inclusiva: compra até o dia de fechamento (inclusive) entra na fatura que fecha naquele dia; do dia seguinte em diante entra na próxima fatura.
- Q: Qual é a política exata para resolver conflitos de edição concorrente do mesmo registro (Update vs Update)? → A: Option A — Last-Write-Wins pelo `updated_at` (UTC do servidor); aplica a versão mais recente; empate → servidor vence; item marcado `conflict=true` para revisão, nunca sobrescrita silenciosa.
- Q: Como tratar ações sensíveis que exigem 2FA step-up quando o usuário está offline? → A: Option A — Bloquear offline: a ação exige conexão e 2FA step-up; a UI avisa que precisa estar online e a ação NÃO é enfileirada na Outbox.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Acesso seguro da família (Magic Link + 2FA por step-up) (Priority: P1)

Um membro adulto entra no app sem senha, usando um link enviado por e-mail. Em
dispositivos desconhecidos ou em ações sensíveis, o sistema exige um segundo fator
(TOTP). O usuário pode marcar dispositivos confiáveis, listar/revogar dispositivos e
usar códigos de recuperação se perder o autenticador.

**Why this priority**: sem acesso seguro e isolado por família nenhuma outra funcionalidade
financeira pode existir com confiança.

**Independent Test**: Um novo usuário solicita o link, autentica, ativa 2FA, marca o
dispositivo como confiável e reloga sem novo 2FA; em ação sensível, o 2FA é exigido de novo.

**Acceptance Scenarios**:

1. **Given** um e-mail cadastrado, **When** o usuário solicita o Magic Link, **Then** recebe um link de uso único que expira em 10–15 minutos e é invalidado após o primeiro uso.
2. **Given** um usuário com 2FA ativo em dispositivo desconhecido, **When** ele conclui o Magic Link, **Then** o sistema exige um código TOTP válido antes de liberar o acesso.
3. **Given** um dispositivo marcado como confiável há menos de 30 dias, **When** o usuário reloga, **Then** o acesso é liberado sem novo 2FA.
4. **Given** uma ação sensível (convidar/remover membro, alterar papel, alterar config de segurança), **When** o usuário a executa, **Then** o sistema exige 2FA por step-up antes de concluir.
5. **Given** um usuário que perdeu o autenticador, **When** ele usa um código de recuperação válido e não utilizado, **Then** o acesso é liberado e aquele código é consumido.
6. **Given** a lista de dispositivos confiáveis, **When** o usuário revoga um dispositivo, **Then** aquele dispositivo passa a exigir 2FA no próximo acesso.
7. **Given** 5 tentativas de 2FA inválidas em 15 min, **When** a quinta falha ocorre, **Then** a conta é bloqueada temporariamente, as sessões e dispositivos confiáveis são revogados, o titular é notificado por e-mail e o evento é auditado.

---

### User Story 2 - Família, convites e papéis (RBAC) (Priority: P1)

Um criador inicializa a família (household), convida pessoas por token seguro de uso
único e atribui papéis. Cada membro vê e altera somente os dados da própria família.

**Why this priority**: garante isolamento multi-tenant e define quem pode fazer o quê,
base de todos os demais fluxos.

**Independent Test**: Criar família, convidar segundo adulto (partner), aceitar o convite e
confirmar que nenhum membro consegue acessar dados de outra família.

**Acceptance Scenarios**:

1. **Given** um usuário autenticado sem família, **When** ele cria uma família, **Then** ele se torna `owner` e é possível cadastrar contas imediatamente.
2. **Given** um `owner`/`partner`, **When** ele convida um e-mail com um papel, **Then** é gerado um token aleatório de uso único que expira em 15–30 minutos.
3. **Given** um convite válido, **When** o convidado aceita, **Then** ele passa a ser membro com o papel definido e o convite é marcado como usado.
4. **Given** um convite expirado ou já usado, **When** o convidado tenta aceitá-lo, **Then** o sistema recusa a entrada.
5. **Given** membros de famílias diferentes, **When** qualquer um tenta ler ou alterar dados da outra família, **Then** a operação é negada e registrada.
6. **Given** um membro `teen`/`child`/`viewer`, **When** ele tenta ação fora do seu escopo, **Then** a ação é negada.

---

### User Story 3 - Registrar contas e lançamentos manuais (Priority: P1)

Um membro cadastra contas (corrente, poupança, carteira, cartão, investimento, outros) e
registra lançamentos de receita/despesa com valor, data, categoria, status (pago/a pagar)
e atribuição (meu/dela/ambos/indefinido).

**Why this priority**: é o núcleo de valor do app — registrar e consultar o dinheiro da família.

**Independent Test**: Criar uma conta e lançar uma despesa atribuída a "ambos"; a despesa
aparece no saldo da conta e na visão por atribuição.

**Acceptance Scenarios**:

1. **Given** uma família com conta ativa, **When** o usuário cria um lançamento de despesa pago, **Then** o saldo da conta é reduzido e o lançamento aparece na lista.
2. **Given** um lançamento com status "a pagar", **When** o usuário marca como pago, **Then** o status muda e o saldo passa a refletir o pagamento.
3. **Given** um lançamento sem conta válida ou com valor inválido, **When** o usuário salva, **Then** o sistema rejeita com mensagem clara e não persiste.
4. **Given** lançamentos atribuídos a "meu", "dela" e "ambos", **When** o usuário filtra por atribuição, **Then** vê apenas os correspondentes e os totais corretos.
5. **Given** um lançamento existente, **When** o usuário exclui, **Then** ele deixa de aparecer nas visões ativas, mas permanece recuperável (soft delete) e a exclusão é auditada.

---

### User Story 4 - Dashboard básico com 8 blocos (Priority: P1)

Ao entrar, o usuário vê a tela inicial com os 8 blocos: saldo total da família, saldos por
conta, gastos do mês (Eu x Ela x Ambos), vencimentos próximos, faturas de cartão abertas,
lançamentos recentes, total a pagar em 30 dias e status offline/sync.

**Why this priority**: é a visão que traduz os dados em decisão diária e é obrigatória no MVP.

**Independent Test**: Com contas, lançamentos, faturas e uma conta a pagar cadastrados, os 8
blocos exibem valores coerentes com um mês de referência.

**Acceptance Scenarios**:

1. **Given** contas com `inclui_saldo_total=true`, **When** o dashboard carrega, **Then** o saldo total da família é a soma dessas contas.
2. **Given** lançamentos do mês atual por atribuição, **When** o bloco de gastos carrega, **Then** exibe valores, percentuais e comparação Meu/Dela/Ambos.
3. **Given** contas a pagar/receber com vencimento nos próximos 7 dias e vencidas, **When** o bloco de vencimentos carrega, **Then** lista título, valor, data e atribuição.
4. **Given** cartões com fatura aberta/fechada não paga, **When** o bloco de faturas carrega, **Then** exibe data de fechamento/vencimento e valor parcial/total.
5. **Given** o app sem conexão, **When** o dashboard abre, **Then** ele renderiza a partir do cache local e atualiza sem bloquear a interface ao sincronizar.

---

### User Story 5 - Offline-first com fila Outbox e sincronização (Priority: P1)

O app funciona sem rede: o usuário lê e escreve normalmente; as operações ficam pendentes
na Outbox e sincronizam automaticamente ao voltar a conexão, de forma idempotente e
previsível. O usuário vê o estado de sincronização e pode sincronizar manualmente.

**Why this priority**: o uso real acontece no celular e com rede instável; sem isso o app
perde dados ou cria duplicidades.

**Independent Test**: Ativar modo offline, criar/editar/excluir registros, reconectar e
confirmar que o servidor converge sem duplicar nem ressuscitar itens deletados.

**Acceptance Scenarios**:

1. **Given** o app offline, **When** o usuário cria/edita/exclui registros, **Then** cada operação é gravada localmente, entra na Outbox como pendente e a UI atualiza de imediato.
2. **Given** a conexão restabelecida, **When** a sincronização ocorre, **Then** a Outbox é processada em ordem (FIFO) e os itens passam a "sincronizado".
3. **Given** um item reenviado após falha de rede, **When** o servidor recebe o mesmo `sync_id`, **Then** a operação é deduplicada (idempotência) e não gera duplicata.
4. **Given** o usuário, **When** ele abre o indicador de sync, **Then** vê "Offline"/"Sincronizando...", a quantidade de itens pendentes e a ação "Sincronizar agora".
5. **Given** um item que falha repetidamente, **When** a sincronização termina, **Then** o item permanece com status de falha, tentativas e último erro visíveis.
6. **Given** um conflito de sincronização detectado, **When** o usuário abre o indicador de sync, **Then** vê a contagem de conflitos e o estado do servidor, podendo revisar/aceitar sem sobrescrita silenciosa.

---

### User Story 6 - Transferências entre contas (Priority: P2)

Um membro move dinheiro entre contas da família. A transferência afeta os saldos das duas
contas, mas não é contada como receita nem como despesa.

**Why this priority**: comum no dia a dia (Débito ↔ Poupança ↔ Carteira) e evita distorção
dos relatórios de receita/despesa.

**Independent Test**: Transferir valor entre duas contas e verificar que os saldos mudam e
que os totais de receita/despesa permanecem inalterados.

**Acceptance Scenarios**:

1. **Given** duas contas ativas com saldo, **When** o usuário registra uma transferência, **Then** a origem diminui e o destino aumenta pelo mesmo valor.
2. **Given** uma transferência registrada, **When** os totais de gastos/receitas do mês são calculados, **Then** a transferência não altera esses totais.
3. **Given** origem igual ao destino ou valor inválido, **When** o usuário salva, **Then** o sistema rejeita a operação.

---

### User Story 7 - Contas fixas e variáveis (a pagar/pagas) (Priority: P2)

Um membro cadastra contas a pagar/receber do tipo fixa ou variável, com vencimento,
atribuição e responsável, e acompanha o que está pendente ou pago.

**Why this priority**: planejamento de compromissos recorrentes do mês.

**Independent Test**: Cadastrar contas fixas e variáveis, com vencimentos distintos, e
verificar as listas de pendentes/pagas e os totais previstos do mês.

**Acceptance Scenarios**:

1. **Given** uma conta fixa mensal com vencimento futuro, **When** ela é cadastrada, **Then** aparece como pendente com vencimento e atribuição.
2. **Given** uma conta pendente, **When** o usuário marca como paga, **Then** ela passa para a lista de pagas e sai do total a pagar.
3. **Given** contas pendentes no mês, **When** o usuário consulta o resumo, **Then** vê o total previsto separado por tipo (fixa/variável) e por atribuição.

---

### User Story 8 - Cartões de crédito com faturas e parcelas (Priority: P2)

Um membro cadastra cartões, registra compras (à vista ou parceladas) e o sistema agrupa os
lançamentos na fatura correta conforme o ciclo de fechamento/vencimento, calcula o valor
parcial/total e acompanha os status da fatura.

**Why this priority**: cartão de crédito é prioridade explícita de uso diário e exige as
regras de negócio mais sensíveis do domínio.

**Independent Test**: Cadastrar cartão com dias de fechamento/vencimento, lançar compra
parcelada e verificar a distribuição das parcelas por fatura e os status.

**Acceptance Scenarios**:

1. **Given** um cartão com dia de fechamento definido, **When** uma compra é lançada antes do fechamento, **Then** ela entra na fatura aberta do ciclo vigente.
2. **Given** uma compra lançada após o fechamento, **When** o ciclo atual fecha, **Then** a compra entra na fatura do próximo ciclo.
3. **Given** uma compra parcelada em N vezes, **When** as parcelas são geradas, **Then** o valor é dividido corretamente e cada parcela é vinculada à fatura do seu ciclo.
4. **Given** uma fatura aberta, **When** o usuário a consulta, **Then** vê data de fechamento/vencimento, valor parcial/total e os lançamentos que a compõem.
5. **Given** uma fatura com status paga, **When** os blocos do dashboard carregam, **Then** ela não aparece entre as faturas abertas/fechadas não pagas.
6. **Given** um lançamento já vinculado a uma fatura, **When** o usuário o edita ou exclui, **Then** a fatura afetada (e a próxima, se o vencimento mudar) é recalculada, as parcelas permanecem consistentes e a ação é auditada.

---

### User Story 9 - Categorias padrão em pt-BR (Priority: P2)

O sistema oferece categorias padrão de entrada/saída agrupadas (Moradia, Alimentação,
Transporte, etc.). Categorias de sistema não podem ser excluídas, mas podem ser editadas,
ocultadas e complementadas.

**Why this priority**: acelera o uso e reduz cadastro inicial.

**Independent Test**: Nova família já possui categorias padrão; editar uma e criar uma
customizada; tentar excluir uma de sistema e ser impedido.

**Acceptance Scenarios**:

1. **Given** uma família recém-criada, **When** o usuário abre as categorias, **Then** as categorias padrão de seed BR já estão disponíveis.
2. **Given** uma categoria de sistema, **When** o usuário tenta excluí-la, **Then** o sistema impede e permite apenas editar/ocultar.
3. **Given** uma categoria customizada do usuário, **When** ele a exclui, **Then** a exclusão é permitida e auditada.

---

### User Story 10 - App Lock com biometria (opcional) (Priority: P3)

O usuário pode ativar, por conta, um bloqueio local reautenticado por biometria/PIN do
dispositivo após um tempo de inatividade configurável.

**Why this priority**: camada extra de proteção local, opcional e configurável.

**Independent Test**: Ativar App Lock com inatividade de 1 minuto e confirmar que o app
pede reautenticação biométrica ao retornar.

**Acceptance Scenarios**:

1. **Given** o App Lock desativado (padrão), **When** o usuário retorna ao app, **Then** nenhum bloqueio é solicitado.
2. **Given** o App Lock ativo com inatividade configurada, **When** o tempo é excedido, **Then** o app exige reautenticação biométrica antes de mostrar dados.
3. **Given** a biometria indisponível no dispositivo, **When** o usuário configura o App Lock, **Then** o sistema informa a indisponibilidade e não bloqueia o app.

---

### Edge Cases

- **Sem rede ao abrir**: o app abre e navega usando apenas dados locais; nenhuma tela bloqueia por ausência de conexão.
- **Conflito Update vs Update**: duas edições do mesmo registro; vence a de `updated_at` mais recente (UTC do servidor); em empate vence o servidor; o item é marcado como conflito e não sobrescrito silenciosamente.
- **Create vs Delete**: item criado offline que já foi deletado no servidor não é ressuscitado.
- **Delete vs Update**: se o servidor tem `deleted_at`, o registro vence como deletado; updates pendentes para item deletado são descartados da Outbox com aviso e não o recriam.
- **Reenvio após falha/retry**: o mesmo `sync_id` reenviado não gera duplicata.
- **Pull inclui soft deletes**: registros deletados no servidor são removidos no cliente durante o pull.
- **Fechamento de fatura e compra no limite do ciclo**: compra no exato dia de fechamento entra na fatura que fecha naquele dia (linha de corte inclusiva); compra do dia seguinte em diante entra na próxima fatura, de forma determinística e testável.
- **Parcela que cruza o fechamento**: cada parcela é alocada à fatura cujo ciclo contém sua data prevista (mesma regra inclusiva), uma parcela por ciclo, nunca todas na fatura de origem.
- **Convite expirado/usado**: recusa com mensagem específica, sem criar membro.
- **Ação sensível offline**: a ação que requer 2FA step-up é bloqueada offline com aviso claro para conectar-se; ela não é enfileirada na Outbox nem aplicada sem validação no servidor.
- **Valor monetário inválido** (negativo onde não permitido, vazio, formato inválido): rejeitado com mensagem e sem persistência.
- **Múltiplos dispositivos do mesmo usuário**: cada dispositivo sincroniza independentemente e converge para o mesmo estado do servidor.
- **Conflito detectado**: o item aparece no indicador de sync como conflito, com valor do servidor visível e o valor local descartado acessível para revisão; a contagem de conflitos é exibida.

## Requirements *(mandatory)*

### Functional Requirements

**A. Identidade, autenticação e 2FA**

- **FR-001**: O sistema MUST permitir login sem senha por Magic Link enviado ao e-mail cadastrado.
- **FR-002**: O Magic Link MUST ser único, aleatório, de uso único, expirar em 10–15 minutos e ser invalidado após o primeiro login.
- **FR-003**: O sistema MUST suportar 2FA por TOTP e exigir step-up em dispositivos desconhecidos e em ações sensíveis.
- **FR-004**: O sistema MUST permitir marcar dispositivos como confiáveis por até 30 dias, listar e revogar dispositivos.
- **FR-005**: O sistema MUST gerar códigos de recuperação únicos e exibi-los apenas uma vez na ativação do 2FA; cada código é válido para um único uso.
- **FR-006**: O sistema MUST permitir ao usuário ativar/desativar 2FA e regenerar códigos de recuperação mediante step-up.
- **FR-007**: O sistema MUST invalidar a sessão/token do Magic Link imediatamente após o uso.

**B. Família, convites e RBAC**

- **FR-008**: O sistema MUST permitir criar uma família (household) e tornar o criador `owner`.
- **FR-009**: O sistema MUST isolar TODOS os dados por `household_id`, rejeitando qualquer acesso cross-household no backend.
- **FR-010**: O sistema MUST suportar papéis com permissões distintas e menor privilégio, conforme a matriz: `owner` (tudo, incluindo gerir membros/papéis e configurações de segurança); `partner` (tudo de finanças e convidar membros, mas NÃO remover/alterar o `owner` nem config de segurança); `teen` (criar/editar os próprios lançamentos e ver todos os dados financeiros, sem acesso a configurações/segurança); `child` (ver e criar apenas os próprios lançamentos); `viewer` (somente leitura, sem criar/editar/excluir).
- **FR-011**: O sistema MUST emitir convites com token aleatório de uso único, expiração de 15–30 minutos e papel definido.
- **FR-012**: O sistema MUST recusar convites expirados, já usados ou de outra família.
- **FR-013**: O sistema MUST impor, no backend, um bloqueio rígido de no máximo 2 adultos plenos (`owner`/`partner`) por família, rejeitando convites que excedam o limite; papéis `teen`/`child`/`viewer` não têm limite rígido (limite configurável).
- **FR-014**: O sistema MUST negar e registrar tentativas de ação fora do escopo do papel.
- **FR-015**: Ações de convidar/remover membros, alterar papéis e alterar configurações de segurança MUST exigir 2FA step-up e MUST ser bloqueadas quando offline (exigem conexão; não são enfileiradas na Outbox).

**C. Contas e lançamentos**

- **FR-016**: O sistema MUST permitir cadastrar contas com tipo (corrente, poupança, carteira, cartão de crédito, investimento, outros), moeda base (BRL), saldo inicial e indicação de inclusão no saldo total.
- **FR-017**: O sistema MUST permitir criar/editar/excluir (soft delete) lançamentos de receita, despesa e transferência, com valor, data, categoria, status (pago/a pagar) e atribuição (meu/dela/ambos/indefinido).
- **FR-018**: O sistema MUST atualizar o saldo da conta quando um lançamento pago é criado, editado ou marcado como pago.
- **FR-019**: O sistema MUST calcular totais por atribuição (Eu, Ela, Ambos) no mês corrente.
- **FR-020**: O sistema MUST permitir filtrar lançamentos por mês, conta, categoria, atribuição, status e cartão.
- **FR-021**: O sistema MUST validar valor, conta e categoria antes de persistir e rejeitar entradas inválidas.
- **FR-022**: Exclusões MUST ser soft delete, recuperáveis e auditadas.

**D. Transferências**

- **FR-023**: O sistema MUST permitir transferências entre contas da mesma família, debitando a origem e creditando o destino pelo mesmo valor.
- **FR-024**: O sistema MUST excluir transferências dos totais de receita e despesa e MUST contabilizar cada compra de cartão uma única vez (na competência da fatura/parcela), sem dupla contagem entre fatura e lançamento.
- **FR-025**: O sistema MUST rejeitar transferência com origem igual ao destino ou valor inválido.

**E. Contas fixas/variáveis**

- **FR-026**: O sistema MUST permitir cadastrar contas a pagar/receber do tipo fixa ou variável, com vencimento, natureza (entrada/saída), atribuição, responsável e categoria.
- **FR-027**: O sistema MUST permitir marcar contas como pendentes, pagas ou canceladas.
- **FR-028**: O sistema MUST calcular totais previstos por mês, separados por tipo e atribuição.
- **FR-029**: O sistema MUST suportar periodicidade declarada (única, mensal, bimestral, trimestral, anual, personalizada) como atributo da conta.

*(Geração automática de recorrências por regra está fora do MVP — ver Out of Scope.)*

**F. Cartões de crédito, faturas e parcelas**

- **FR-030**: O sistema MUST permitir cadastrar cartões com banco, limite, dia de fechamento e dia de vencimento, vinculados a uma conta do tipo cartão de crédito; `purchase_at_posting` define se a alocação usa a data de posting em vez da data da compra e `uses_account_balance_for_invoice` define se o pagamento da fatura debita o saldo da conta vinculada.
- **FR-031**: O sistema MUST agrupar lançamentos do cartão na fatura do ciclo correto usando linha de corte inclusiva: compra com data até o dia de fechamento (inclusive) entra na fatura que fecha naquele dia; compra a partir do dia seguinte entra na próxima fatura.
- **FR-032**: O sistema MUST permitir compras parceladas, gerando N parcelas com valor rateado e cada parcela vinculada à fatura do seu ciclo.
- **FR-033**: O sistema MUST calcular valor parcial/total da fatura e gerir status `aberta`, `fechada`, `paga`, `vencida`.
- **FR-034**: O sistema MUST exibir data de fechamento/vencimento, valor e lançamentos de cada fatura.
- **FR-035**: O sistema MUST tratar de forma determinística compras no limite do ciclo (linha de corte inclusiva do FR-031) e alocar cada parcela à fatura cujo ciclo contém a data prevista da parcela (mesma regra inclusiva), uma parcela por ciclo, nunca todas as parcelas na fatura de origem. Quando `closing_day`/`due_day` exceder o número de dias do mês, o sistema MUST usar o último dia do mês (incluindo fevereiro em ano bissexto).

**G. Offline-first e sincronização**

- **FR-036**: O sistema MUST permitir leitura e escrita completas sem conexão, gravando primeiro localmente e atualizando a UI de forma otimista.
- **FR-037**: Toda operação local MUST gerar um item na Outbox com `sync_id` (UUID gerado no cliente), entidade, operação e timestamp do cliente.
- **FR-038**: O sistema MUST processar a Outbox em ordem FIFO com retry, registrando tentativas e último erro.
- **FR-039**: O sistema MUST sincronizar automaticamente ao restabelecer a conexão e disponibilizar ação "Sincronizar agora".
- **FR-040**: A sincronização MUST ser idempotente via deduplicação por `(household_id, sync_id, entidade)`.
- **FR-041**: O servidor MUST ser o source-of-truth; o pull MUST ser por delta (cursor) e incluir soft deletes.
- **FR-042**: O sistema MUST resolver conflitos por Last-Write-Wins (`updated_at` UTC do servidor), com vitória do servidor em empate e marcação de conflito sem sobrescrita silenciosa.
- **FR-043**: O sistema MUST descartar itens órfãos da Outbox (update de registro deletado) com aviso, sem recriar o registro.
- **FR-044**: O sistema MUST exibir estado offline/sincronizando, contagem de pendentes e permitir sincronização manual.

**H. Dashboard básico**

- **FR-045**: O dashboard MUST ser a tela inicial pós-login e carregar primeiro do cache local.
- **FR-046**: O dashboard MUST apresentar os 8 blocos: saldo total da família; saldos por conta; gastos do mês (Eu x Ela x Ambos com percentuais); vencimentos próximos (7 dias + vencidas); faturas de cartão abertas/fechadas não pagas; lançamentos recentes; total a pagar em 30 dias; status offline/sync com Outbox.
- **FR-047**: O dashboard MUST atualizar automaticamente após a sincronização sem bloquear a interface.

**I. Categorias**

- **FR-048**: O sistema MUST criar, no onboarding da família, categorias padrão de seed BR agrupadas por tipo (entrada/saída).
- **FR-049**: Categorias de sistema MUST poder ser editadas/ocultadas, mas não excluídas; categorias customizadas podem ser criadas e excluídas (soft delete).

**J. App Lock**

- **FR-050**: O sistema MUST oferecer App Lock opcional por usuário, desativado por padrão, com reautenticação biométrica (WebAuthn Platform Auth) após tempo de inatividade configurável (1/5/10/30 min ou nunca).
- **FR-051**: O App Lock MUST exibir dados somente após reautenticação bem-sucedida quando ativo.
- **FR-052**: O sistema MUST informar indisponibilidade e não bloquear quando a biometria não estiver disponível.

**K. Segurança e auditoria (transversal)**

- **FR-053**: Todas as regras de negócio e de autorização MUST ser validadas no backend, independentemente do cliente.
- **FR-054**: Todo payload de entrada e de sincronização MUST ser validado no servidor antes de ser aplicado.
- **FR-055**: Ações sensíveis (convites, papéis, alterações de segurança, exclusões) MUST gerar registro de auditoria com autor, entidade, antes/depois e data.
- **FR-056**: O sistema MUST limitar tentativas e proteger contra CSRF/XSS, retornando `429` + `Retry-After`: Magic Link `5/15min` por e-mail+IP, verificação 2FA `5/10min` por usuário, convite `10/dia` por household, sync `60/min` por usuário.
- **FR-057**: O sistema MUST responder a falhas de segurança bloqueando temporariamente a conta após 5 tentativas de 2FA inválidas em 15 min, revogando sessões e dispositivos confiáveis e notificando o titular por e-mail, com registro em `audit_logs`.
- **FR-058**: O sistema MUST exibir e contabilizar os itens marcados `conflict=true` no indicador de sync, mostrando o estado do servidor e permitindo ao usuário revisar/aceitar, sem sobrescrita silenciosa.
- **FR-059**: Ao editar ou excluir (soft delete) um lançamento vinculado a fatura, o sistema MUST recalcular a fatura afetada (e a próxima, se o vencimento mudar), preservando a consistência das parcelas, com auditoria.

### Non-Functional Requirements

- **NFR-001 (Segurança/Privacidade)**: Nenhum dado de uma família pode ser acessível a outra; 100% das consultas e mutações aplicam `household_id` validado no backend.
- **NFR-002 (Segurança)**: Segredos (2FA, tokens, subscriptions) não podem ser expostos em logs ou respostas do cliente.
- **NFR-003 (Offline)**: O app deve abrir e permitir leitura/escrita sem rede; nenhuma operação principal depende de conexão estar online.
- **NFR-004 (Confiabilidade)**: A sincronização é idempotente e convergente: reenvios e reconexões não produzem duplicatas nem perda de dados.
- **NFR-005 (Consistência)**: Conflitos seguem regra única e previsível, com marcação explícita; nenhum conflito é resolvido silenciosamente contra o servidor.
- **NFR-006 (Desempenho)**: A UI responde a ações locais em ≤100 ms (p95, feedback otimista) e o dashboard renderiza do cache antes de qualquer chamada de rede.
- **NFR-007 (Acessibilidade)**: Navegação por teclado, foco visível, contraste adequado e rótulos ARIA; critérios de acessibilidade aplicados desde o MVP.
- **NFR-008 (Localização)**: Toda interface em pt-BR e todos os valores monetários exibidos em R$ no formato pt-BR.
- **NFR-009 (Observabilidade)**: Operações de sync, autenticação e ações sensíveis emitem log estruturado com contexto, `household_id` e resultado, sem dados sensíveis; falhas de sync expõem último erro e tentativas.
- **NFR-010 (Tipagem/Validação)**: Contratos entre cliente e servidor são validados por esquema compartilhado; entradas inválidas são rejeitadas no servidor.
- **NFR-011 (Evolução)**: A solução deve ser migrável e preparada para multimoeda/Open Finance sem reescrita do domínio, sem ativá-los no MVP.
- **NFR-012 (Compatibilidade)**: O app deve funcionar como PWA instalável em Android/Chrome e iOS 16.4+; recursos offline/core funcionam mesmo onde push não é suportado.
- **NFR-013 (Auditoria/Retenção)**: Dados excluídos permanecem recuperáveis via soft delete; registros de auditoria são preservados.
- **NFR-014 (Versionamento)**: Mudanças de contrato/API e de dados devem ser versionadas com plano de migração; atualizações de PWA ocorrem por prompt controlado, sem interromper sincronizações.
- **NFR-015 (Resposta a incidentes de segurança)**: Falhas repetidas de 2FA e acessos cross-household negados geram bloqueio/revogação com limiar e tempo definidos, notificação ao titular e trilha auditável.

### Key Entities *(include if feature involves data)*

- **Household**: espaço da família; moeda base BRL; configurações; criador; timestamps.
- **User**: identidade; estado de 2FA, credenciais WebAuthn, dispositivos confiáveis, último login.
- **HouseholdMember**: vínculo usuário↔família com papel (`owner/partner/teen/child/viewer`) e status de convite.
- **Invite**: convite com token único, papel, expiração e uso único.
- **Account**: conta da família com tipo, moeda, saldo inicial e inclusão no saldo total.
- **CreditCard**: cartão vinculado a conta, com limite, fechamento e vencimento.
- **Category**: categoria de entrada/saída, agrupada, com marca de sistema.
- **Transaction**: lançamento (receita/despesa/transferência) com valor, data, atribuição, status, vínculo a conta/cartão/categoria/fatura/parcela e `sync_id`.
- **Installment**: parcela de compra parcelada com número, total e fatura vinculada.
- **Invoice**: fatura de cartão por mês de referência com fechamento, vencimento, valor e status.
- **Transfer**: movimentação entre contas de origem e destino (não é receita/despesa).
- **Bill**: conta a pagar/receber fixa/variável com vencimento, natureza, atribuição e status.
- **Outbox/SyncEvent**: item de sincronização com operação, entidade, payload, `sync_id`, status e tentativas.
- **AuditLog**: trilha de ações críticas com autor, ação, entidade, antes/depois e data.
- **NotificationPreference**: (preparação futura) preferências de notificação por usuário — não usada no MVP.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Um usuário conclui o primeiro acesso (Magic Link + 2FA quando exigido) e chega ao dashboard em menos de 3 minutos.
- **SC-002**: 100% das tentativas de acesso cross-household são negadas em testes automatizados.
- **SC-003**: Um usuário registra um lançamento offline em menos de 15 segundos, sem depender de rede.
- **SC-004**: Após reconexão, 100% dos itens da Outbox são sincronizados sem duplicação em 5 tentativas de reenvio/retry.
- **SC-005**: 100% dos conflitos definidos (update/update, create/delete, delete/update) seguem a regra especificada e são marcados, sem perda silenciosa de dados.
- **SC-006**: O dashboard apresenta os 8 blocos com valores coerentes para um mês de referência em 100% dos casos de teste.
- **SC-007**: O cálculo de faturas e parcelas (inclusive compras no limite do ciclo) corresponde ao esperado em 100% dos cenários de teste.
- **SC-008**: Ações sensíveis exigem 2FA step-up em 100% das tentativas e geram auditoria.
- **SC-009**: 90% dos usuários conseguem concluir as tarefas primárias (lançar, transferir, ver dashboard) na primeira tentativa, sem ajuda.
- **SC-010**: A interface funciona em pt-BR com valores em R$ e atende verificação de acessibilidade por teclado em todas as telas do MVP.
- **SC-011**: Todos os requisitos obrigatórios do MVP (Fases 1–4) têm testes automatizados das regras de negócio passando.

## Assumptions

- O plano em `plano-controle-financeiro-casal-finalizado.md` é a fonte de verdade dos requisitos; esta especificação apenas os organiza e torna testáveis.
- MVP corresponde às Fases 1–4 do plano: auth Magic Link + 2FA step-up, família com RBAC, contas e lançamentos manuais, transferências, contas fixas/variáveis, cartões com faturas/parcelas, offline-first com Outbox e Dashboard com 8 blocos.
- O "source-of-truth" é o servidor; clientes offline convergem via push/pull por delta — premissa validada pelos casos de borda de conflito (Create vs Delete, Delete vs Update, reenvio/retry) e pela marcação `conflict=true`.
- Regra de conflito adotada: Last-Write-Wins por `updated_at` UTC do servidor, servidor vence em empate, conflito marcado (`conflict=true`) e nunca resolvido silenciosamente.
- 2FA do MVP usa TOTP; passkeys/WebAuthn ficam para evolução futura (App Lock usa WebAuthn Platform Auth no MVP).
- Não haverá criptografia do armazenamento local no PWA; a proteção adotada é App Lock + sessões curtas + 2FA step-up + servidor como source-of-truth.
- Limite recomendado de 2 adultos plenos por família; filhos com escopo restrito.
- Moeda base é BRL; multimoeda ativa não faz parte do MVP.
- Notificações Web Push (Fase 5) e geração automática de recorrências/orçamentos (Fases 5–6) estão fora do MVP.
- A UI é mobile-first e em pt-BR/R$.

## Out of Scope (não faz parte do MVP)

- **Open Finance** (leitura de contas bancárias) — Fase 7.
- **Importação CSV/OFX** — Fase 7.
- **Orçamentos** (por categoria, alertas de %) — Fase 6.
- **Multimoeda ativa** (cotações por data) — Fase 7; apenas preparação estrutural.
- **Web Push / Notificações configuráveis** — Fase 5.
- **Geração automática de recorrências (RRULE)** — Fase 6; no MVP as contas fixas/variáveis são gerenciadas manualmente.
- **Passkeys/WebAuthn como fator de autenticação** — Fase 7 (WebAuthn no MVP é apenas para App Lock).
- **Exportação de dados** (relatórios/backup/LGPD) — pós-MVP.
- **Exclusão em lote** — pós-MVP; no MVP as exclusões são individuais (soft delete + auditoria).
