#!/usr/bin/env bash
# Respaldo diario del Supabase del VPS (plan docs/bitacora/2026-11-03-supabase-en-vps, sección 5). Lo corre
# cmleague-respaldo.timer como root; a mano: sudo /usr/local/bin/cmleague-respaldar
#
#   1. pg_dump -Fc de la base completa (como supabase_admin: public, auth, storage y lo demás) y tar de los archivos
#      de Storage, en /srv/supabase/respaldos/AAAAMMDDTHHMMSSZ/. Quedan los últimos 7 en el VPS.
#   2. Si /etc/cmleague/respaldo.env tiene R2_ACCOUNT_ID, R2_BUCKET, R2_ACCESS_KEY_ID y R2_SECRET_ACCESS_KEY, los sube
#      a R2 (S3 firmado con curl --aws-sigv4). Los de más de 14 días los borra la regla de ciclo de vida del bucket.
#   3. Comprueba el volcado (pg_restore --list) y avisa por Discord si falla (DISCORD_UPTIME_WEBHOOK, opcional).
set -euo pipefail
base=/srv/supabase/respaldos
fecha="$(date -u +%Y%m%dT%H%M%SZ)"
dir="$base/$fecha"
[[ -f /etc/cmleague/respaldo.env ]] && { set -a; . /etc/cmleague/respaldo.env; set +a; }

avisar() {
  [[ -n "${DISCORD_UPTIME_WEBHOOK:-}" ]] || return 0
  curl -fsS -m 15 -H 'Content-Type: application/json' -d "{\"content\":\"$1\"}" "$DISCORD_UPTIME_WEBHOOK" >/dev/null || true
}
trap 'avisar "Respaldo de la base del VPS: FALLÓ ($fecha). Ver journalctl -u cmleague-respaldo."' ERR

install -d -m 700 "$base" "$dir"
docker exec supabase-db pg_dump -U supabase_admin -d postgres -Fc > "$dir/base.dump"
tar -C /srv/supabase/oficial/docker/volumes -czf "$dir/storage.tar.gz" storage
# Un volcado que pg_restore no puede leer no es un respaldo.
docker exec -i supabase-db pg_restore --list < "$dir/base.dump" | grep -c "TABLE DATA" > "$dir/tablas.txt"
( cd "$dir" && sha256sum base.dump storage.tar.gz > SHA256SUMS )
echo "Respaldo $fecha: base $(du -h "$dir/base.dump" | cut -f1), storage $(du -h "$dir/storage.tar.gz" | cut -f1), $(cat "$dir/tablas.txt") tablas con datos"

if [[ -n "${R2_BUCKET:-}" && -n "${R2_ACCESS_KEY_ID:-}" && -n "${R2_SECRET_ACCESS_KEY:-}" && -n "${R2_ACCOUNT_ID:-}" ]]; then
  for f in base.dump storage.tar.gz SHA256SUMS; do
    curl -fsS -m 600 --aws-sigv4 "aws:amz:auto:s3" --user "$R2_ACCESS_KEY_ID:$R2_SECRET_ACCESS_KEY" \
      -T "$dir/$f" "https://$R2_ACCOUNT_ID.r2.cloudflarestorage.com/$R2_BUCKET/$fecha/$f"
  done
  echo "Subido a R2: $R2_BUCKET/$fecha/"
else
  echo "Sin R2 configurado (/etc/cmleague/respaldo.env): el respaldo queda solo en el VPS."
fi

# Los últimos 7 en el VPS.
ls -1d "$base"/*/ | sort | head -n -7 | xargs -r rm -rf
