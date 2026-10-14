# Plano de Melhorias — Controle Financeiro do Casal

Baseline para voltar em caso de arrependimento: **`2574f0c`** (branch `main`,
2026-10-13) — “fix(sync): fundir fatura duplicada em vez de falhar”.
Voltar: `git reset --hard 2574f0c` (ou `git checkout 2574f0c`).

## Contexto do casal (modelo real)

- O dinheiro é **conjunto**: não existe “dever um ao outro”.
- Contas do casal pagas ora por um, ora pelo outro; se falta dinheiro no mês,
  um pede/transfere para o outro.
- O que sobra cada um investe por conta própria.

Por isso a divisão/acerto entre o casal é **configurável**:

- **Modo `junto` (padrão)**: sem dívida. Mostra contribuições do mês (quanto
  cada um pagou/cobriu) e permite “pedir cobertura” ao parceiro.
- **Modo `dividir` (opcional)**: ativa o “Acerto do mês” com sugestão de
  transferência de quem adiantou para quem.

## Fases (cada marco = 1+ commits próprios)

### Fase A — Melhorias no que já existe
- [ ] A1. “A pagar 30 dias” não duplica faturas: compras do cartão (vínculo
      `invoice`) saem do “a pagar”; só a fatura representa o compromisso.
- [ ] A2. Esconder contas internas de cartão (`type = cartao_credito`) das
      listas de contas e de “Saldos por conta”.
- [ ] A3. Corrigir truncamentos de título/vencimento no mobile (Contas e
      Lançamentos).
- [ ] A4. Cartão mostra “fecha dia X · vence dia Y” em vez de “•••• X/Y”.
- [ ] A5. Editar compra no cartão: permitir trocar o cartão (realoca a
      fatura) além de valor/descrição/categoria; parcelas em fase futura.
- [ ] A6. “Gastos do mês” passa a incluir atribuições sem pessoa vinculada
      (Indefinido/legado).
- [ ] A7. Conflitos de sincronização persistem entre sessões e ganham texto
      simples para leigos.
- [ ] A8. Orçamento com histórico mensal do uso (limite × gasto por mês).
- [ ] A9. Pagamento de fatura parcial: acumula `paid_cents`, não sobrescreve
      `total_cents`, e só marca “paga” ao quitar.

### Fase B — Modo do casal (configurável)
- [ ] B1. Config `split_mode` nas configurações da família (`junto` padrão ×
      `dividir`).
- [ ] B2. Modo `junto`: card “Contribuições do mês” (por pessoa) e ação
      “Pedir cobertura” (push para o parceiro).
- [ ] B3. Modo `dividir`: tela “Acerto do mês” (quem adiantou, sugestão de
      transferência e registro do acerto).

### Fase C — Busca, filtros e organização
- [ ] C1. Busca por texto + filtros de categoria e tipo nos lançamentos.
- [ ] C2. Tags na UI (campo já existe no banco): editar e filtrar.
- [ ] C3. Anexo de foto (cupom) no lançamento.

### Fase D — Metas e orçamento proativo
- [ ] D1. Metas/caixinhas compartilhadas (objetivo, aportes, progresso).
- [ ] D2. Notificação push de orçamento (70/90/100% do limite).
- [ ] D3. Projeção de gasto do mês (ritmo atual × limite).

### Fase E — Relatórios e calendário
- [ ] E1. Fechamento do mês do casal (resumo por pessoa, categorias,
      comparativo e card compartilhável).
- [ ] E2. Calendário financeiro (contas, faturas e recorrências).
- [ ] E3. Exportar dados (CSV dos lançamentos + backup JSON) pela UI.

### Fase F — Import e conveniência
- [ ] F1. Regras de categorização por descrição no import.
- [ ] F2. Atalhos PWA (novo lançamento direto).
- [ ] F3. Onboarding com dados de exemplo.
- [ ] F4. Ações na notificação (abrir item; marcar como paga).

### Fase G — Investimentos
- [ ] G1. Contas de investimento por pessoa: aportes, rendimentos e evolução.

## Regras do processo

- Cada item/marco fecha com `lint`, `typecheck` e testes verdes.
- Commits pequenos e temáticos; deploy local ao fim de cada fase.
- Ao fim de cada fase, anotar aqui o commit do marco.
