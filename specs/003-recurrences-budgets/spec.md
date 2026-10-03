# Feature Specification: Recorrências (RRULE) e Orçamentos por Categoria

**Feature Branch**: `003-recurrences-budgets`

**Created**: 2026-10-02

**Status**: Draft

**Input**: User description: "Fase 6 – Recorrências + Orçamentos: recorrências com RRULE (RFC 5545), geração automática de lançamentos e orçamentos por categoria com alerta de percentual utilizado."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Lançamentos recorrentes automáticos (Priority: P1)

Um membro cria uma recorrência (ex.: salário mensal, assinatura anual, aluguel a cada
mês) informando a regra de repetição e um modelo de lançamento. O sistema gera os
lançamentos das ocorrências vencidas automaticamente, sem duplicar e respeitando o fim da
recorrência.

**Why this priority**: Elimina o trabalho manual de recriar lançamentos previsíveis; é o
núcleo da automação da Fase 6.

**Independent Test**: Criar uma recorrência mensal com data inicial no passado; executar a
geração; confirmar que os lançamentos esperados foram criados, e que nova execução não
duplica.

**Acceptance Scenarios**:

1. **Given** uma recorrência ativa com regra mensal, **When** a geração roda, **Then** cada
   ocorrência vencida desde a última execução gera exatamente um lançamento.
2. **Given** uma recorrência já gerada no período, **When** a geração roda novamente,
   **Then** nenhum lançamento duplicado é criado.
3. **Given** uma recorrência com fim (data ou número de ocorrências), **When** o limite é
   atingido, **Then** nenhuma ocorrência além do fim é gerada.
4. **Given** uma recorrência desativada, **When** a geração roda, **Then** nada é gerado.

---

### User Story 2 - Orçamentos por categoria com alerta (Priority: P1)

Um usuário define um orçamento (ex.: Alimentação R$ 1.500/mês) com um percentual de alerta
e acompanha quanto já gastou, com destaque quando ultrapassa o limite ou o alerta.

**Why this priority**: Dá visibilidade proativa do gasto e evita estourar o planejado.

**Independent Test**: Definir orçamento com limite e alerta; lançar despesas na categoria;
confirmar gasto acumulado, percentual e alertas nos limiares.

**Acceptance Scenarios**:

1. **Given** um orçamento mensal ativo, **When** despesas da categoria são lançadas no
   período, **Then** o gasto e o percentual utilizado são atualizados.
2. **Given** gasto acima do `alerta_pct`, **When** o resumo é exibido, **Then** há alerta de
   aproximação.
3. **Given** gasto acima do limite, **When** o resumo é exibido, **Then** há alerta de
   estouro.
4. **Given** orçamento trimestral/anual, **When** o período é calculado, **Then** considera
   apenas o intervalo correspondente.

---

### User Story 3 - Recorrência para contas a pagar/receber (Priority: P2)

O usuário cria uma recorrência que gera contas a pagar/receber (ex.: aluguel, internet),
com status pendente, aparecendo nos lembretes e nos totais previstos.

**Why this priority**: Complementa a automação para obrigações, conectando com as Fases
anteriores.

**Independent Test**: Criar recorrência de conta a pagar; gerar; confirmar as contas no mês
com vencimento e status corretos.

**Acceptance Scenarios**:

1. **Given** uma recorrência de conta a pagar com regra mensal, **When** a geração roda,
   **Then** as contas pendentes são criadas com vencimento conforme a regra.
2. **Given** uma conta gerada já paga, **When** a geração roda novamente, **Then** ela não
   é recriada nem alterada.

---

### Edge Cases

- Regra com `INTERVAL > 1`, "todo dia 31" em meses curtos (ajuste para o último dia).
- Data inicial no futuro: nada é gerado até a ocorrência existir.
- Mudança de horário de verão/fuso no cálculo das datas (`America/Sao_Paulo`).
- Recorrência editada/desativada: geração futura para; lançamentos passados permanecem.
- Item gerado editado ou excluído manualmente: não deve ser regenerado nem duplicado.
- Categoria de orçamento removida/ocultada: orçamento continua, sem estourar erro.
- Household sem contas/categorias compatíveis: geração falha de forma isolada e registra o
  motivo, sem interromper outros households.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Usuários MUST poder criar, editar, ativar/desativar e excluir recorrências com
  regra no padrão RRULE (RFC 5545).
