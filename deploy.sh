#!/usr/bin/env sh
# Sobe tudo (Oracle/VPS) com Docker Compose e cria o superusuário do PocketBase.
#
# Uso:
#   cp docker/.env.example docker/.env   # e preencha
#   ./deploy.sh
#
# Reexecutar após `git pull` atualiza os containers (--build).
set -eu

ROOT_DIR=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
ENV_FILE="$ROOT_DIR/docker/.env"
COMPOSE_FILE="$ROOT_DIR/docker/docker-compose.prod.yml"

if [ ! -f "$ENV_FILE" ]; then
  echo "Crie $ENV_FILE a partir de docker/.env.example e preencha." >&2
  exit 1
fi

# Carrega as variáveis do .env
set -a
# shellcheck disable=SC1090
. "$ENV_FILE"
set +a

: "${CF_DOMAIN:?defina CF_DOMAIN em docker/.env}"
: "${CF_ENCRYPTION_KEY:?defina CF_ENCRYPTION_KEY em docker/.env}"
: "${CF_APP_URL:?defina CF_APP_URL em docker/.env}"

echo "==> Subindo containers (CF_DOMAIN=$CF_DOMAIN)..."
CF_DOMAIN="$CF_DOMAIN" docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" up -d --build

echo "==> Aguardando o PocketBase responder..."
attempt=0
until docker compose -f "$COMPOSE_FILE" exec -T pocketbase \
      wget -qO- http://127.0.0.1:8090/api/health >/dev/null 2>&1; do
  attempt=$((attempt + 1))
  if [ "$attempt" -ge 30 ]; then
    echo "Aviso: PocketBase não respondeu a tempo; siga mesmo assim e verifique os logs." >&2
    break
  fi
  sleep 2
done

EMAIL="${CF_POCKETBASE_ADMIN_EMAIL:-${SUPERUSER_EMAIL:-}}"
PASS="${CF_POCKETBASE_ADMIN_PASSWORD:-${SUPERUSER_PASSWORD:-}}"
if [ -n "$EMAIL" ] && [ -n "$PASS" ]; then
  echo "==> Criando/atualizando superusuário $EMAIL..."
  docker compose -f "$COMPOSE_FILE" exec -T pocketbase \
    /pb/pocketbase superuser upsert "$EMAIL" "$PASS" --dir=/pb/pb_data
else
  echo "==> Superusuário não criado (defina CF_POCKETBASE_ADMIN_EMAIL/PASSWORD)."
fi

echo ""
echo "Pronto! App:    https://$CF_DOMAIN"
echo "Painel admin:   https://$CF_DOMAIN/_/"
echo "Crie o primeiro usuário em Collections -> users (com active=true)."
