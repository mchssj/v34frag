#!/usr/bin/env bash
# Dos jugadores toman el mismo link de reemplazo a la vez, cada uno en su sesión: solo uno lo consigue.
# SOLO en una base local con el replanteo 75 aplicado: crea datos de prueba (commiteados, para que las dos sesiones los vean)
# y los borra al final. Uso: ./concurrencia_75.sh            (Supabase local, contenedor supabase_db_v34frag-api)
set -euo pipefail
db() { MSYS_NO_PATHCONV=1 docker exec -i supabase_db_v34frag-api psql -U postgres -X -q -At -v ON_ERROR_STOP=1 "$@"; }
tag="c75$(date +%s)"
tok="tok-$tag"

# La configuración de la base, para dejarla como estaba.
antes=$(db -c "select format('update mm_config set require_anticheat = %L, min_mixes = %s, min_account_days = %s where id = 1;', require_anticheat, min_mixes, min_account_days) from mm_config")

# Preparación: una sala en vivo con un abandono y su pedido abierto, y dos candidatos.
read -r lobby u1 u2 < <(db <<SQL
do \$\$
declare
  u uuid[] := array(select gen_random_uuid() from generate_series(1, 3));
  p uuid; srv uuid; m uuid; l uuid;
begin
  update mm_config set require_anticheat = false, min_mixes = 0, min_account_days = 0 where id = 1;
  insert into auth.users (id, email, email_confirmed_at, created_at, aud, role)
    select z, z || '@$tag.local', now(), now() - interval '30 days', 'authenticated', 'authenticated' from unnest(u) z;
  insert into game_servers (name, token_hash, active, mm_enabled) values ('$tag', mm_replace_hash('x$tag'), true, false) returning id into srv;
  insert into matches (kind, status, best_of, side1_name, side2_name, server_id) values ('mm', 'live', 1, 'a', 'b', srv) returning id into m;
  insert into mm_lobbies (mode, status, match_id, server_id, map, password) values ('5v5', 'live', m, srv, 'de_dust2', 'pw') returning id into l;
  insert into players (nick, user_id, steam_id) values ('$tag-0', u[1], (76561197960265728 + floor(random() * 1e9)::bigint)::text) returning id into p;
  insert into mm_lobby_players (lobby_id, user_id, player_id, team, elo, joined_at, accepted_at, abandoned) values (l, u[1], p, 1, 1000, now(), now(), true);
  insert into players (nick, user_id, steam_id) select '$tag-' || i, u[i + 1], (76561197960265728 + floor(random() * 1e9)::bigint)::text from generate_series(1, 2) i;
  insert into mm_replacements (lobby_id, team, replaced_user_id, source, token, token_hash, expires_at)
    values (l, 1, u[1], 'auto', '$tok', mm_replace_hash('$tok'), now() + interval '10 minutes');
  perform set_config('c75.out', l || ' ' || u[2] || ' ' || u[3], false);
end \$\$;
select current_setting('c75.out');
SQL
)
echo "sala $lobby; candidatos $u1 y $u2"

# Cada sesión toma el link y espera 2 s antes de confirmar: la otra queda trabada en el bloqueo de la fila.
take() {
  db 2>&1 <<SQL || true
begin;
select set_config('request.jwt.claims', json_build_object('sub', '$1', 'role', 'authenticated')::text, true);
select 'TOMÓ ' || mm_replace_take('$tok');
select pg_sleep(2);
commit;
SQL
}
tmp=$(mktemp -d)
take "$u1" > "$tmp/a" & take "$u2" > "$tmp/b" & wait
cat "$tmp/a" "$tmp/b" | grep -E 'TOMÓ|ERROR' || true
ganaron=$(cat "$tmp/a" "$tmp/b" | grep -c 'TOMÓ' || true)
perdio=$(cat "$tmp/a" "$tmp/b" | grep -c 'Ya lo tomó otro jugador' || true)
filas=$(db -c "select count(*) from mm_lobby_players where lobby_id = '$lobby' and replaces_user_id is not null")

# Limpieza.
db <<SQL
delete from mm_lobbies where id = '$lobby';
delete from matches where side1_name = 'a' and server_id = (select id from game_servers where name = '$tag');
delete from game_servers where name = '$tag';
delete from players where nick like '$tag-%' or user_id in (select id from auth.users where email like '%@$tag.local');
delete from auth.users where email like '%@$tag.local';
$antes
SQL
rm -rf "$tmp"

echo "ganaron: $ganaron · rechazados: $perdio · reemplazos en la sala: $filas"
if [ "$ganaron" = 1 ] && [ "$perdio" = 1 ] && [ "$filas" = 1 ]; then echo "OK: solo uno lo tomó"; else echo "FALLA"; exit 1; fi