- **FR-002**: A recorrência MUST suportar frequência, intervalo, dia(s) e limites
  (`COUNT`/`UNTIL`), no fuso de negócio `America/Sao_Paulo`.
- **FR-003**: O sistema MUST gerar automaticamente as ocorrências vencidas de cada
  recorrência ativa, uma vez por ocorrência.
- **FR-004**: A geração MUST ser idempotente: executar novamente não cria duplicatas.
- **FR-005**: O sistema MUST registrar a última e a próxima execução de cada recorrência.
- **FR-006**: O usuário MUST escolher o status dos lançamentos gerados (`pago`/`a pagar`).
- **FR-007**: A recorrência MUST poder gerar lançamentos financeiros ou contas a
  pagar/receber, conforme configuração.
- **FR-008**: O usuário MUST poder definir, por orçamento, nome, período (`mensal`,
  `trimestral`, `anual`), valor total e percentual de alerta.
- **FR-009**: O orçamento MUST permitir associar uma ou mais categorias, com limites
  opcionais por categoria.
- **FR-010**: O sistema MUST calcular o gasto do período por categoria e o percentual
  utilizado do orçamento.
- **FR-011**: O sistema MUST sinalizar aproximação (≥ `alerta_pct`) e estouro (> 100%) do
  orçamento.
- **FR-012**: O sistema MUST NOT contar lançamentos removidos, de outro household ou fora
  do período no cálculo do orçamento.
- **FR-013**: O sistema MUST isolar recorrências e orçamentos por `household` e aplicar
  RBAC (owner/partner gerenciam; demais conforme permissões).
- **FR-014**: A geração de ocorrências MUST ser observável (registro de execução sem dados
  sensíveis) e não deve interromper a sync do cliente.
- **FR-015**: Alterar/desativar/excluir uma recorrência MUST impedir novas gerações sem
  afetar lançamentos já criados.

### Key Entities *(include if feature involves data)*

- **Recorrência**: percebe a um household; guarda nome, regra RRULE, fuso, ativo,
  última/próxima execução, limites e o modelo do que gera (lançamento ou conta), incluindo
  valor, tipo, conta/cartão, categoria e atribuição.
- **Orçamento**: percebe a um household; guarda nome, período, valor total, percentual de
  alerta, ativo e a lista de categorias com limites opcionais.
- **Ocorrência Gerada**: lançamento ou conta criada a partir de uma recorrência, com
  vínculo à recorrência e à data de competência, garantindo idempotência.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Usuários conseguem configurar uma recorrência em menos de 2 minutos.
- **SC-002**: 100% das ocorrências vencidas são geradas na primeira execução, sem
  duplicatas em execuções repetidas.
- **SC-003**: 0 lançamentos gerados além do limite (`COUNT`/`UNTIL`) da recorrência.
- **SC-004**: O gasto do orçamento é atualizado imediatamente após um lançamento (na
  próxima leitura/sincronização), com erro de arredondamento zero (valores em centavos).
- **SC-005**: Alertas de aproximação e estouro aparecem exatamente nos limiares
  configurados.
- **SC-006**: Recorrências/orçamentos de um household não são visíveis nem alteráveis por
  outro household.

## Assumptions

- As regras usam o padrão RRULE; regras não suportadas são rejeitadas com mensagem clara.
- A geração roda no backend em cadência diária; atrasos de até um dia são aceitáveis no MVP.
- O orçamento considera despesas pagas e a pagar no período (não receitas), por padrão.
- Recorrências não geram parcelas nem faturas diretamente nesta fase; apenas lançamentos e
  contas.
- A moeda é BRL nesta fase (multimoeda fica para a Fase 7).
