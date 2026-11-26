#!/usr/bin/env bash
# Restaura un respaldo de respaldar.sh en el Supabase del VPS (docs/bitacora/2026-11-26-migracion-vps-brasil). Como root:
#
#   sudo cmleague-restaurar /srv/supabase/respaldos/<fecha>
#
# La carpeta tiene que tener base.dump, storage.tar.gz y permisos.sql (los respaldos desde el 2026-11-26), y SHA256SUMS.
# Uno de R2 se baja antes a una carpeta. BORRA la base y los archivos del VPS y los reemplaza por los del respaldo.
#
#   1. Comprueba los archivos y que la API, el worker y los timers estén apagados (si no, escribirían durante la restauración).
#   2. Base nueva y vacía. La clave de pgsodium (volumen supabase_db-config) se conserva: sin ella no se lee lo guardado en
#      Vault. En otra máquina, copiarla antes desde la original o desde su respaldo.
#   3. mm_listener, con la contraseña de MM_LISTEN_URL (/etc/cmleague/api.env): pg_dump no copia los roles.
#   4. pg_restore --clean y después permisos.sql: sin él, 539 funciones y 132 tablas o vistas de public quedaban con
#      permisos para anon y authenticated (ver permisos.sql).
#   5. Los archivos de Storage, ANALYZE y reinicio.
set -euo pipefail
dir="${1:?Uso: cmleague-restaurar <carpeta del respaldo>}"
vol=/srv/supabase/oficial/docker/volumes
[[ $EUID -eq 0 ]] || { echo "Correr con sudo." >&2; exit 1; }
for f in base.dump storage.tar.gz permisos.sql SHA256SUMS; do
  [[ -s "$dir/$f" ]] || { echo "Falta $dir/$f" >&2; exit 1; }
done
( cd "$dir" && sha256sum --quiet -c SHA256SUMS ) || { echo "SHA256SUMS no coincide: el respaldo está dañado." >&2; exit 1; }
for u in cmleague-api cmleague-mm cmleague-season.timer cmleague-notify.timer cmleague-medals.timer cmleague-demos.timer; do
  if systemctl is-active --quiet "$u"; then
    echo "$u está prendido: apagarlo antes (systemctl stop) y volver a prenderlo después." >&2; exit 1
  fi
done
mm_url=$(sed -n 's/^MM_LISTEN_URL=//p' /etc/cmleague/api.env 2>/dev/null | tr -d '"' || true)
admin() { docker exec -i supabase-db psql -X -q -v ON_ERROR_STOP=1 -U supabase_admin -d postgres "$@"; }
# mm_listener lo crea postgres, como en producción (migrar-vps.sh): así postgres queda como miembro con ADMIN.
pg() { docker exec -i supabase-db psql -X -q -v ON_ERROR_STOP=1 -U postgres -d postgres "$@"; }

echo "== 1. Base nueva (la clave de pgsodium queda)"
sb down
rm -rf "$vol/db/data"
sb arrancar >/dev/null
for i in $(seq 1 60); do
  [[ "$(docker inspect -f '{{.State.Health.Status}}' supabase-db 2>/dev/null)" == healthy ]] && break
  sleep 2
done

echo "== 2. mm_listener"
if [[ -n "$mm_url" ]]; then
  pw=$(python3 -c 'import sys, urllib.parse as u; print(u.unquote(u.urlsplit(sys.argv[1]).password or ""))' "$mm_url")
  echo "create role mm_listener login noinherit password :'pw';" | pg -v pw="$pw"
else
  echo "Sin MM_LISTEN_URL en /etc/cmleague/api.env: se crea sin contraseña (el socket del matchmaking no va a poder escuchar)."
  echo "create role mm_listener login noinherit;" | pg
fi

echo "== 3. Datos (pg_restore)"
set +e
docker exec -i supabase-db pg_restore -U supabase_admin -d postgres --clean --if-exists < "$dir/base.dump" 2> /tmp/cmleague-restaurar.err
set -e
errores=$(grep -c 'error:' /tmp/cmleague-restaurar.err || true)
echo "pg_restore: $errores errores (detalle en /tmp/cmleague-restaurar.err)"
grep 'error:' /tmp/cmleague-restaurar.err | head -5 || true

echo "== 4. Permisos exactos ($(wc -l < "$dir/permisos.sql") sentencias)"
{ echo 'begin;'; cat "$dir/permisos.sql"; echo 'commit;'; } | admin

echo "== 5. Archivos de Storage"
rm -rf "$vol/storage"
tar -C "$vol" -xzf "$dir/storage.tar.gz"
admin -c 'analyze'
sb restart >/dev/null
echo "Funciones de public que anon puede ejecutar: $(admin -At -c "select count(*) from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and has_function_privilege('anon', p.oid, 'execute')")"
echo "Listo. Prender la API, el worker y los timers (systemctl start) y revisar la web."
