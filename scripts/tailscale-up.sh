#!/usr/bin/env bash
# Migra a publicação do app de "Cloudflare quick tunnel" para "Tailscale Funnel":
# URL HTTPS fixa (https://<host>.<tailnet>.ts.net:8443), sem cloudflared e sem
# abrir portas no roteador. O app continua sendo servido pelo Caddy local na :8081.
#
# Usa a porta pública 8443 do Funnel (443/8443/10000 são as permitidas) para não
# conflitar com o "minha-leitura", que já usa 443 no mesmo nó.
#
# Uso (uma vez, no host):
#   ./scripts/tailscale-up.sh
#
# Ele pede sua senha do sudo para instalar/autenticar o Tailscale. Depois disso
# o restante (docker) roda sem sudo. Reexecute o script se precisar.
set -euo pipefail

ROOT_DIR=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
COMPOSE="$ROOT_DIR/docker/docker-compose.tunnel.yml"
ENV_FILE="$ROOT_DIR/docker/.env.tunnel"
APP_PORT="${TAILSCALE_APP_PORT:-8081}"
FUNNEL_PORT="${TAILSCALE_FUNNEL_PORT:-8443}"

if [ ! -f "$COMPOSE" ]; then
  echo "Não encontrei $COMPOSE" >&2
  exit 1
fi

# 1) Instala o Tailscale se necessário (usa sudo).
if ! command -v tailscale >/dev/null 2>&1; then
  echo "==> Instalando o Tailscale (vai pedir sua senha do sudo)..."
  curl -fsSL https://tailscale.com/install.sh | sh
fi

# 2) Autentica no tailnet (a 1ª vez imprime um link para abrir no navegador).
echo "==> Autenticando no Tailscale (siga o link, se aparecer)..."
sudo tailscale up

# 3) Sobe o app SEM o cloudflared (caddy + web + pocketbase).
echo "==> Subindo o app (caddy, web, pocketbase)..."
if [ -f "$ENV_FILE" ]; then
  set -a
  # shellcheck disable=SC1090
  . "$ENV_FILE"
  set +a
fi
export CF_ENCRYPTION_KEY="${CF_ENCRYPTION_KEY:-dev-insecure-encryption-key-change-me}"
docker compose -f "$COMPOSE" up -d --build caddy web pocketbase

# 4) Liga o Funnel público (porta 8443) apontando para a porta do Caddy.
echo "==> Habilitando o Funnel público na porta $FUNNEL_PORT -> localhost:$APP_PORT..."
if ! sudo tailscale funnel --bg --https="$FUNNEL_PORT" "http://localhost:$APP_PORT"; then
  echo ""
  echo "!! O Funnel ainda não está habilitado no seu tailnet." >&2
  echo "   Abra o link que apareceu acima, ative o Funnel e rode este script de novo." >&2
  exit 1
fi

# 5) Descobre a URL pública fixa.
TS_NAME=$(tailscale status --json | python3 -c "import sys,json;print(json.load(sys.stdin)['Self']['DNSName'].rstrip('.'))")
URL="https://$TS_NAME:$FUNNEL_PORT"

# 6) Grava a URL fixa em docker/.env.tunnel.
touch "$ENV_FILE"
if grep -q '^CF_APP_URL=' "$ENV_FILE"; then
  sed -i "s|^CF_APP_URL=.*|CF_APP_URL=$URL|" "$ENV_FILE"
else
  printf 'CF_APP_URL=%s\n' "$URL" >> "$ENV_FILE"
fi
if grep -q '^CF_CORS_ORIGINS=' "$ENV_FILE"; then
  sed -i "s|^CF_CORS_ORIGINS=.*|CF_CORS_ORIGINS=$URL|" "$ENV_FILE"
else
  printf 'CF_CORS_ORIGINS=%s\n' "$URL" >> "$ENV_FILE"
fi

# 7) Reinicia o app com a URL nova e encerra o cloudflared.
echo "==> Aplicando a URL fixa e desligando o cloudflared..."
export CF_APP_URL="$URL"
export CF_CORS_ORIGINS="$URL"
docker compose -f "$COMPOSE" up -d pocketbase web
docker compose -f "$COMPOSE" stop cloudflared >/dev/null 2>&1 || true
docker compose -f "$COMPOSE" rm -f cloudflared >/dev/null 2>&1 || true

cat <<EOF

============================================================
  App publicado em:  $URL
  Painel PocketBase: $URL/_/
============================================================

O endereço agora é fixo (não muda ao reiniciar).

Magic Link (sem SMTP) no log:
  docker compose -f $COMPOSE logs -f pocketbase | grep MAGIC_LINK

Notifier (Web Push):
  docker compose --profile notifier -f $COMPOSE up -d

Parar tudo:
  docker compose -f $COMPOSE down

Observação: como a origem (URL) mudou, readicione o PWA no celular/PC na
nova URL. Os dados do servidor continuam os mesmos.
EOF
