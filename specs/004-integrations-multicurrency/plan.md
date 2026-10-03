# Implementation Plan: Integrações, Multimoeda e Passkeys

**Branch**: `004-integrations-multicurrency` | **Date**: 2026-10-02 | **Spec**: [spec.md](./spec.md)

## Summary

Fase 7: importar extratos CSV/OFX (prévia + confirmação idempotente), multimoeda ativa com
cotações por data e consolidação em BRL, além de preparar Passkeys para step-up e Open
Finance atrás de feature-flag. Entregamos integralmente import e multimoeda; Passkeys e a
conexão Open Finance ficam como estrutura preparada/feature-flag (dependem de provedor e de
verificação server-side).

**Abordagem técnica**: parsers de CSV/OFX e conversão de moeda são regras puras em
`@cf/shared`, usadas pelo cliente e pelos hooks. Transações ganham `origin`/`external_ref`
para idempotência de importação; cotações ficam na collection `exchange_rates`. Open
Finance expõe apenas uma flag de configuração.

## Technical Context

**Language/Version**: TypeScript 5.4+; PocketBase 0.23+ (Goja).

**Primary Dependencies**: Zod, `@cf/shared`, Vue/Pinia/Dexie, `@simplewebauthn/browser`
(preparado para passkeys).

**Storage**: PocketBase SQLite; nova collection `exchange_rates`; campos
`origin`/`external_ref` em `transactions`.

**Testing**: Vitest para parsers/conversão; integração PocketBase para sync de
`exchange_rates` e campos de importação; E2E para importar e cotação.

**Target Platform**: PWA + backend Linux.

**Constraints**: centavos inteiros; BRL base; isolamento por `household`; Open Finance
feature-flag.

## Constitution Check

| Princípio | Gate | Status |
|-----------|------|--------|
| I. Segurança/Privacidade | Isolamento/BAC; nenhum provedor externo conectado sem flag. | PASS |
| II. Offline-First | Parsers no cliente; import via sync; cotações sincronizáveis. | PASS |
| III. Qualidade/Tipagem | Schemas/regras em `@cf/shared`; TS strict. | PASS |
| IV. Testes de Regras | Parsers, idempotência e conversão com testes. | PASS |
| V. Simplicidade | Sem novo serviço; Open Finance apenas flag. | PASS |
| VI. UX Mobile-First/a11y/pt-BR | Telas acessíveis e pt-BR. | PASS |
| VII. Observabilidade | Origem/referência registradas; sem segredos. | PASS |

## Project Structure

```text
specs/004-integrations-multicurrency/{plan,research,data-model,quickstart}.md
packages/shared/src/domain/
├── import.ts       # parseCSV, parseOFX, detectFormat
└── currency.ts     # convertCents, pickRate, consolidateToBRL
apps/pocketbase/pb_migrations/  # exchange_rates + origin/external_ref
apps/web/src/features/import/ImportView.vue
apps/web/src/features/settings/CurrenciesView.vue
```

## Complexity Tracking
> Sem violações.
