# Comandos SDD (Spec Kit) — Controle Financeiro do Casal

> Já existe um plano desenhado em `plano-controle-financeiro-casal-finalizado.md`.
> Os comandos abaixo **reaproveitam esse arquivo** (`@...`) em vez de reescrever o conteúdo.
> Execute **um comando por mensagem** no chat do opencode e revise o resultado antes de seguir.
> A ordem importa: `constitution → specify → (clarify) → plan → tasks → (analyze/checklist) → implement → converge`.

## Ordem e repetição

| Comando | Quando | Repete? |
|---|---|---|
| `constitution` | 1x por projeto | Só se mudar princípios |
| `specify` | por feature | 1x |
| `clarify` | opcional (antes do plan) | Pode repetir |
| `plan` | por feature | 1x |
| `tasks` | por feature | 1x |
| `analyze` / `checklist` | opcional (após tasks) | Pode repetir |
| `implement` | por feature | Pode retomar |
| `converge` | após implement | Repetir até "Converged" |

Fluxo mínimo sem opcionais: `constitution → specify → plan → tasks → implement → converge`.

---

## 1) Constituição (uma vez)

```text
/speckit.constitution Crie a constituição do projeto "Controle Financeiro do Casal". Princípios priorizados: (1) Segurança e privacidade de dados financeiros: isolamento total por household, validação e regras SEMPRE no backend (nunca confiar no front), 2FA por step-up, menor privilégio, soft delete e auditoria de ações sensíveis; (2) Offline-first confiável: funciona sem rede, escrita local-first com fila Outbox, sincronização idempotente (sync_id), servidor como source-of-truth e conflitos previsíveis; (3) Qualidade e tipagem forte: TypeScript strict, Zod no client e no server, sem any implícito; (4) Testes automatizados obrigatórios para regras de negócio (cartão/fatura/parcelas, recorrência, transferências, sync/conflitos); (5) Simplicidade e evolução incremental: MVP enxuto, sem overengineering, pronto para migração; (6) UX mobile-first, acessível, pt-BR e R$; (7) Observabilidade e versionamento claros. Stack: PWA Vue 3 + Vite + TypeScript, backend PocketBase, offline com Dexie.js, Web Push (VAPID).
```

## 2) Especificação (usa o plano existente)

```text
/speckit.specify Crie a especificação da feature "Controle Financeiro Familiar Offline-First" com base no arquivo @plano-controle-financeiro-casal-finalizado.md. NÃO reescreva o plano: extraia dele os requisitos. Escopo do MVP = Fases 1 a 4 do plano (auth Magic Link + 2FA step-up, família com RBAC, contas e lançamentos manuais, transferências, contas fixas/variáveis, cartões de crédito com faturas/parcelas, offline-first com Outbox e Dashboard Básico com os 8 blocos). Escreva requisitos funcionais e não funcionais com critérios de aceite verificáveis (Given/When/Then), incluindo casos de borda de sincronização e conflito. Fora do MVP: Open Finance, import CSV/OFX, orçamentos e multimoeda ativa.
```

## 3) Clarificar (opcional, recomendado antes do plan)

```text
/speckit.clarify Foque em lacunas de: permissões dos papéis (owner/partner/teen/child/viewer), limite de membros, comportamento da fatura quando o lançamento cruza o fechamento, e política exata de conflitos (LWW vs servidor vence). No máximo 5 perguntas; registre as respostas na spec.
```

## 4) Plano técnico

```text
/speckit.plan Considere a stack já definida no @plano-controle-financeiro-casal-finalizado.md. Stack: PWA com Vue 3 + Vite + TypeScript, UI com Tailwind CSS e shadcn-vue, offline-first com Dexie.js e Vite PWA (Workbox), validação com Zod (client e server). Backend: PocketBase self-host (collections + regras de acesso + hooks), auth com Magic Link e TOTP (2FA step-up), App Lock por WebAuthn Platform Auth. Sync via /api/sync/push e /api/sync/pull com delta, sync_id e soft delete. Notificações Web Push (VAPID). Hospedagem: front em Cloudflare Pages/Vercel, backend em Docker/VPS. Gere data model, contratos de API, estrutura de pastas e estratégia de testes.
```

## 5) Tarefas

```text
/speckit.tasks
```

## 6) Consistência / Qualidade (opcionais)

```text
/speckit.analyze
```

```text
/speckit.checklist Qualidade dos requisitos de segurança, offline/sincronização e regras de cartão de crédito.
```

## 7) Implementar

```text
/speckit.implement
```

## 8) Convergir (repetir até "Converged")

```text
/speckit.converge
```

---

## Observações

- Não é possível empilhar vários comandos numa mensagem. Existe **encadeamento** por *handoffs* (ex.: `specify` oferece "Clarify"/"Plan"; `tasks` oferece "Analyze"/"Implement") — aceite para avançar sem digitar tudo.
- Sintaxe do opencode é com ponto: `/speckit.<nome>` (arquivos em `.opencode/commands/`).
- Sempre revise cada artefato gerado (`.specify/` e pasta da feature) antes de seguir para o próximo comando.
