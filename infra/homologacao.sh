#!/usr/bin/env bash
# =====================================================================
# Sobe o ambiente de HOMOLOGAÇÃO em um comando:
#   - gera infra/.env (segredos fortes) se ainda não existir
#   - sobe banco + aplicação + proxy (HTTPS automático via Caddy)
#   - carrega os dados de demonstração uma única vez
#
# Uso:
#   bash infra/homologacao.sh                       # usa o domínio padrão
#   bash infra/homologacao.sh meu.dominio.duckdns.org
#
# É a MESMA aplicação da produção — a homologação difere só pelos dados
# fictícios. Para produção real, use o docker compose sem carregar seeds.
# =====================================================================
set -euo pipefail
cd "$(dirname "$0")"   # entra em infra/

DOMINIO_HOMOLOG="${1:-orlando-expert.duckdns.org}"
PAINEL_SENHA_PADRAO="Diretoria2026"

if [ ! -f .env ]; then
  echo "→ Gerando infra/.env para ${DOMINIO_HOMOLOG} ..."
  cp .env.example .env
  SESSAO_SECRET=$(openssl rand -hex 32)
  POSTGRES_PASSWORD=$(openssl rand -hex 16)
  FILA_SEGREDO=$(openssl rand -hex 16)
  sed -i "s|^DOMINIO=.*|DOMINIO=${DOMINIO_HOMOLOG}|" .env
  sed -i "s|^APP_URL=.*|APP_URL=https://${DOMINIO_HOMOLOG}|" .env
  sed -i "s|^POSTGRES_PASSWORD=.*|POSTGRES_PASSWORD=${POSTGRES_PASSWORD}|" .env
  sed -i "s|^SESSAO_SECRET=.*|SESSAO_SECRET=${SESSAO_SECRET}|" .env
  sed -i "s|^PAINEL_SENHA=.*|PAINEL_SENHA=${PAINEL_SENHA_PADRAO}|" .env
  sed -i "s|^FILA_SEGREDO=.*|FILA_SEGREDO=${FILA_SEGREDO}|" .env
else
  echo "→ infra/.env já existe — mantendo as configurações atuais."
fi

DB=$(grep '^POSTGRES_DB='   .env | cut -d= -f2)
USR=$(grep '^POSTGRES_USER=' .env | cut -d= -f2)
SENHA_PAINEL=$(grep '^PAINEL_SENHA=' .env | cut -d= -f2)

echo "→ Construindo e subindo os contêineres (pode levar alguns minutos)..."
docker compose up -d --build

echo "→ Aguardando o banco ficar pronto..."
until docker compose exec -T db pg_isready -U "$USR" -d "$DB" >/dev/null 2>&1; do
  sleep 2
done

JA=$(docker compose exec -T db psql -U "$USR" -d "$DB" -tAc \
  "select count(*) from solicitacoes where codigo_agente_informado='SEED-DEMO';" 2>/dev/null | tr -d '[:space:]' || echo 0)

if [ "${JA:-0}" = "0" ]; then
  echo "→ Carregando dados de demonstração..."
  docker compose exec -T db psql -U "$USR" -d "$DB" < sql/seed_demo_bi.sql
  docker compose exec -T db psql -U "$USR" -d "$DB" < sql/seed_demo_portal.sql
  echo "  Dados de demonstração carregados."
else
  echo "→ Dados de demonstração já presentes (${JA} solicitações). Pulando."
fi

cat <<FIM

===================================================================
 HOMOLOGAÇÃO NO AR:  https://${DOMINIO_HOMOLOG}
-------------------------------------------------------------------
 CRM interno (especialista)
   ${DOMINIO_HOMOLOG}/entrar       senha: ${SENHA_PAINEL}

 Portal — Administrador da Agência
   ${DOMINIO_HOMOLOG}/portal/entrar   rafael@mundomagico.com.br / agente123

 Portal — Agente de Viagens
   ${DOMINIO_HOMOLOG}/portal/entrar   larissa@mundomagico.com.br / agente123

 Formulário do cliente (exemplo)
   ${DOMINIO_HOMOLOG}/f/CTV8213
===================================================================
 O certificado HTTPS pode levar ~30s para ser emitido no primeiro
 acesso. Se aparecer erro de certificado, aguarde e recarregue.
===================================================================
FIM
