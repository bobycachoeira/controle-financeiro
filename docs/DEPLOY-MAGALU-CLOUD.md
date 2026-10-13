# Deploy na Magalu Cloud (tudo em um servidor)

Guia específico para hospedar o app na **Magalu Cloud** (100% brasileira): backend **e**
frontend na **mesma VM**, em **um domínio só**, via Docker — igual ao plano do
`docs/DEPLOY-ORACLE-ALWAYS-FREE.md`, só mudando o provedor.

Por que Magalu Cloud para este caso:
- Cobrança em **R$ (BRL)**, com impostos inclusos — sem variação de câmbio/IOF.
- Paga com **Pix** e trabalha com **crédito** (dá pra pré-carregar).
- **Tráfego de saída (egress) sem custo** e **instância desligada não é cobrada**.
- **R$ 100 de crédito** iniciais ao cadastrar o faturamento.
- Infra no Brasil (`br-se1` Sudeste / `br-ne1` Nordeste).

## Custo estimado (região SE1, vigente em 02/10/2026)

| Tipo | vCPU | RAM | Disco | Preço de referência (730 h/mês) |
|---|---|---|---|---|
| BV1-1-20 | 1 | 1 GB | 20 GB | ~R$ 44,99 |
| BV1-2-20 | 1 | 2 GB | 20 GB | ~R$ 54,99 |
| **BV1-2-40** *(recomendado)* | 1 | 2 GB | 40 GB | ~R$ 69,99 |
| BV2-2-40 | 2 | 2 GB | 40 GB | ~R$ 79,99 |
| BV2-4-40 | 2 | 4 GB | 40 GB | ~R$ 102,99 |

- Cobrança **por segundo**; **parar** a VM não gera custo (o disco local persiste). Você
  pode deixá-la desligada quando não estiver usando.
- **IPv4 público** e **Block Storage** são cobrados **à parte** (confirme o valor do IPv4
  na calculadora). **Egress é gratuito**.
- Para 3 usuários, **BV1-2-40** (~R$ 70) já resolve; se quiser economizar, **BV1-2-20**.

## Arquitetura

```
Navegador ──HTTPS──> app.seudominio.com  (Caddy na VM)
                       ├── /api/*, /_/*  -> PocketBase:8090
                       └── /*            -> web:80 (PWA estático, nginx)
                     [VM Magalu Cloud · Docker · volumes pb_data/caddy_data]
```

