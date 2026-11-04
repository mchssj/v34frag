#!/usr/bin/env bash
# Instala Supabase en el VPS (plan docs/bitacora/2026-11-03-supabase-en-vps, sección 2). Se puede repetir.
# Se corre en el VPS como root, desde una copia de deploy/supabase en /tmp:
#   scp -r deploy/supabase ubuntu@<IP>:/tmp/cmleague-supabase
#   ssh ubuntu@<IP> "sudo bash /tmp/cmleague-supabase/instalar.sh"
# Antes, preparar-env.sh (desde la PC) deja /etc/cmleague/supabase.env.
#
#   1. Docker y Compose de los paquetes de Ubuntu (docker.io, docker-compose-v2), con los logs rotados.
#   2. El directorio docker/ del repo oficial de Supabase, en el commit fijado (OFICIAL_COMMIT), en /srv/supabase/oficial.
#   3. cmleague.yml (los ajustes) en /srv/supabase y el comando `sb` en /usr/local/bin.
#   4. El respaldo diario (cmleague-respaldo.timer, respaldar.sh); a R2 cuando exista /etc/cmleague/respaldo.env.
#   5. `sb arrancar`: solo db, rest, auth, storage y Kong, todo en 127.0.0.1.
set -euo pipefail

OFICIAL_COMMIT=cdba349de944dd7c1f206e304ec54729e0857563   # supabase/supabase, 2026-11-03 (Postgres 17.6, GoTrue v2.197.0, PostgREST v14.18, Kong 3.9.3)
aqui="$(cd "$(dirname "$0")" && pwd)"
env_file=/etc/cmleague/supabase.env

[[ $EUID -eq 0 ]] || { echo "Correr con sudo." >&2; exit 1; }
[[ -f "$env_file" ]] || { echo "Falta $env_file: correr antes preparar-env.sh desde la PC." >&2; exit 1; }

echo "== 1. Docker"
if ! command -v docker >/dev/null || ! docker compose version >/dev/null 2>&1; then
  apt-get update -q
  DEBIAN_FRONTEND=noninteractive apt-get install -y -q docker.io docker-compose-v2 git
fi
mkdir -p /etc/docker
if [[ ! -f /etc/docker/daemon.json ]]; then
  cat > /etc/docker/daemon.json <<'JSON'
{
  "log-driver": "json-file",
  "log-opts": { "max-size": "10m", "max-file": "3" }
}
JSON
  systemctl restart docker
fi
systemctl enable --now docker >/dev/null
docker --version; docker compose version

echo "== 2. Compose oficial de Supabase ($OFICIAL_COMMIT)"
mkdir -p /srv/supabase
if [[ ! -d /srv/supabase/oficial/.git ]]; then
  git clone -q --filter=blob:none --no-checkout https://github.com/supabase/supabase.git /srv/supabase/oficial
  git -C /srv/supabase/oficial sparse-checkout set docker
fi
git -C /srv/supabase/oficial fetch -q --filter=blob:none origin "$OFICIAL_COMMIT"
git -C /srv/supabase/oficial checkout -q "$OFICIAL_COMMIT"
git -C /srv/supabase/oficial log -1 --format='   %h %cs %s'

echo "== 3. Ajustes de CMLeague y el comando sb"
install -m 644 "$aqui/cmleague.yml" /srv/supabase/cmleague.yml
install -m 644 "$aqui/roles.sql" /srv/supabase/roles.sql
# Las plantillas de correo: GoTrue las pide por URL y Caddy las sirve (db.cmleague.lat/plantillas/).
if [[ -d "$aqui/plantillas" ]]; then install -d -m 755 /srv/supabase/plantillas; install -m 644 "$aqui"/plantillas/*.html /srv/supabase/plantillas/; fi
cat > /usr/local/bin/sb <<'SH'
#!/bin/sh
# Supabase de CMLeague (deploy/supabase). `sb arrancar` levanta solo lo que se usa; el resto es docker compose.
set -e
cd /srv/supabase/oficial/docker
dc() { docker compose -p supabase --env-file /etc/cmleague/supabase.env \
  -f docker-compose.yml -f docker-compose.kong.yml -f /srv/supabase/cmleague.yml "$@"; }
case "$1" in
  arrancar) shift; dc up -d "$@" db rest auth storage api-gw ;;
  psql) shift; exec docker exec -i supabase-db psql -U postgres -d postgres "$@" ;;
  # Confirmar el correo al registrarse (plan docs/bitacora/2026-11-03-admin-cuentas-usuarios). Reinicia unos segundos
  # solo el servicio de login. "off --confirmar-pendientes" además deja entrar a quienes tenían el correo sin confirmar.
  confirmar-correo)
    env_f=/etc/cmleague/supabase.env
    case "${2:-estado}" in
      on)  sed -i 's/^ENABLE_EMAIL_AUTOCONFIRM=.*/ENABLE_EMAIL_AUTOCONFIRM=false/' "$env_f"; dc up -d --no-deps auth ;;
      off) sed -i 's/^ENABLE_EMAIL_AUTOCONFIRM=.*/ENABLE_EMAIL_AUTOCONFIRM=true/' "$env_f"; dc up -d --no-deps auth
           if [ "${3:-}" = --confirmar-pendientes ]; then
             docker exec -i supabase-db psql -X -q -U supabase_admin -d postgres -c "update auth.users set email_confirmed_at = now() where email_confirmed_at is null"
           fi ;;
      estado) ;;
      *) echo "Uso: sb confirmar-correo [on|off [--confirmar-pendientes]|estado]" >&2; exit 2 ;;
    esac
    if grep -q '^ENABLE_EMAIL_AUTOCONFIRM=false' "$env_f"; then echo "Confirmar el correo: ENCENDIDO (el registro pide activar la cuenta)"
    else echo "Confirmar el correo: APAGADO (las cuentas nuevas quedan activas al registrarse)"; fi
    echo "Cuentas sin confirmar: $(docker exec -i supabase-db psql -X -At -U supabase_admin -d postgres -c 'select count(*) from auth.users where email_confirmed_at is null')"
    ;;
  *) dc "$@" ;;
esac
SH
chmod 755 /usr/local/bin/sb
install -m 755 "$aqui/respaldar.sh" /usr/local/bin/cmleague-respaldar
install -m 644 "$aqui/cmleague-respaldo.service" "$aqui/cmleague-respaldo.timer" /etc/systemd/system/
systemctl daemon-reload
systemctl enable --now cmleague-respaldo.timer >/dev/null

echo "== 5. Arranque"
sb arrancar
for i in $(seq 1 60); do
  if [[ "$(docker inspect -f '{{.State.Health.Status}}' supabase-db 2>/dev/null)" == healthy ]] &&
     curl -fsS -o /dev/null http://127.0.0.1:8000/auth/v1/health -H "apikey: $(sed -n 's/^ANON_KEY=//p' "$env_file")"; then
    break
  fi
  sleep 3
done
sb ps --format 'table {{.Name}}\t{{.Status}}'
echo "Supabase arriba en 127.0.0.1:8000 (Kong) y 127.0.0.1:5432 (Postgres)."
