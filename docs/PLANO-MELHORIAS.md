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

### Fase A — Melhorias no que já existe ✅ (concluída)
- [x] A1. “A pagar 30 dias” não duplica faturas — `14ae06d`.
- [x] A2. Esconder contas internas de cartão — `6211bd4`.
- [x] A3. Menos truncamento de título/datas no mobile — `01ab880`.
- [x] A4. Cartão com “fecha dia X · vence dia Y” — `75a0ece`.
- [x] A5. Trocar o cartão de uma compra (move a fatura) — `9926d80`.
- [x] A6. “Gastos do mês” com Indefinido e legado — `6211bd4`.
- [x] A7. Conflitos persistidos + linguagem simples — `533b8fd`.
- [x] A8. Histórico mensal de orçamento — `d45b30e`.
- [x] A9. Pagamento parcial de fatura — `6be47bc`.

### Fase B — Modo do casal (configurável) ✅ (concluída)
- [x] B1. Config `split_mode` na Família (`junto` padrão × `dividir`) — `cc7eecf`.
- [x] B2. Cálculo do acerto (shared) — `76db383`; tela “Contribuições do mês”
      no modo junto.
- [x] B3. Tela “Acerto do mês” no modo dividir, com sugestões de
      transferência e registro do acerto — `b8c6403`.
- [x] B4. “Pedir cobertura” por push ao par (migração + endpoint + notifier +
      tela) — `b1f5fbe`.

### Fase C — Busca, filtros e organização ✅ (concluída)
- [x] C1. Busca por texto + filtros de categoria e tipo — `8c84cbd`.
- [x] C2. Etiquetas na UI (formulário, filtro e destaque na lista) — `8c84cbd`.
- [x] C3. Anexo de foto (cupom) comprimido, offline-first — `9d05797`.

### Fase D — Metas e orçamento proativo ✅ (concluída)
- [x] D1. Metas/caixinhas compartilhadas (aporte, resgate, histórico) — `6f5cfc4`.
- [x] D2. Push de orçamento em 70/90/100% (1× por limiar por período) — `8911cbe`.
- [x] D3. Projeção do gasto no ritmo atual × limite — `f602c18`.

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
