# Feature Specification: PWA Instalável e Notificações Configuráveis

**Feature Branch**: `002-pwa-notifications`

**Created**: 2026-10-02

**Status**: Draft

**Input**: User description: "Fase 5 – PWA + Notificações Configuráveis: instalação do app, atualização controlada, atalho de novo lançamento e Web Push com preferências por usuário (tipos de lembrete, dias antes, quiet hours e horário de envio), com rotina agendada de lembretes."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Ativar notificações no dispositivo (Priority: P1)

Um membro da família ativa as notificações no seu dispositivo, autoriza a permissão do
navegador e pode enviar uma notificação de teste para confirmar que vai receber os
lembretes. Pode desativar a qualquer momento.

**Why this priority**: Sem o opt-in explícito e sem uma inscrição válida por dispositivo,
nenhum lembrete pode ser entregue. É a base de toda a Fase 5.

**Independent Test**: Ativar notificações, autorizar a permissão, receber uma notificação
de teste e desativar; confirmar que a inscrição é removida e não há mais envios.

**Acceptance Scenarios**:

1. **Given** um usuário autenticado sem notificações ativas, **When** ativa as notificações
   e concede a permissão, **Then** o sistema registra a inscrição do dispositivo e confirma
   a ativação.
2. **Given** notificações ativas, **When** o usuário solicita uma notificação de teste,
   **Then** a notificação é exibida no dispositivo em poucos segundos.
3. **Given** notificações ativas, **When** o usuário desativa, **Then** a inscrição é
   removida e novos lembretes deixam de ser enviados para aquele dispositivo.
4. **Given** permissão negada ou indisponível, **When** o usuário tenta ativar, **Then** o
   sistema informa claramente que não é possível, sem bloquear o uso do app.

---

### User Story 2 - Configurar preferências de lembrete (Priority: P1)

O usuário escolhe quais tipos de lembrete quer receber (contas a pagar, contas a receber,
faturas de cartão, contas fixas/recorrentes), quantos dias antes, o horário preferido de
envio e o período de silêncio (quiet hours).

