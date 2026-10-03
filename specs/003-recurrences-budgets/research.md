# Research & Technical Decisions — Recorrências e Orçamentos

**Fase 0** — decisões da Fase 6. Sem `NEEDS CLARIFICATION`.

## R1. Motor de recorrência (RRULE)

- **Decision**: usar a biblioteca `rrule` (RFC 5545) dentro de `@cf/shared` e empacotá-la
  para os hooks (`shared.js`).
- **Rationale**: cobre FREQ/INTERVAL/BYDAY/BYMONTHDAY/COUNT/UNTIL com confiabilidade;
  testável de forma pura e reutilizável no cliente e no servidor.
- **Alternatives considered**: parser próprio (subconjunto frágil); `rrule` no hook via npm
  (o bundle CJS resolve o mesmo).

## R2. Onde gerar as ocorrências

- **Decision**: cron diário nos hooks do PocketBase (`cronAdd`), executando por household.
- **Rationale**: geração é lógica pura (sem criptografia), então cabe no Goja; mantém o
  servidor como source-of-truth e não exige novo serviço.
- **Alternatives considered**: gerar no notifier Node (acoplaria responsabilidades);
  gerar no cliente (não confiável e offline-perigoso).

## R3. Idempotência da geração

- **Decision**: cada lançamento/conta gerado guarda o vínculo `recurrence` e a data de
  competência; antes de criar, procura existente por `(recurrence, date)` e ignora.
- **Rationale**: reexecução segura (FR-004) mesmo com falha parcial.
- **Alternatives considered**: tabela de ocorrências dedicada (mais complexa);
  `next_run` apenas (não protege contra reexecução/replay).

## R4. Limites e datas

- **Decision**: respeitar `COUNT`/`UNTIL`; dia inexistente no mês (ex.: 31) usa o último
  dia (clamp); cálculo em `America/Sao_Paulo`.
- **Rationale**: evita datas inválidas e comportamentos inesperados na virada do mês.
- **Alternatives considered**: pular meses sem o dia (surpreende o usuário).

## R5. Orçamento

- **Decision**: cálculo no cliente com funções puras em `@cf/shared`, sobre os lançamentos
  já em cache; orçamento é entidade sincronizável.
- **Rationale**: offline-first; sem necessidade de agregação server-side no MVP.
- **Alternatives considered**: cálculo no servidor (exigiria rota extra e cache duplicado).

## R6. Períodos

- **Decision**: `mensal`, `trimestral`, `anual` derivando o intervalo a partir de um mês de
  referência; considerar despesas (pago + a pagar) por padrão.
- **Rationale**: atende ao pedido com previsibilidade; alinhado aos totais existentes.
- **Alternatives considered**: períodos personalizados (complexidade fora do MVP).

## R7. Sincronização e RBAC

- **Decision**: `recurrences` e `budgets` entram no `/sync/push|pull` com as mesmas regras
  de isolamento; owner/partner gerenciam.
- **Rationale**: reaproveita o motor e os testes de isolamento já existentes.
- **Alternatives considered**: rotas CRUD dedicadas (mais código e caminhos divergentes).

## Fora de escopo (Fase 7)

Multimoeda ativa, import CSV/OFX/Open Finance e recorrências com fatura/parcela.
