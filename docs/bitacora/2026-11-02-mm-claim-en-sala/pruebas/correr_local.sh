#!/usr/bin/env bash
# Corre las pruebas del replanteo 49 en la base local del backend (contenedor supabase_db_v34frag-api), dentro de una
# sola transacción que se deshace: aplica 45 y 48 si faltan, después la 49, las pruebas y la inversa. No deja nada.
#
#   bash correr_local.sh <carpeta de la rama feat/mm-claim-en-sala>
set -euo pipefail
repo="${1:?falta la carpeta del repo con la rama feat/mm-claim-en-sala}"
aqui="$(cd "$(dirname "$0")" && pwd)"
db="${DB_CONTAINER:-supabase_db_v34frag-api}"
sin_tx() { grep -v -E '^(begin|commit);$' "$1"; }

{
  echo '\set ON_ERROR_STOP on'
  echo 'begin;'
  if [ -z "$(docker exec "$db" psql -U postgres -tAc "select to_regclass('public.ac_devices')")" ]; then
    sin_tx "$repo/supabase/replanteo/45_anticheat.sql"
  fi
  if [ -z "$(docker exec "$db" psql -U postgres -tAc "select to_regclass('public.mm_config')")" ]; then
    sin_tx "$repo/supabase/replanteo/48_matchmaking.sql"
  fi
  sin_tx "$repo/supabase/replanteo/49_mm_claim_en_sala.sql"
  cat "$aqui/49_mm_claim_en_sala.sql"
  # La inversa también tiene que aplicar limpia, y después la cola vuelve a pedir SteamID.
  sin_tx "$repo/docs/bitacora/2026-10-14-replanteo-modelo-datos/reversas/49_mm_claim_en_sala.sql"
  cat <<'SQL'
do $$
declare u uuid := gen_random_uuid();
begin
  insert into auth.users (id, email, email_confirmed_at, created_at, aud, role)
    values (u, u || '@prueba.local', now(), now() - interval '30 days', 'authenticated', 'authenticated');
  insert into players (nick, user_id) values ('inv' || substr(md5(random()::text), 1, 8), u);
  if mm_block_reason(u) is distinct from 'Tu ficha no tiene un SteamID principal' then
    raise exception 'FALLA inversa: %', mm_block_reason(u);
  end if;
  raise notice 'OK: la inversa vuelve a pedir SteamID';
end $$;
SQL
  echo 'rollback;'
} | docker exec -i "$db" psql -U postgres -q -v ON_ERROR_STOP=1
