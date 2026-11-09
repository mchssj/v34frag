#!/usr/bin/env bash
# Prueba el replanteo 98 y su inversa dentro de UNA transacción que termina en rollback (no deja nada en la base).
# Uso: ./probar_98.sh "<cadena de conexión de psql>"     (o, con la Supabase local:  ./probar_98.sh docker)
set -euo pipefail
here="$(cd "$(dirname "$0")" && pwd)"
root="$here/../../../.."
sin_tx() { grep -v -x -e 'begin;' -e 'commit;' "$1" | tr -d '\r'; }
fn="'public.mm_player_card(uuid, uuid, mm_lobby_players)'::regprocedure"
# Una ficha con cuenta, vista por su dueño y por otro.
card="select mm_player_card(p.id, p.user_id) c, mm_player_card(p.id, gen_random_uuid()) o from players p where p.user_id is not null limit 1"
{
  echo '\set ON_ERROR_STOP on'
  echo 'begin;'
  echo "create temp table t_antes as select md5(pg_get_functiondef($fn)) d;"
  echo "select 'antes, con is_me: ' || (c ? 'is_me') from ($card) x;"
  sin_tx "$root/supabase/replanteo/98_mm_ficha_is_me.sql"
  echo "select 'is_me del dueño: ' || (c->>'is_me') || ', de otro: ' || (o->>'is_me') || ', linked: ' || (c ? 'linked') || ', country: ' || (c ? 'country') || ', verified: ' || (c ? 'verified') from ($card) x;"
  echo "\echo '--- Inversa'"
  sin_tx "$root/docs/bitacora/2026-10-14-replanteo-modelo-datos/reversas/98_mm_ficha_is_me.sql"
  echo "select 'función igual a antes: ' || (md5(pg_get_functiondef($fn)) = (select d from t_antes));"
  echo 'rollback;'
} | if [ "${1:-}" = docker ]; then
  MSYS_NO_PATHCONV=1 docker exec -i supabase_db_v34frag-api psql -U postgres -X -q -At -P pager=off
else
  psql "$1" -X -q -At -P pager=off
fi
