# API Contracts — Controle Financeiro Familiar Offline-First

Contratos HTTP expostos pelo backend PocketBase (coleção de rotas customizadas em
`pb_hooks` + rotas nativas autenticadas). Os schemas canônicos vivem em
`packages/shared/src/api` (Zod) e são a fonte de verdade; os arquivos OpenAPI aqui são a
documentação legível.

- [`auth-api.yaml`](./auth-api.yaml) — autenticação, 2FA step-up, dispositivos e convites.
- [`sync-api.yaml`](./sync-api.yaml) — push/pull de sincronização offline.

## Convenções

- **Base URL**: `/api` (versionamento por prefixo de recurso; mudanças incompatíveis
  exigem novo sufixo, ex.: `/api/v2`).
- **Autenticação**: `Authorization: Bearer <token>` (JWT curto). Ações sensíveis exigem
  adicionalmente `X-Step-Up-Token: <token>` de curta duração emitido por `/api/auth/2fa/verify`.
- **Content-Type**: `application/json` (exceto upload de anexo).
- **Idempotência**: itens de sync carregam `sync_id` (UUID); requisições de auth/convite
  usam `Idempotency-Key` opcional. Reenvios são seguros.
- **Envelope de erro** (todas as rotas):

  ```json
  {
    "error": {
      "code": "validation_error",
      "message": "Mensagem em pt-BR para o usuário",
      "details": [{ "path": "amount_cents", "issue": "must be a positive integer" }]
    }
  }
  ```

- **Códigos**: `400` validação, `401` não autenticado, `403` sem permissão / step-up
  necessário (`step_up_required`), `404` inexistente, `409` conflito de estado, `422`
  regra de negócio, `429` rate limit, `500` erro interno.
- **Isolamento**: todo recurso é escopado por `household` derivado da sessão; nunca do
  corpo da requisição. Acesso cruzado retorna `403`.
- **Rate limiting**: login/magic-link/convite/sync retornam `429` + `Retry-After`.
- **Datas**: `YYYY-MM-DD` para calendário; timestamps ISO 8601 UTC.
- **Dinheiro**: inteiro de centavos (`*_cents`).

## Rotas nativas utilizadas

Leitura de dados ocorre por `/api/sync/pull` (não há leitura direta da UI via REST, pois a
UI lê do Dexie). Rotas nativas do PocketBase são usadas apenas para autenticação de sessão
básica quando aplicável (`/api/collections/users/auth-refresh`, `/api/collections/users/auth-with-password`
desabilitada). Toda escrita de domínio passa por `/api/sync/push`.
