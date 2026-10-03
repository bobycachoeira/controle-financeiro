# Research & Technical Decisions — Integrações, Multimoeda e Passkeys

## R1. Parsers CSV/OFX

- **Decision**: parsers próprios em `@cf/shared`, tolerantes a `,`/`;`, datas pt-BR e OFX
  SGML/XML.
- **Rationale**: formato bancário varia; regras puras testáveis e reutilizáveis offline.
- **Alternatives considered**: libs pesadas de OFX/CSV (overhead e pouca flexibilidade).

## R2. Idempotência da importação

- **Decision**: referência externa (`FITID` no OFX; hash determinístico da linha no CSV)
  gravada em `transactions.external_ref`; ignorar duplicatas.
- **Rationale**: reimportar o mesmo arquivo não duplica (FR-005).
- **Alternatives considered**: dedup por data/valor (falsos positivos).

## R3. Multimoeda

- **Decision**: `exchange_rates` com `currency`, `date` e `rate_micros` (inteiro,
  rate × 1e6); conversão `round(cents × rate_micros / 1e6)`.
- **Rationale**: evita float na conversão e mantém centavos; cotação por data com fallback
  para a mais recente anterior.
- **Alternatives considered**: taxa float (erro acumulado); feed externo (fora do escopo).

## R4. Passkeys

- **Decision**: preparar a estrutura (campo `webauthn_credentials` já existe e App Lock usa
  WebAuthn no cliente); verificação server-side de passkey fica adiada, mantendo TOTP no
  step-up.
- **Rationale**: verificação WebAuthn server-side exige biblioteca/criptografia não
  disponível no Goja; não compromete o MVP.
- **Alternatives considered**: verificação completa agora (inviável no runtime atual).

## R5. Open Finance

- **Decision**: feature-flag `CF_OPEN_FINANCE_ENABLED` exposta ao cliente; sem conexão real.
- **Rationale**: depende de provedor/regulação para PF; degradação graciosa (FR-014).
- **Alternatives considered**: integração direta (inviável/fora do escopo).
