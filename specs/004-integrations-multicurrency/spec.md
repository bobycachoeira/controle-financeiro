# Feature Specification: Integrações, Multimoeda e Passkeys

**Feature Branch**: `004-integrations-multicurrency`

**Created**: 2026-10-02

**Status**: Draft

**Input**: User description: "Fase 7 – Integrações + Futuro: import CSV/OFX, Open Finance (somente leitura, feature-flag), Passkeys/WebAuthn (ampliar step-up) e multimoeda ativa (#3) com cotações por data."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Importar lançamentos de CSV/OFX (Priority: P1)

O usuário importa um extrato em CSV ou OFX do seu banco, revisa uma prévia dos lançamentos
reconhecidos (data, valor, descrição) e confirma a importação para uma conta escolhida.

**Why this priority**: Reduz drasticamente o trabalho manual de entrada e é o maior ganho
imediato da fase.

**Independent Test**: Importar um arquivo de exemplo, conferir a prévia e confirmar;
verificar que os lançamentos foram criados na conta correta, sem duplicar itens já
existentes.

**Acceptance Scenarios**:

1. **Given** um arquivo CSV com cabeçalho e valores em pt-BR, **When** o usuário importa,
   **Then** o sistema reconhece data, valor, descrição e tipo (débito/crédito).
2. **Given** um arquivo OFX, **When** o usuário importa, **Then** o sistema reconhece os
   lançamentos (`DTPOSTED`, `TRNAMT`, `TRNTYPE`, `MEMO`).
3. **Given** uma linha inválida, **When** a prévia é exibida, **Then** a linha é marcada
   como erro e pode ser ignorada, sem interromper o restante.
4. **Given** lançamentos já importados (mesma referência externa), **When** importar de
   novo, **Then** não há duplicação.
5. **Given** a confirmação, **When** os lançamentos são criados, **Then** aparecem no
   dashboard e nos totais.

---

### User Story 2 - Multimoeda ativa com cotações por data (Priority: P2)

O usuário mantém contas em outras moedas, define a cotação para uma data e visualiza os
totais consolidados em BRL com a conversão aplicada.

**Why this priority**: Permite uso real fora do Brasil e consolidação correta do
patrimônio.

**Independent Test**: Criar conta em USD, informar cotação, lançar despesa e conferir que o
total consolidado reflete a conversão para BRL.

**Acceptance Scenarios**:

1. **Given** uma conta em moeda estrangeira, **When** há cotação para a data do lançamento,
   **Then** o valor é convertido para BRL usando a cotação mais próxima.
2. **Given** ausência de cotação, **When** os totais são calculados, **Then** o sistema
   sinaliza a pendência sem quebrar os demais totais.
3. **Given** a moeda base BRL, **When** os totais são exibidos, **Then** o comportamento
   atual é preservado (fator 1).

---

### User Story 3 - Passkeys como segundo fator (Priority: P3)

O usuário cadastra uma passkey e pode usá-la como segundo fator nas ações sensíveis,
fortalecendo o step-up.

**Why this priority**: Aumenta a resistência a phishing, mas o TOTP já cobre o MVP.

**Independent Test**: Cadastrar passkey, executar uma ação sensível confirmando com a
passkey e, na indisponibilidade, continuar podendo usar TOTP/recovery.

**Acceptance Scenarios**:

1. **Given** 2FA ativo, **When** o usuário cadastra uma passkey, **Then** ela pode ser usada
   no step-up.
2. **Given** passkey indisponível no dispositivo, **When** o usuário faz step-up,
   **Then** ainda pode usar TOTP.
3. **Given** revogação de passkey, **When** tenta usá-la, **Then** o acesso é negado.

---

### User Story 4 - Open Finance somente leitura (Priority: P3, feature-flag)

Com a funcionalidade habilitada e um provedor disponível, o usuário conecta uma conta e
importa saldos/lançamentos somente leitura.

**Why this priority**: Alto valor futuro, porém depende de integração externa e regulação;
fica atrás de feature-flag e fora do núcleo entregue.

