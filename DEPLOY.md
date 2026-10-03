# DEPLOY — o que você precisa fazer

Guia direto para subir **tudo na Oracle Cloud (Always Free)** em **um servidor só**
(front + backend), num único domínio/hostname. Para detalhes, veja
[`docs/DEPLOY-ORACLE-ALWAYS-FREE.md`](docs/DEPLOY-ORACLE-ALWAYS-FREE.md).

> **Posso testar por IP público antes de comprar domínio?** Pode, mas com ressalva:
> o Caddy **não emite HTTPS para IP** (Let's Encrypt não dá certificado de IP) e o **PWA
> exige HTTPS**. Então, para testar de verdade (PWA, Magic Link, service worker), use um
> **hostname grátis** apontando para o IP (DuckDNS ou `nip.io`). Depois você troca pelo
> domínio comprado mudando só `CF_DOMAIN`/`CF_APP_URL` + DNS.

---

## Visão geral

```
Navegador ─HTTPS─> app.<seu-host>  (Caddy na VM Oracle)
                    ├── /api/*  -> PocketBase
                    ├── /_/*    -> PocketBase (painel admin)
                    └── /*      -> web (PWA estático)
```

Tudo roda com Docker Compose. As **migrações rodam sozinhas** na primeira subida. Seu
banco fica no volume `pb_data`.

---

## Passo a passo

### 1. Criar a VM na Oracle
Compute → **Create Instance**:
- Imagem **Ubuntu 22.04/24.04**
- Shape **VM.Standard.A1.Flex** (Ampere/ARM), **1 OCPU / 6 GB** (até 4/24)
- Marcado **Assign a public IPv4**
- Sua chave SSH

### 2. Abrir as portas (são DUAS camadas)
**a) Security List / NSG da VCN** → Ingress Rules: TCP **22**, **80**, **443** de `0.0.0.0/0`.

**b) Firewall do próprio sistema** (a imagem Oracle bloqueia por padrão) — via SSH:
```bash
sudo iptables -I INPUT 6 -m state --state NEW -p tcp --dport 80 -j ACCEPT
sudo iptables -I INPUT 6 -m state --state NEW -p tcp --dport 443 -j ACCEPT
sudo netfilter-persistent save
```

### 3. Escolher o hostname (IP agora, domínio depois)
- **Teste grátis (recomendado):** crie um subdomínio no **DuckDNS** (ex.:
  `minhafamilia.duckdns.org`) apontando para o **IP da VM**. (Alternativa sem cadastro:
  use `SEU.IP.com.dashes.nip.io`, ex.: `1.2.3.4.nip.io`.)
- **Depois, com domínio comprado:** crie o registro **A**: `app.seudominio.com` → IP da VM.

Em ambos os casos, esse hostname é o `CF_DOMAIN`.

### 4. Instalar Docker e subir
```bash
sudo apt-get update
curl -fsSL https://get.docker.com | sudo sh
sudo usermod -aG docker "$USER"    # reabra a sessão SSH depois

git clone <repo> && cd controle-financeiro

cp docker/.env.example docker/.env
# Edite docker/.env. Mínimo: CF_DOMAIN, CF_APP_URL, CF_ENCRYPTION_KEY, CF_MAIL_*
#   Chave de criptografia:  openssl rand -base64 32

./deploy.sh
```

O `deploy.sh` faz o `up -d --build` e **cria o superusuário** (se
`CF_POCKETBASE_ADMIN_EMAIL`/`PASSWORD` estiverem no `.env`).

### 5. Superusuário (manual, se preferir)
```bash
docker compose -f docker/docker-compose.prod.yml exec pocketbase \
  /pb/pocketbase superuser upsert admin@seudominio.com <senha> --dir=/pb/pb_data
```

### 6. Primeiro uso
1. Painel: `https://<seu-host>/_/` → crie o **primeiro usuário** (Collections → `users`:
   e-mail, `name`, senha, `active=true`).
2. App: `https://<seu-host>` → **Magic Link** → criar família → convidar em
   **Mais → Família e convites** → ajustar **Mais → Pessoas**.

### 7. Backup e atualizações
```bash
# Backup do banco (pb_data)
docker run --rm -v docker_pb_data:/data -v "$PWD":/backup alpine \
  tar czf /backup/pb-$(date +%F).tgz -C /data .

# Atualizar para novo código
git pull && docker compose --env-file docker/.env -f docker/docker-compose.prod.yml up -d --build
```