**Why this priority**: Sem controle por tipo e por antecedência, o volume de notificações
seria inútil e intrusivo; é o diferencial pedido (#9).

**Independent Test**: Ajustar tipos, dias antes, horário de envio e quiet hours, salvar e
reabrir as preferências confirmando que os valores persistem.

**Acceptance Scenarios**:

1. **Given** um usuário com notificações ativas, **When** define os dias antes e o horário
   preferido, **Then** as preferências são salvas e reaplicadas em novos lembretes.
2. **Given** um tipo de lembrete desabilitado, **When** chega a data prevista, **Then**
   nenhuma notificação daquele tipo é enviada.
3. **Given** quiet hours configuradas, **When** o horário preferido cai dentro do silêncio,
   **Then** o envio é adiado para o fim do silêncio.
4. **Given** múltiplos dispositivos inscritos, **When** as preferências mudam, **Then**
   todos passam a respeitar a nova configuração.

---

### User Story 3 - Receber lembretes de vencimentos (Priority: P2)

Nos dias configurados antes do vencimento, o usuário recebe um lembrete de uma conta a
pagar/receber e, de forma prioritária, das faturas de cartão a vencer.

**Why this priority**: É o valor central das notificações; depende das preferências (US2) e
das contas/faturas já existentes no app.

**Independent Test**: Com uma conta a vencer em 3 dias e o lembrete de 3 dias habilitado,
confirmar que a notificação é emitida no horário preferido com o resumo do valor e data.

**Acceptance Scenarios**:

1. **Given** contas a pagar com vencimento em D-N e o lembrete habilitado, **When** chega o
   horário preferido desse dia, **Then** cada usuário elegível recebe uma notificação com
   título, valor e vencimento.
2. **Given** uma fatura próxima do vencimento e o lembrete habilitado, **When** chega o
   horário preferido, **Then** a notificação de fatura é priorizada e enviada mesmo com
   alto volume de contas.
3. **Given** uma conta já paga ou cancelada, **When** chega o dia do lembrete, **Then**
   nenhuma notificação é enviada para ela.
4. **Given** envios já feitos no dia para o mesmo item e usuário, **When** a rotina roda
   novamente, **Then** não há notificação duplicada.

---

### User Story 4 - Atualização controlada e atalho do app instalado (Priority: P3)

O usuário instala o app na tela inicial, tem o atalho "Novo Lançamento" e é avisado quando
há uma nova versão, podendo escolher quando atualizar sem interromper a sincronização.

**Why this priority**: Melhora a experiência de uso diário, mas não é pré-requisito dos
lembretes.

**Independent Test**: Instalar o app, abrir pelo atalho de novo lançamento e, com uma nova
versão publicada, ver o aviso de atualização e optar por atualizar depois mantendo o uso.

**Acceptance Scenarios**:

1. **Given** o app aberto no navegador compatível, **When** o usuário o instala, **Then**
   passa a abrir em modo aplicativo com nome, ícone e cor corretos.
2. **Given** o app instalado, **When** o usuário usa o atalho "Novo Lançamento", **Then** o
   formulário de novo lançamento é aberto diretamente.
3. **Given** uma nova versão disponível, **When** o usuário está sincronizando, **Then** o
   aviso de atualização não interrompe a sincronização e o usuário decide quando aplicar.

---

### Edge Cases

- Permissão de notificação negada, revogada depois de concedida ou indisponível no
  dispositivo (ex.: versões mais antigas do iOS): o app informa e continua funcional.
- Inscrição expirada/invalidada pelo navegador: deve ser descartada e re-solicitada.
- Múltiplos dispositivos do mesmo usuário: cada um recebe uma vez; remover um não afeta os
  demais.
- Quiet hours cruzando a meia-noite (ex.: 22:00–07:00) e mudança de fuso do usuário.
- Conta sem vencimento definido, fatura sem valor total ou com total zero.
- Items já pagos/cancelados, soft-deleted ou de household diferente não geram lembrete.
- Usuário removido do household ou com conta bloqueada por segurança não recebe lembretes.
- Falha de entrega no provedor de push: registrar e tentar novamente sem duplicar.
- Usuário offline no horário do envio: a notificação é entregue quando o push chegar.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Usuários MUST poder ativar e desativar notificações push por dispositivo, com
  opt-in explícito e consentimento do navegador.
- **FR-002**: O sistema MUST armazenar a inscrição de push por usuário e por dispositivo,
  suportando múltiplos dispositivos e remoção individual.
- **FR-003**: O sistema MUST permitir o envio de uma notificação de teste ao ativar.
- **FR-004**: O sistema MUST descartar inscrições inválidas/expiradas e informar o usuário.
- **FR-005**: Usuários MUST poder configurar, por tipo de lembrete, se está habilitado e
  quais dias antes notificar, a partir de um conjunto de opções predefinidas.
- **FR-006**: Os tipos de lembrete MUST incluir: contas a pagar (saídas), contas a receber
  (entradas), faturas de cartão de crédito e contas fixas/recorrentes.
- **FR-007**: Usuários MUST poder definir um horário preferido de envio diário.
- **FR-008**: Usuários MUST poder definir um período de silêncio (quiet hours) com início e
  fim, inclusive cruzando a meia-noite.
- **FR-009**: O sistema MUST adiar envios que caiam no período de silêncio para o primeiro
  horário permitido após o fim do silêncio.
- **FR-010**: O sistema MUST executar uma rotina agendada diária que avalia os vencimentos e
  dispara os lembretes conforme as preferências.
- **FR-011**: O lembrete de fatura de cartão MUST ser prioritário em relação aos demais.
- **FR-012**: O sistema MUST incluir no lembrete o item, o valor e a data de vencimento.
- **FR-013**: O sistema MUST NOT notificar itens já pagos, cancelados ou removidos.
- **FR-014**: O sistema MUST NOT enviar lembretes duplicados para o mesmo item, usuário e
  dia.
- **FR-015**: O sistema MUST respeitar o fuso horário de negócio ao calcular `D-N`, o
  horário preferido e o silêncio.
- **FR-016**: O sistema MUST NOT entregar lembretes a usuários removidos do household ou com
  conta bloqueada.
- **FR-017**: O sistema MUST registrar o resultado de cada envio (sucesso/falha) sem dados
  sensíveis, para diagnóstico.
- **FR-018**: O app MUST ser instalável com nome, ícone, cor e modo standalone.
- **FR-019**: O app instalado MUST oferecer o atalho "Novo Lançamento".
- **FR-020**: O app MUST avisar sobre nova versão disponível e permitir ao usuário escolher
  quando atualizar, sem interromper sincronização em andamento.
- **FR-021**: Usuários MUST receber feedback claro quando notificações não forem suportadas
  ou a permissão for negada, sem bloquear o uso do app.
- **FR-022**: As preferências de notificação MUST ser por usuário dentro do household.
- **FR-023**: O sistema MUST usar valores padrão seguros quando o usuário ainda não
  configurou preferências (silêncio 22:00–07:00 e horário 08:30), conforme a matriz de
  defaults, sem nunca notificar fora do horário permitido.

### Key Entities *(include if feature involves data)*

- **Preferência de Notificação**: percebe a um usuário e household; guarda por tipo
  (contas a pagar, contas a receber, fatura, fixas/recorrentes) o estado habilitado e a
  lista de dias antes, além de horário preferido e quiet hours.
- **Inscrição de Push**: percebe a um usuário e a um dispositivo; contém os dados técnicos
  necessários para entrega e o estado de validade, permitindo múltiplas inscrições.
- **Lembrete Agendado**: representa um envio planejado para um item (conta ou fatura) em um
  dia `D-N` para um usuário, com estado pendente/enviado/falho.
- **Evento de Entrega**: registro do resultado de cada tentativa de envio, para
  observabilidade e prevenção de duplicidade.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Usuários conseguem ativar notificações e receber a notificação de teste em
  menos de 1 minuto.
- **SC-002**: 95% dos lembretes são entregues dentro de 15 minutos do horário preferido.
- **SC-003**: 0 lembretes são entregues dentro do período de silêncio configurado.
- **SC-004**: Usuários conseguem concluir a configuração de tipos, dias antes, horário e
  silêncio em menos de 2 minutos.
- **SC-005**: 0 notificações duplicadas para o mesmo item, usuário e dia.
- **SC-006**: 100% dos itens já pagos/cancelados/removidos deixam de gerar lembretes.
- **SC-007**: O app instalado abre em modo aplicativo e o atalho "Novo Lançamento" abre o
  formulário correspondente em 1 toque.
- **SC-008**: O aviso de atualização não interrompe sincronizações em andamento em nenhuma
  ocorrência (medido pela ausência de falhas de sync correlacionadas em teste).

## Assumptions

- As notificações são opt-in e configuráveis apenas por usuário; não há canal por e-mail no
  escopo desta fase.
- Suporte a push é esperado em Android/Chrome/Edge e iOS 16.4+ (PWA instalado); em
  dispositivos sem suporte, o app permanece funcional e informa a limitação.
- Os lembretes baseiam-se nas contas/faturas já existentes (Fases anteriores), sem criar
  novos tipos de obrigação financeira.
- O horário de envio padrão é 08:30 e o silêncio padrão é 22:00–07:00 (timezone de negócio
  `America/Sao_Paulo`).
- A rotina de lembretes roda ao menos uma vez por dia por household; recorrências
  automáticas de contas (Fase 6) não fazem parte desta fase.
- A entrega depende do provedor de push do navegador; indisponibilidade momentânea não
  caracteriza falha do app.
- Atualização do app é decidida pelo usuário (sem auto-update forçado).