**Independent Test**: Com a flag desligada, a funcionalidade não aparece; com a flag
ligada e sem provedor, exibe estado "indisponível".

**Acceptance Scenarios**:

1. **Given** a flag desligada, **When** o usuário abre as configurações, **Then** não há
   opção de Open Finance.
2. **Given** a flag ligada sem provedor configurado, **When** o usuário tenta conectar,
   **Then** vê um aviso de indisponibilidade, sem erro fatal.

---

### Edge Cases

- CSV com separador `,` ou `;`, codificação com acentos e valores negativos entre
  parênteses.
- OFX em SGML (sem fechamento de tags) e em XML.
- Datas ambíguas (dd/mm vs mm/dd): assume pt-BR como padrão.
- Arquivo muito grande: processar em blocos na prévia.
- Cotação com data futura ou muito antiga; múltiplas cotações no mesmo dia.
- Conversão com arredondamento para centavos sem perder precisão acumulada.
- Passkey em dispositivo sem autenticador; usuário sem passkey cadastrada.
- Flag de Open Finance alterada em runtime.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Usuários MUST poder importar extratos em CSV e OFX para uma conta escolhida.
- **FR-002**: O sistema MUST reconhecer data, valor, descrição e natureza (débito/crédito)
  de cada lançamento importado.
- **FR-003**: O sistema MUST exibir uma prévia com total, itens válidos e inválidos antes de
  confirmar.
- **FR-004**: O sistema MUST permitir ignorar linhas inválidas sem interromper a importação.
- **FR-005**: A importação MUST ser idempotente por referência externa (ex.: `FITID`/hash da
  linha), evitando duplicatas.
- **FR-006**: O sistema MUST registrar a origem (`import`) e a referência externa do
  lançamento importado.
- **FR-007**: Contas MUST poder ter moeda diferente da moeda base (BRL).
- **FR-008**: O sistema MUST armazenar cotações por moeda e data.
- **FR-009**: O sistema MUST converter valores de moedas estrangeiras para a moeda base
  usando a cotação da data (ou a mais próxima anterior).
- **FR-010**: O sistema MUST sinalizar ausência de cotação sem comprometer os demais totais.
- **FR-011**: Usuários MUST poder cadastrar, listar e revogar passkeys.
- **FR-012**: Passkeys MUST poder substituir o TOTP no step-up, mantendo TOTP/recovery como
  alternativas.
- **FR-013**: O sistema MUST negar o uso de passkeys revogadas.
- **FR-014**: Open Finance MUST estar atrás de feature-flag, somente leitura, e degradar
  graciosamente quando indisponível.
- **FR-015**: Todas as operações MUST respeitar isolamento por `household` e RBAC.
- **FR-016**: Importações e conversões MUST operar em centavos inteiros, sem ponto flutuante.

### Key Entities *(include if feature involves data)*

- **Importação**: percebe a um household/conta; guarda formato, referência externa,
  contagem de itens e data da importação.
- **Moeda/Cotação**: par moeda→BRL por data, usado na conversão consolidada.
- **Passkey**: credencial WebAuthn do usuário (id, chave pública, rótulo, contador,
  revogação).

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Importar um extrato de até 500 linhas leva menos de 1 minuto e mostra a
  prévia antes de confirmar.
- **SC-002**: 0 duplicatas ao reimportar o mesmo arquivo.
- **SC-003**: 100% das linhas válidas reconhecidas em arquivos de exemplo CSV e OFX.
- **SC-004**: Totais consolidados em BRL corretos ao centavo com uma moeda estrangeira.
- **SC-005**: Ações sensíveis continuam funcionando com TOTP quando a passkey não está
  disponível.
- **SC-006**: Com a flag de Open Finance desligada, nenhuma superfície relacionada é
  exibida.

## Assumptions

- Formato de data padrão pt-BR (dd/mm/aaaa) quando ambíguo.
- Cotações entram manualmente (ou por importação futura); não há feed externo nesta fase.
- Open Finance depende de provedor/regulação e fica como feature-flag preparada, sem
  conexão real no MVP desta fase.
- Passkeys usam WebAuthn; quando indisponíveis, o TOTP permanece como fator.
