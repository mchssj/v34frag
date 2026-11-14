#!/usr/bin/env bash
# Compara los permisos de anon, authenticated, service_role y PUBLIC sobre cada función, tabla, vista y secuencia de
# public entre dos bases. Cada base es "local:<nombre>" (en el contenedor de la Supabase local) o "prod" (por el túnel
# de PG_* del .env de la raíz, solo lectura).
#   bash comparar.sh [referencia] [comparada] [salida]
# Por defecto: local:referencia_permisos contra local:postgres. Escribe las diferencias en la salida (por defecto,
# acl_diff.txt al lado del script): una línea por objeto, "tipo|nombre|+[lo que sobra]|-[lo que falta]".
# Sale con 1 si hay diferencias en objetos que están en las dos.
set -euo pipefail

aqui="$(cd "$(dirname "$0")" && pwd)"
raiz="$(cd "$aqui/../../../.." && pwd)"
ref="${1:-local:referencia_permisos}"
cmp="${2:-local:postgres}"
salida="${3:-$aqui/acl_diff.txt}"
C="supabase_db_$(sed -n 's/^project_id = "\(.*\)"/\1/p' "$raiz/web/backend/supabase/config.toml")"
tmp="$(mktemp -d)"

Q="with o as (
  select 'f' k, p.oid::regprocedure::text n, p.proacl acl from pg_proc p
   where p.pronamespace = 'public'::regnamespace and p.prokind in ('f', 'p')
  union all
  select c.relkind::text, c.oid::regclass::text, c.relacl from pg_class c
   where c.relnamespace = 'public'::regnamespace and c.relkind in ('r', 'v', 'm', 'S', 'p')
  union all
  -- Permisos por columna (matches y ac_devices): un revoke sobre la tabla también los borra.
  select 'c', a.attrelid::regclass::text || '.' || quote_ident(a.attname), a.attacl from pg_attribute a join pg_class c on c.oid = a.attrelid
   where c.relnamespace = 'public'::regnamespace and c.relkind in ('r', 'v', 'm', 'p') and a.attnum > 0 and not a.attisdropped)
select k, n, case when k = 'c' and o.acl is null then '' else coalesce((select string_agg(case when x.grantee = 0 then 'PUBLIC' else pg_get_userbyid(x.grantee) end || ':' || x.privilege_type, ',' order by 1)
                         from aclexplode(coalesce(o.acl, case k when 'f' then acldefault('f', 10) else acldefault('r', 10) end)) x
                        where x.grantee = 0 or pg_get_userbyid(x.grantee) in ('anon', 'authenticated', 'service_role')), '') end
  from o order by 1, 2"

leer() {
  case "$1" in
    # La consulta va por la entrada estándar: como argumento, Windows le cambia la codificación a las tildes.
    local:*) printf '%s' "$Q" | docker exec -i "$C" psql -U postgres -d "${1#local:}" -At -F'|' ;;
    prod)
      # El .env está en el repo principal (los worktrees no lo tienen).
      local env="$raiz/.env"
      [[ -f "$env" ]] || env="$(git -C "$raiz" worktree list --porcelain | sed -n '1s/^worktree //p')/.env"
      l() { grep "^$1=" "$env" | tail -1 | cut -d= -f2- | tr -d '\r'; }
      PGHOST="$(l PG_HOST)" PGPORT="$(l PG_PORT)" PGUSER="$(l PG_USER)" PGPASSWORD="$(l PG_PASSWORD)" PGDATABASE=postgres \
        PGSSLMODE="$(l PG_SSLMODE)" PGCLIENTENCODING=UTF8 PGOPTIONS='-c default_transaction_read_only=on' psql -At -F'|' <<< "$Q" ;;
    *) echo "Base desconocida: $1 (local:<nombre> o prod)" >&2; exit 2 ;;
  esac
}
leer "$ref" > "$tmp/ref.txt"
leer "$cmp" > "$tmp/cmp.txt"

python -I - "$tmp/ref.txt" "$tmp/cmp.txt" "$salida" <<'PY'
import sys
def load(f):
    d = {}
    for line in open(f, encoding='utf-8'):
        k, n, acl = line.rstrip('\n').split('|', 2)
        d[(k, n)] = set(a for a in acl.split(',') if a)
    return d
ref, cmp_, out = load(sys.argv[1]), load(sys.argv[2]), sys.argv[3]
solo_ref = [n for (k, n) in ref if (k, n) not in cmp_]
solo_cmp = [n for (k, n) in cmp_ if (k, n) not in ref]
diffs = []
for x in sorted(ref):
    if x in cmp_ and ref[x] != cmp_[x]:
        diffs.append(f"{x[0]}|{x[1]}|+{sorted(cmp_[x] - ref[x])}|-{sorted(ref[x] - cmp_[x])}")
open(out, 'w', encoding='utf-8', newline='\n').write('\n'.join(diffs) + ('\n' if diffs else ''))
print(f"{len(ref)} objetos en la referencia, {len(cmp_)} en la comparada")
print(f"solo en la referencia: {len(solo_ref)} {solo_ref[:10]}")
print(f"solo en la comparada: {len(solo_cmp)} {solo_cmp[:10]}")
print(f"con permisos distintos: {len(diffs)} (detalle en {out})")
sys.exit(1 if diffs else 0)
PY
