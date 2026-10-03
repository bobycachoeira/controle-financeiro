# Deploy no Oracle Cloud Always Free (tudo em um servidor)

Backend **e** frontend rodando na **mesma VM Oracle** (Always Free), em **um domínio só**,
via Docker. Para 3 usuários é folgado. **Sem Vercel, sem Fly.**

> **Continua 100% PocketBase.** Nenhuma migração. A única mudança de código era a imagem do
> PocketBase ser multi-arquitetura (o Ampere do Oracle é ARM64) — já ajustado em
> `docker/Dockerfile.pocketbase`.

## Arquitetura

```
Navegador ──HTTPS──> app.seudominio.com  (Caddy na VM Oracle)
                       ├── /api/*   -> PocketBase:8090
                       └── /*       -> web:80 (PWA estático, nginx)
                     [VM Ampere A1 · Docker · volumes pb_data/caddy_data]
```

- **Caddy**: termina o TLS (Let's Encrypt automático) e roteia `/api` x front.
- **web**: imagem nginx com o `dist` do PWA (mesma origem → `VITE_API_URL=/api`).
- **PocketBase**: API + SQLite (volume `pb_data`).
- **notifier** (opcional): push.

## O que muda no projeto

| Item | Situação |
|---|---|
| Aplicação (web, PB, hooks, regras) | **Sem mudança** |
| `docker/Dockerfile.pocketbase` | Multi-arch (arm64/armv7/amd64) — **feito** |
| `apps/web/Dockerfile` + `apps/web/nginx.conf` | **Novos** (build do PWA + serve) |
| `docker/Caddyfile` | Um domínio: `/api` → PocketBase, resto → web |
| `docker/docker-compose.prod.yml` | Serviços `caddy + web + pocketbase + notifier` |

## Passo a passo

### 1. VM
Oracle Cloud → Compute → **Create Instance**:
- Imagem **Ubuntu 22.04/24.04**
- Shape **VM.Standard.A1.Flex** (Ampere/ARM), 1 OCPU / 6 GB (até 4/24)
- **Assign public IPv4**
- Chave SSH

### 2. Abrir portas (duas camadas)
- **Security List / NSG** da VCN → Ingress: TCP **22**, **80**, **443** de `0.0.0.0/0`.
- **Firewall do SO** (imagens Oracle bloqueiam por padrão):
  ```bash
  sudo iptables -I INPUT 6 -m state --state NEW -p tcp --dport 80 -j ACCEPT
  sudo iptables -I INPUT 6 -m state --state NEW -p tcp --dport 443 -j ACCEPT
  sudo netfilter-persistent save
  ```

### 3. DNS
- **A**: `app.seudominio.com` → **IP público da VM**. (O Caddy precisa do domínio
  resolvendo para emitir o certificado.)

### 4. Docker + subir tudo
```bash
sudo apt-get update && curl -fsSL https://get.docker.com | sudo sh
sudo usermod -aG docker "$USER"   # reabra a sessão

git clone <repo> && cd controle-financeiro

cat > docker/.env <<'EOF'
CF_DOMAIN=app.seudominio.com
CF_APP_URL=https://app.seudominio.com
CF_ENCRYPTION_KEY=COLE_AQUI_openssl_rand_-base64_32
CF_STEPUP_TTL=10m
CF_TIMEZONE=America/Sao_Paulo
CF_MAIL_HOST=smtp.seudominio.com
CF_MAIL_PORT=587
CF_MAIL_USER=no-reply@seudominio.com
CF_MAIL_PASSWORD=senha
CF_MAIL_FROM=no-reply@seudominio.com
# opcional (push):
# CF_VAPID_PUBLIC_KEY= / CF_VAPID_PRIVATE_KEY= / CF_VAPID_SUBJECT=
# CF_POCKETBASE_ADMIN_EMAIL= / CF_POCKETBASE_ADMIN_PASSWORD=
EOF

CF_DOMAIN=app.seudominio.com docker compose \
  --env-file docker/.env -f docker/docker-compose.prod.yml up -d --build
```
Isso builda o PWA, o PocketBase e sobe o Caddy com TLS. As **migrações rodam sozinhas**.

### 5. Superusuário (uma vez)
```bash
docker compose -f docker/docker-compose.prod.yml exec pocketbase \
  /pb/pocketbase superuser upsert admin@seudominio.com <senha> --dir=/pb/pb_data
```

### 6. Primeiro uso
- Painel: `https://app.seudominio.com/_/` (o Caddy roteia `/_/` para o PocketBase).
  O painel usa caminhos fora de `/api`; se necessário, acesse por `/_/` mesmo domínio.
- App: `https://app.seudominio.com` → Magic Link → criar família → convidar
  (**Mais → Família e convites**) → ajustar **Mais → Pessoas**.

## Manutenção

- **Backup**:
  ```bash
  docker run --rm -v docker_pb_data:/data -v "$PWD":/backup alpine \
    tar czf /backup/pb-$(date +%F).tgz -C /data .
  ```
- **Atualizar**: `git pull && docker compose --env-file docker/.env -f docker/docker-compose.prod.yml up -d --build`.
- **Não troque** `CF_ENCRYPTION_KEY` após ativar 2FA.
- **notifier**: opcional; sem `CF_VAPID_*` o app funciona, só não envia push.

## Checklist

- [ ] VM Ampere A1 + IP público
- [ ] Security List: 22/80/443
- [ ] Firewall do SO: 80/443 persistidos
- [ ] DNS `app.seudominio.com` → IP
- [ ] Docker instalado
- [ ] `docker/.env` preenchido (CF_DOMAIN, CF_APP_URL, CF_ENCRYPTION_KEY, CF_MAIL_*)
- [ ] `docker compose -f docker/docker-compose.prod.yml up -d --build`
- [ ] Superusuário criado
- [ ] Primeiro usuário + família + convites
- [ ] Backup agendado

## Painel do PocketBase

O Caddy já roteia `/_/*` (painel admin) e `/api/*` para o PocketBase; o restante vai para o
front. Então o painel fica em `https://app.seudominio.com/_/`.

### Variante com subdomínio de API (opcional)

Se quiser separar, use dois blocos no Caddy:

```caddy
app.seudominio.com {           # front
    encode gzip
    reverse_proxy web:80
}
api.seudominio.com {           # backend (painel + /api)
    encode gzip
    reverse_proxy pocketbase:8090
}
```

E no build do front use `VITE_API_URL=https://api.seudominio.com/api`.
