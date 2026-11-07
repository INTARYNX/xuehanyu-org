#!/usr/bin/env bash
# Installe / met à jour le service de rappels sur happysrv. Idempotent.
# Lancé en root DEPUIS le dossier qui contient push_server.py (voir scripts/deploy-push.ps1).
set -euo pipefail

SRC="$(cd "$(dirname "$0")" && pwd)"
APP=/opt/xuehanyu_push
CONF=/etc/nginx/conf.d/xuehanyu_org.conf

mkdir -p "$APP"
install -m 0644 "$SRC/push_server.py" "$APP/push_server.py"
install -m 0644 "$SRC/requirements.txt" "$APP/requirements.txt"
[ -x "$APP/venv/bin/python" ] || python3 -m venv "$APP/venv"
"$APP/venv/bin/pip" install -q --disable-pip-version-check -r "$APP/requirements.txt"
restorecon -R "$APP" 2>/dev/null || true

install -m 0644 "$SRC/xuehanyu-push.service" /etc/systemd/system/xuehanyu-push.service
systemctl daemon-reload
systemctl enable xuehanyu-push.service >/dev/null 2>&1
systemctl restart xuehanyu-push.service

for i in $(seq 1 20); do
  if curl -fsS http://127.0.0.1:3004/api/push/health >/dev/null 2>&1; then break; fi
  sleep 1
done
curl -fsS http://127.0.0.1:3004/api/push/health
echo

# nginx : sauvegarde, patch, test ; en cas d'échec on restaure l'ancienne conf sans recharger
BAK="$CONF.bak-$(date +%Y%m%d%H%M%S)"
cp -p "$CONF" "$BAK"
python3 "$SRC/patch_nginx.py" "$CONF"
if nginx -t 2>/dev/null; then
  systemctl reload nginx
  echo "nginx rechargé (sauvegarde : $BAK)"
else
  cp -p "$BAK" "$CONF"
  nginx -t || true
  echo "ERREUR nginx : ancienne configuration restaurée" >&2
  exit 1
fi
