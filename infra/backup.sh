#!/usr/bin/env bash
# =====================================================================
# DISNEY EXPERT · Backup diário do banco
#
# Instalar no cron, às 3h da manhã:
#   sudo crontab -e
#   0 3 * * * /opt/disney-expert/infra/backup.sh >> /var/log/backup-disney.log 2>&1
#
# O script falha alto de propósito. Backup que quebra em silêncio é
# pior do que não ter backup, porque cria uma sensação falsa de proteção.
# =====================================================================

set -euo pipefail

RAIZ="/opt/disney-expert"
PASTA_INFRA="$RAIZ/infra"
DESTINO="$RAIZ/backups"
RETENCAO_DIAS=14

set -a
# shellcheck source=/dev/null
source "$PASTA_INFRA/.env"
set +a

CARIMBO=$(date +%Y-%m-%d_%H%M)
ARQUIVO="$DESTINO/disney_${CARIMBO}.sql.gz"

mkdir -p "$DESTINO"
cd "$PASTA_INFRA"

echo "[$(date '+%F %T')] iniciando backup"

docker compose exec -T db \
  pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" --clean --if-exists \
  | gzip > "$ARQUIVO"

# --- verificação -----------------------------------------------------
# Um pg_dump que falha no meio ainda gera arquivo. Se estiver pequeno
# demais ou corrompido, o backup não presta e precisa gritar agora.
TAMANHO=$(stat -c%s "$ARQUIVO")
if [ "$TAMANHO" -lt 10000 ]; then
  echo "ERRO: backup com apenas ${TAMANHO} bytes. Provavelmente falhou." >&2
  exit 1
fi

if ! gzip -t "$ARQUIVO"; then
  echo "ERRO: arquivo de backup corrompido." >&2
  exit 1
fi

echo "[$(date '+%F %T')] backup gerado: $ARQUIVO (${TAMANHO} bytes)"

# --- cópia remota ----------------------------------------------------
# Backup que mora no mesmo servidor do banco não é backup. Se o VPS for
# perdido, os dois somem juntos.
if [ -n "${RCLONE_DESTINO:-}" ]; then
  rclone copy "$ARQUIVO" "$RCLONE_DESTINO" --no-traverse
  echo "[$(date '+%F %T')] cópia remota concluída"
else
  echo "AVISO: RCLONE_DESTINO vazio. O backup existe apenas neste servidor." >&2
fi

# --- limpeza ---------------------------------------------------------
find "$DESTINO" -name 'disney_*.sql.gz' -mtime "+$RETENCAO_DIAS" -delete

# --- aviso de vida ---------------------------------------------------
if [ -n "${URL_MONITOR_BACKUP:-}" ]; then
  curl -fsS --max-time 10 "$URL_MONITOR_BACKUP" > /dev/null || \
    echo "AVISO: não consegui avisar o monitoramento." >&2
fi

echo "[$(date '+%F %T')] backup concluído"