- **Caddy**: TLS automático (Let's Encrypt) e roteia `/api` e `/_/*` vs front.
- **web**: imagem nginx com o `dist` do PWA (`VITE_API_URL=/api`).
- **PocketBase**: API + SQLite (volume `pb_data`).
- **notifier** (opcional): push.

## Passo a passo

### 1. Conta e faturamento
1. Crie a conta em `https://console.magalu.cloud`.
2. Em **Faturamento**, cadastre os dados para **liberar o acesso completo** e receber os
   **R$ 100 de crédito**. (Aqui você paga com **Pix**/crédito.)

### 2. Chave SSH
No console: **Menu → Computação → Chaves SSH → Adicionar**. Cole a sua chave pública:
```bash
# se ainda não tiver uma:
ssh-keygen -t ed25519 -C "voce@exemplo.com"
cat ~/.ssh/id_ed25519.pub   # cole o conteúdo no console
```

### 3. Criar a VM (console)
Em **Computação → Máquinas Virtuais → Criar instância**:
- **Região:** `br-se1` (Sudeste) — mais perto da família.
- **Imagem:** **Ubuntu 24.04 LTS**.
- **Tipo:** **BV1-2-40** (1 vCPU, 2 GB, 40 GB) — ou BV1-2-20 para economizar.
- **IPv4 público:** **ativar**.
- **Chave SSH:** a do passo 2.
- **Nome:** `controle-financeiro` (só minúsculas, hífen, `_` e números).

> Alternativa por CLI (opcional):
> ```bash
> sudo snap install mgccli          # ou via APT/.deb (veja docs)
> mgc auth login                    # autentica na conta
> mgc virtual-machine machine-types list        # confira o nome do tipo
> mgc virtual-machine images list               # pegue o nome/id da imagem Ubuntu 24.04
>
> mgc virtual-machine instances create \
>   --image.name="cloud-ubuntu-24.04 LTS" \
>   --machine-type.name="BV1-2-40" \
>   --name="controle-financeiro" \
>   --ssh-key-name="SUA-CHAVE" \
>   --network.associate-public-ip=true
> ```
> Anote o **IPv4 público** em **Máquinas Virtuais → (a VM) → Detalhes**.

### 4. Grupo de Segurança (liberar 22/80/443)
Toda VM nasce com um **grupo de segurança padrão**. Você precisa liberar entrada nas
portas **22, 80 e 443**.

Ponto de atenção: um grupo **personalizado** sem regra de **saída (egress) para
`0.0.0.0/0` impede o boot da VM**. Se for criar o seu, inclua a regra de egress.

Console: **Menu → Network → Grupos de Segurança**:
1. **+ Criar grupo de segurança** (ex.: `web-cf`).
2. Menu **⋮ → Editar grupo de segurança → + Adicionar Regra**:
   - Ingress TCP **22** de `0.0.0.0/0`
   - Ingress TCP **80** de `0.0.0.0/0`
   - Ingress TCP **443** de `0.0.0.0/0`
   - **Egress** (todos os protocolos) para `0.0.0.0/0`
3. Associe o grupo à VM (na criação ou em **Gerenciamento de Grupos de Segurança**).

> Alternativa por CLI:
> ```bash
> SG=$(mgc network security-groups create --name="web-cf" -o json | jq -r '.id')
> for P in 22 80 443; do
>   mgc network security-groups rules create --security-group-id="$SG" \
>     --direction=ingress --ethertype=IPv4 --protocol=tcp \
>     --port-range-min=$P --port-range-max=$P --remote-ip-prefix=0.0.0.0/0
> done
> mgc network security-groups rules create --security-group-id="$SG" \
>   --direction=egress --ethertype=IPv4 --remote-ip-prefix=0.0.0.0/0
> ```
> Se criar a VM por CLI, associe o grupo na criação:
> `--network.interface.security-groups="[{\"id\":\"$SG\"}]"`.

### 5. DNS
O Caddy precisa de um **hostname** apontando para o **IPv4 público** da VM (não emite
certificado para IP). Use seu domínio ou um host gratuito (DuckDNS / `nip.io`) — o passo a
passo está em [`DEPLOY.md`](../DEPLOY.md) (seção "Testar com DNS gratuito").
Ex.:
- DuckDNS: `minhafamilia.duckdns.org` → IP da VM.
- Sem cadastro: `SEU_IP.nip.io` (ex.: `203.0.113.10.nip.io`).

### 6. Docker + subir tudo
Conecte na VM e rode (mesmos comandos do deploy Oracle):
```bash
ssh ubuntu@SEU_IP           # usuário Ubuntu costuma ser "ubuntu"; confirme no console

sudo apt-get update && curl -fsSL https://get.docker.com | sudo sh
sudo usermod -aG docker "$USER"   # reabra a sessão (exit e ssh de novo)

git clone <repo> && cd controle-financeiro

cat > docker/.env <<'EOF'
CF_DOMAIN=minhafamilia.duckdns.org
CF_APP_URL=https://minhafamilia.duckdns.org
CF_ENCRYPTION_KEY=COLE_AQUI_openssl_rand_-base64_32
CF_STEPUP_TTL=10m
CF_TIMEZONE=America/Sao_Paulo
CF_SINGLE_HOUSEHOLD=true
CF_ADMIN_EMAIL=voce@exemplo.com
CF_ADMIN_NAME=Titular
CF_MAIL_HOST=smtp.seudominio.com
CF_MAIL_PORT=587
CF_MAIL_USER=no-reply@seudominio.com
CF_MAIL_PASSWORD=senha
CF_MAIL_FROM=no-reply@seudominio.com
# opcional (push):
# CF_VAPID_PUBLIC_KEY= / CF_VAPID_PRIVATE_KEY= / CF_VAPID_SUBJECT=
EOF

# gere a chave de criptografia, se ainda não tiver:
openssl rand -base64 32

CF_DOMAIN=minhafamilia.duckdns.org docker compose \
  --env-file docker/.env -f docker/docker-compose.prod.yml up -d --build
```
As **migrações rodam sozinhas** e o Caddy emite o TLS.

### 7. Primeiro uso
1. App: `https://SEU_DOMINIO` → informe o e-mail de `CF_ADMIN_EMAIL` e peça o **Magic Link**
   → a conta é criada no primeiro pedido.
2. **Criar família** (você vira **Owner**) → convidar em **Mais → Família e convites**.
3. Como `CF_SINGLE_HOUSEHOLD=true`, novas famílias ficam bloqueadas (mude para `false`
   quando quiser liberar várias).

## Manutenção e economia

- **Parar a VM quando não usar**: desligada **não é cobrada** (o disco local persiste).
  No console: **Máquinas Virtuais → ⋮ → Parar**; ou `mgc virtual-machine instances stop --id=...`.
  Suba de novo com **Iniciar**. (Só **deletar** a VM perde o disco.)
- **Backup** do banco (volume `pb_data`):
  ```bash
  docker run --rm -v docker_pb_data:/data -v "$PWD":/backup alpine \
    tar czf /backup/pb-$(date +%F).tgz -C /data .
  ```
- **Atualizar**: `git pull && docker compose --env-file docker/.env -f docker/docker-compose.prod.yml up -d --build`.
- **Não troque** `CF_ENCRYPTION_KEY` após ativar 2FA.

## Pegadinhas da Magalu Cloud

- **Egress grátis** — não precisa se preocupar com tráfego de saída.
- **Parar não cobra** — ótimo para uso esporádico.
- **Grupo de Segurança exige egress `0.0.0.0/0`** se você criar um personalizado.
- **IPv4 público é cobrado à parte** (por hora) — confirme na calculadora.
- Regiões: `br-se1` (Sudeste) e `br-ne1` (Nordeste); o SKU importa na precificação.

## Checklist

- [ ] Conta + faturamento (R$ 100 de crédito)
- [ ] Chave SSH cadastrada
- [ ] VM Ubuntu 24.04 (BV1-2-40) com IPv4 público
- [ ] Grupo de Segurança: ingress 22/80/443 + egress `0.0.0.0/0`
- [ ] DNS `SEU_DOMINIO` → IPv4 da VM
- [ ] Docker instalado
- [ ] `docker/.env` preenchido (inclui `CF_ADMIN_EMAIL`)
- [ ] `docker compose ... up -d --build`
- [ ] Magic Link → criar família
- [ ] Backup agendado
