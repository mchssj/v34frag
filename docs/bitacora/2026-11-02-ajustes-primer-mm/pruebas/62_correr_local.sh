#!/usr/bin/env bash
# Prueba del replanteo 62 (imagen del MVP con pg_safeupdate, como en staging) en la base local, en una transacción que
# se deshace. Corre como supabase_admin, que puede cargar safeupdate. Sin el 62 tiene que fallar; con el 62, guardar.
#
#   bash 62_correr_local.sh <carpeta de la rama feat/mm-claim-en-sala>
set -euo pipefail
repo="${1:?falta la carpeta del repo con la rama feat/mm-claim-en-sala}"
db="${DB_CONTAINER:-supabase_db_v34frag-api}"
sin_tx() { grep -v -E '^(begin|commit);\r?$' "$1"; }
q() { docker exec "$db" psql -U postgres -tAc "$1"; }

{
  echo '\set ON_ERROR_STOP on'
  echo 'begin;'
  echo 'set client_min_messages = warning;'
  [ -n "$(q "select to_regclass('public.ac_devices')")" ] || sin_tx "$repo/supabase/replanteo/45_anticheat.sql"
  if [ -z "$(q "select to_regprocedure('public.mm_admin_set_mvp_image(text)')")" ]; then
    for n in 48_matchmaking 49_mm_claim_en_sala 50_mm_min_mixes_cero 51_mm_min_account_days_cero 52_mm_cuentas_sin_ficha \
             53_match_list_sin_mm 54_mm_imagen_mvp; do
      sin_tx "$repo/supabase/replanteo/$n.sql"
    done
  fi
  cat <<'SQL'
set client_min_messages = notice;
create temp table ids (u uuid);
insert into ids values (gen_random_uuid());
insert into auth.users (id, email, email_confirmed_at, created_at, aud, role)
  select u, u || '@prueba.local', now(), now(), 'authenticated', 'authenticated' from ids;
insert into profiles (id, role) select u, 'admin' from ids on conflict (id) do update set role = 'admin';
select set_config('request.jwt.claims', json_build_object('sub', u, 'role', 'authenticated')::text, true) from ids;
load 'safeupdate';
savepoint antes;
do $$ begin
  perform mm_admin_set_mvp_image('https://x.test/a.png');
  raise exception 'FALLA: sin el 62 no tendría que guardar';
exception when others then
  if sqlerrm not ilike '%WHERE%' then raise; end if;
  raise notice 'OK: sin el 62 falla como en staging (%)', sqlerrm;
end $$;
rollback to savepoint antes;
SQL
  sin_tx "$repo/supabase/replanteo/62_mm_imagen_mvp_where.sql"
  cat <<'SQL'
do $$ begin
  perform mm_admin_set_mvp_image('https://x.test/b.png');
  if mm_mvp_image() <> 'https://x.test/b.png' then raise exception 'FALLA: no guardó'; end if;
  if mm_admin_set_mvp_image(null) <> 'https://x.test/b.png' then raise exception 'FALLA: no devolvió la anterior'; end if;
  if mm_mvp_image() is not null then raise exception 'FALLA: no quitó'; end if;
  raise notice 'OK: con el 62 guarda, devuelve la anterior y quita';
end $$;
SQL
  sin_tx "$repo/docs/bitacora/2026-10-14-replanteo-modelo-datos/reversas/62_mm_imagen_mvp_where.sql"
  echo "do \$\$ begin if position('where id = 1' in pg_get_functiondef('public.mm_admin_set_mvp_image(text)'::regprocedure)) > 0 then raise exception 'FALLA inversa'; end if; raise notice 'OK: la inversa deja la 54'; end \$\$;"
  echo 'rollback;'
} | docker exec -i "$db" psql -U supabase_admin -d postgres -q -v ON_ERROR_STOP=1