---

## O que informar e onde

| Onde | O que informar |
|---|---|
| Oracle Security List | liberar 22, 80, 443 |
| Firewall do SO (iptables) | liberar 80, 443 e persistir |
| DuckDNS (ou DNS do domínio) | hostname → **IP da VM** |
| `docker/.env` | `CF_DOMAIN`, `CF_APP_URL`, `CF_ENCRYPTION_KEY`, `CF_MAIL_*` |
| Painel `/_/` | criar o 1º usuário |
| App | criar família, convidar, ajustar Pessoas |

---

## Testar com DNS gratuito (DuckDNS / nip.io)

Como o PWA exige **HTTPS** e o Caddy **não emite certificado para IP**, use um hostname
gratuito apontando para o IP da VM. Você testa de verdade sem comprar domínio.

**DuckDNS** (grátis, com conta):
1. Crie `minhafamilia.duckdns.org` apontando para o **IP da VM**.
2. Use `CF_DOMAIN=minhafamilia.duckdns.org` e `CF_APP_URL=https://minhafamilia.duckdns.org`.
3. `./deploy.sh` — o Caddy emite o certificado sozinho.

**nip.io** (sem cadastro):
- O hostname é o **IP com pontos**: ex. `201.10.20.30.nip.io` resolve para esse IP.
- `CF_DOMAIN=201.10.20.30.nip.io` e `CF_APP_URL=https://201.10.20.30.nip.io`.

> Ao trocar para o domínio comprado depois, é só alterar `CF_DOMAIN`/`CF_APP_URL` e subir —
> **os dados permanecem**.

### Riscos de usar DNS gratuito

- **Você não controla o provedor.** Se o DuckDNS/nip.io ficar fora do ar ou (no DuckDNS) a
  conta expirar por inatividade, o hostname para de resolver e o app sai do ar até você
  atualizar o DNS. Não é bom para produção de longo prazo.
- **Segurança/privacidade**: `nip.io`/`sslip.io` são **wildcards públicos** — qualquer um
  consegue resolver/montar o nome do seu IP. Port scanners e bots vão encontrar o serviço.
  Use **senha forte** no admin do PocketBase, mantenha o PB atualizado e, se puder,
  restrinja o SSH (porta/IP). O app em si continua protegido por Magic Link + 2FA.
- **HTTPS/rate limit**: Let's Encrypt tem limite (ex.: ~5 certificados por domínio/semana).
  Para um host não é problema; se recriar muitos certificados em pouco tempo, pode bater o
  limite e esperar. `nip.io` é tratado como sufixo público, então não compartilha limite.
- **Busca/indexação**: o hostname pode aparecer em agregadores de DNS. Não exponha nada
  sensível extra além do app.
- **E-mail**: o `CF_MAIL_FROM` deve ser do seu provedor SMTP (não desse hostname); o hostname
  grátis é só o endereço web. Sem SPF/DKIM no domínio grátis, evite enviar e-mail "desse"
  domínio.
- **É temporário**: trate como ambiente de teste. Para valer, compre um domínio e siga a
  seção de troca abaixo (2 variáveis + DNS).

**Mitigações rápidas:** senha admin forte, SSH por chave (sem senha), `unattended-upgrades`
no Ubuntu, e backup do `pb_data`.

---

## Trocar IP → domínio (quando comprar)

1. Compre o domínio e crie o **registro A** `app.seudominio.com` → IP da VM.
2. Edite `docker/.env`: `CF_DOMAIN=app.seudominio.com` e `CF_APP_URL=https://app.seudominio.com`.
3. Aplique:
   ```bash
   CF_DOMAIN=app.seudominio.com docker compose \
     --env-file docker/.env -f docker/docker-compose.prod.yml up -d
   ```
   O Caddy pega o novo certificado automaticamente. **Os dados não mudam** (ficam no volume `pb_data`).

---

## Observações importantes

- **IP puro**: sem HTTPS o **PWA/service worker/notificações não funcionam** (contexto seguro).
  Use um hostname (DuckDNS/nip.io) mesmo para testar.
- **`CF_ENCRYPTION_KEY`**: guarde e **não troque** depois de ativar 2FA.
- **Notifier (push)**: opcional; sem `CF_VAPID_*` o app funciona normalmente.
- **HTTPS é obrigatório** para o app rodar como PWA.
- **Não precisa de Vercel** — o front vai no mesmo servidor (imagem `web`), servido pelo Caddy.
