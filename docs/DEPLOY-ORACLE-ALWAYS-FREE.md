# Deploy no Oracle Cloud Always Free (Plano B)

Alternativa de hospedagem **gratuita e permanente** para o backend, rodando tudo em
Docker. Para 3 usuários é mais que suficiente.

> **Continua sendo PocketBase.** Não há migração nem mudança de funcionalidades. A única
> alteração de código necessária (já feita) é a imagem do PocketBase ser **multi-arquitetura**,
> porque o Ampere do Oracle é **ARM64 (aarch64)** — `docker/Dockerfile.pocketbase` agora
> baixa o binário `linux_arm64` automaticamente (e continua funcionando em amd64).

## Arquitetura

```
Navegador ──HTTPS──> Vercel (PWA, apps/web)
                 └──HTTPS──> api.seudominio.com (Caddy) ──> PocketBase (8090) + notifier
                            [Oracle Cloud VM Ampere A1 · Docker · volume pb_data]
```

- Front: **Vercel** (estático).
- Backend: **Oracle Cloud Always Free** (VM ARM), Docker Compose com Caddy (TLS automático),
  PocketBase e (opcional) notifier.

## Por que o Oracle Always Free encaixa

- **Ampere A1 (ARM):** até 4 OCPU / 24 GB RAM sempre grátis — muito acima do necessário.
- **Disco em bloco grátis:** até ~200 GB (para o `pb_data`) + boot volume.
- **Sempre grátis**, sem pausar por inatividade (diferente do Supabase free).

## O que muda no projeto

| Item | Mudança |
|---|---|
| `docker/Dockerfile.pocketbase` | Agora multi-arquitetura (ARM64/amd64) — **já ajustado** |
| `docker/docker-compose.prod.yml` + `Caddyfile` | Reutilizados como estão |
| Aplicação (web/PB/hooks/regras) | **Nenhuma mudança** |
| `apps/notifier/Dockerfile` | `node:20-alpine` é multi-arch — ok como está |

## Passo a passo manual

### 1. Conta e máquina
1. Crie uma conta no **Oracle Cloud** (Always Free).
2. Compute → **Create Instance**:
   - **Image**: Ubuntu 22.04 (ou 24.04).
   - **Shape**: `VM.Standard.A1.Flex` (Ampere/ARM), **1 OCPU / 6 GB** (pode até 4/24).
   - **Networking**: crie/selecione a VCN; marque **Assign a public IPv4**.
   - **SSH keys**: baixe/adicione sua chave pública.
   - Boot volume: padrão (ou maior). Crie um **Block Volume** se quiser separar o `pb_data`.

### 2. Liberar as portas (Oracle usa DUAS camadas)
- **Security List / NSG** da VCN → Ingress Rules:
  - TCP **22** (SSH), TCP **80** e TCP **443** de `0.0.0.0/0`.
- **Firewall do sistema operacional** (imagens Oracle bloqueiam por padrão):
  ```bash
  sudo iptables -I INPUT 6 -m state --state NEW -p tcp --dport 80 -j ACCEPT
  sudo iptables -I INPUT 6 -m state --state NEW -p tcp --dport 443 -j ACCEPT
  sudo netfilter-persistent save    # ou: sudo service iptables save
  ```
  (Ubuntu 24.04 pode usar `netfilter-persistent`/`ufw`; garanta o persistente.)

### 3. DNS
- Crie um registro **A**: `api.seudominio.com` → **IP público da VM**.
  (O Caddy precisa do domínio resolvendo para emitir o certificado TLS.)

### 4. Instalar Docker e subir
```bash
sudo apt-get update
curl -fsSL https://get.docker.com | sudo sh
sudo usermod -aG docker "$USER"   # reabra a sessão depois

git clone <repo> && cd controle-financeiro

# Variáveis (o compose prod exige CF_ENCRYPTION_KEY e CF_APP_URL)
cat > docker/.env <<'EOF'
CF_API_DOMAIN=api.seudominio.com
CF_APP_URL=https://app.seudominio.com
CF_ENCRYPTION_KEY=COLE_AQUI_openssl_rand_-base64_32
CF_STEPUP_TTL=10m
CF_TIMEZONE=America/Sao_Paulo
CF_MAIL_HOST=smtp.seudominio.com
CF_MAIL_PORT=587
CF_MAIL_USER=no-reply@seudominio.com
CF_MAIL_PASSWORD=senha
CF_MAIL_FROM=no-reply@seudominio.com
# opcional (push): CF_VAPID_PUBLIC_KEY / CF_VAPID_PRIVATE_KEY / CF_VAPID_SUBJECT
# opcional (notifier): CF_POCKETBASE_ADMIN_EMAIL / CF_POCKETBASE_ADMIN_PASSWORD
EOF

CF_API_DOMAIN=api.seudominio.com docker compose \
  --env-file docker/.env -f docker/docker-compose.prod.yml up -d --build
```
As **migrações rodam sozinhas** no boot; o banco fica no volume `pb_data`.

### 5. Superusuário (uma vez)
```bash
docker compose -f docker/docker-compose.prod.yml exec pocketbase \
  /pb/pocketbase superuser upsert admin@seudominio.com <senha> --dir=/pb/pb_data
```

### 6. Front na Vercel
- Importe o repo → **Root Directory**: `apps/web` → preset **Vite**.
- Env: **`VITE_API_URL = https://api.seudominio.com/api`**.
- Deploy. (`apps/web/vercel.json` cuida das rotas SPA.)

### 7. Primeiro uso
No painel `https://api.seudominio.com/_/` crie o **primeiro usuário** (`users`,
`active=true`) → no app, Magic Link → criar família → convidar em **Mais → Família e
convites** → ajustar **Mais → Pessoas**.

## Manutenção

- **Backup** do `pb_data`:
  ```bash
  docker run --rm -v docker_pb_data:/data -v "$PWD":/backup alpine \
    tar czf /backup/pb-$(date +%F).tgz -C /data .
  ```
- **Atualizar** (novo código): `git pull && docker compose --env-file docker/.env -f docker/docker-compose.prod.yml up -d --build`.
- **Notifier (push)**: opcional; já sobe junto no compose se as variáveis `CF_VAPID_*` e de
  admin estiverem definidas. Sem ele, o app funciona normalmente.
- **Não troque** `CF_ENCRYPTION_KEY` depois de ativar 2FA.

## Checklist rápido

- [ ] VM Ampere A1 criada + IP público
- [ ] Security List: 22/80/443 abertos
- [ ] Firewall do SO: 80/443 liberados e persistidos
- [ ] DNS `api.seudominio.com` → IP
- [ ] Docker instalado
- [ ] `docker/.env` preenchido (CF_ENCRYPTION_KEY, CF_APP_URL, CF_MAIL_*)
- [ ] `docker compose -f docker/docker-compose.prod.yml up -d --build`
- [ ] Superusuário criado
- [ ] Vercel com `VITE_API_URL` = `https://api.seudominio.com/api`
- [ ] Primeiro usuário + família + convites
- [ ] Backup agendado
