#!/usr/bin/env bash
# Sobe o app inteiro na sua máquina e publica numa URL HTTPS grátis via
# Cloudflare Tunnel (quick tunnel). Serve para testar PWA, Magic Link e sync
# do celular, sem abrir portas no roteador e sem instalar cloudflared no host.
#
# Uso:
#   ./scripts/tunnel-up.sh
#
# Opcional: crie docker/.env.tunnel (não versionado) para configurar, por ex.:
#   CF_ADMIN_EMAIL=voce@exemplo.com      # 1º Magic Link com esse e-mail vira conta ativa
#   CF_ENCRYPTION_KEY=<openssl rand -base64 32>
#   CF_POCKETBASE_ADMIN_EMAIL=...        # ativa o notifier
#   CF_POCKETBASE_ADMIN_PASSWORD=...
#   CF_MAIL_HOST=... CF_MAIL_USER=... CF_MAIL_PASSWORD=...   # SMTP real (opcional)
#
# Parar tudo:  docker compose -f docker/docker-compose.tunnel.yml down
set -euo pipefail

ROOT_DIR=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
COMPOSE="$ROOT_DIR/docker/docker-compose.tunnel.yml"
ENV_FILE="$ROOT_DIR/docker/.env.tunnel"

if [ ! -f "$COMPOSE" ]; then
  echo "Não encontrei $COMPOSE" >&2
  exit 1
fi

if [ -f "$ENV_FILE" ]; then
  set -a
  # shellcheck disable=SC1090
  . "$ENV_FILE"
  set +a
fi

export CF_ENCRYPTION_KEY="${CF_ENCRYPTION_KEY:-dev-insecure-encryption-key-change-me}"

echo "==> Compilando imagens e subindo Caddy, web, PocketBase e cloudflared..."
docker compose -f "$COMPOSE" up -d --build caddy cloudflared web pocketbase

echo "==> Aguardando a URL pública do túnel..."
URL=""
for _ in $(seq 1 90); do
  URL=$(docker compose -f "$COMPOSE" logs cloudflared 2>/dev/null \
    | grep -oE 'https://[a-z0-9-]+\.trycloudflare\.com' | tail -n1 || true)
  [ -n "$URL" ] && break
  sleep 1
done

if [ -z "$URL" ]; then
  echo "Não consegui obter a URL do túnel. Veja os logs:" >&2
  echo "  docker compose -f $COMPOSE logs cloudflared" >&2
  exit 1
fi

export CF_APP_URL="$URL"
export CF_CORS_ORIGINS="$URL"

echo "==> Subindo PocketBase com CF_APP_URL=$URL"
docker compose -f "$COMPOSE" up -d pocketbase

if [ -n "${CF_POCKETBASE_ADMIN_EMAIL:-}" ] && [ -n "${CF_POCKETBASE_ADMIN_PASSWORD:-}" ]; then
  echo "==> Subindo notifier (web push)..."
  docker compose --profile notifier -f "$COMPOSE" up -d notifier
else
  echo "==> Notifier não iniciado (defina CF_POCKETBASE_ADMIN_EMAIL/PASSWORD em docker/.env.tunnel para ativar)."
fi

cat <<EOF

============================================================
  App publicado em:  $URL
  Painel PocketBase: $URL/_/
============================================================

Sem SMTP configurado, o Magic Link aparece no log:
  docker compose -f $COMPOSE logs -f pocketbase | grep MAGIC_LINK

Primeiro acesso: defina CF_ADMIN_EMAIL em docker/.env.tunnel — o 1º Magic Link
com esse e-mail cria a conta automaticamente como ativa.

Parar tudo:
  docker compose -f $COMPOSE down
EOF
