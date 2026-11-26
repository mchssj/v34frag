-- Pruebas de las 140, 141 y 142 sobre la copia local de producción. Todo con rollback.
-- docker exec -i supabase_db_v34frag-api psql -U postgres -d postgres -v ON_ERROR_STOP=1 < vip_140_142.sql
\set QUIET on
\pset format unaligned
\pset tuples_only on
begin;
create temp table t as
  select p.id as player, p.user_id as usr, (select count(*) from match_player_stats s where s.player_id = p.id) n
    from players p where p.user_id is not null order by n desc limit 2;
create temp table u as select (select usr from t order by n desc limit 1) as vip, (select usr from t order by n limit 1) as otro,
  (select player from t order by n desc limit 1) as vip_p, (select player from t order by n limit 1) as otro_p,
  (select id from matches where kind = 'mix' and status = 'finished' order by played_at desc limit 1) as m;
grant select on u, t to authenticated, anon;
delete from vip_memberships where user_id in (select usr from t);
insert into vip_memberships(user_id, source) select vip, 'import' from u;
create function pg_temp.como(p uuid) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', p, 'role', 'authenticated')::text, true) $$;
create function pg_temp.ok(nombre text, b boolean) returns text language sql as $$ select case when b then 'ok    ' else 'FALLA ' end || nombre $$;
create function pg_temp.falla(q text, codigo text) returns boolean language plpgsql as $$
begin execute q; return false; exception when others then return sqlstate = codigo; end $$;
set local role authenticated;

select pg_temp.como(otro) from u \g /dev/null
select pg_temp.ok('sin VIP no marca', pg_temp.falla(format('select match_favorite_set(%L, true)', (select m from u)), 'V8901'));
select pg_temp.ok('sin VIP no guarda búsquedas', pg_temp.falla($$select saved_search_save('players', 'x', '{}')$$, 'V8901'));
select pg_temp.ok('sin VIP el desglose no trae pasos ni configuración', (select j->'config' = 'null' and not exists (select 1 from jsonb_array_elements(j->'items') i where i->'steps' <> 'null') from my_elo_breakdown(50) j));

select pg_temp.como(vip) from u \g /dev/null
select match_favorite_set(m, true) from u \g /dev/null
select match_favorite_set(m, true) from u \g /dev/null
select pg_temp.ok('con VIP marca (dos veces, una fila)', (select count(*) = 1 from match_favorites));
select pg_temp.ok('una partida que no existe', pg_temp.falla($$select match_favorite_set(gen_random_uuid(), true)$$, 'P0002'));
select pg_temp.ok('no escribe directo', pg_temp.falla($$delete from match_favorites$$, '42501'));
select pg_temp.ok('match_search por favoritas', (select j->'total' = '1' and j->'ids'->>0 = u.m::text and j->'counts'->>'mix' = '1' from u, match_search('{"favorites": true}') j));
select pg_temp.ok('sin filtros da lo mismo que match_list', (select (j->>'total')::int = (select count(*) from match_list where bye = false) from match_search('{}') j));
select pg_temp.ok('con + contra = juntos + rivales', (
  select (a->>'total')::int = x.same_matches and (b->>'total')::int = x.against_matches and x.same_matches + x.against_matches > 0
    from u, players_together(vip_p, otro_p) x,
         match_search(jsonb_build_object('kind', 'mix', 'status', '["finished"]'::jsonb, 'player', vip_p, 'with', otro_p)) a,
         match_search(jsonb_build_object('kind', 'mix', 'status', '["finished"]'::jsonb, 'player', vip_p, 'against', otro_p)) b));
select pg_temp.ok('con sin jugador falla', pg_temp.falla(format('select match_search(%L)', (select jsonb_build_object('with', vip_p) from u)), '22023'));
select pg_temp.ok('diferencia 2: ninguno la pasa', (select (j->>'total')::int > 0 and not exists (
  select 1 from jsonb_array_elements_text(j->'ids') i join matches m on m.id = i::uuid where abs(m.score1 - m.score2) > 2)
  from match_search('{"max_diff": 2, "kind": "mix", "status": ["finished"]}', 'played_at', 'desc', 100) j));
select pg_temp.ok('orden por diferencia', (select bool_and(d >= coalesce(a, d)) from (
  select abs(m.score1 - m.score2) d, lag(abs(m.score1 - m.score2)) over (order by i.o) a
    from match_search('{"kind": "mix", "status": ["finished"]}', 'round_diff', 'asc', 100) j, jsonb_array_elements_text(j->'ids') with ordinality i(id, o)
    join matches m on m.id = i.id::uuid) z));
select pg_temp.ok('páginas sin repetir', (select count(distinct x) = 40 from (
  select jsonb_array_elements_text(match_search('{}', 'played_at', 'desc', 20, 0)->'ids') x
  union all select jsonb_array_elements_text(match_search('{}', 'played_at', 'desc', 20, 20)->'ids')) z));
select saved_search_save('players', 'b' || g, '{"kd": 1}') from generate_series(1, 5) g \g /dev/null
select pg_temp.ok('la sexta búsqueda no entra', pg_temp.falla($$select saved_search_save('players', 'b6', '{}')$$, 'P0001'));
select saved_search_save('players', 'B1', '{"kd": 2}') \g /dev/null
select pg_temp.ok('mismo nombre la reemplaza', (select count(*) = 5 and max((query->>'kd')::int) = 2 from saved_searches where kind = 'players'));
select saved_search_save('matches', 'b1', '{}') \g /dev/null
select pg_temp.ok('el tope es por tipo', (select count(*) = 6 from saved_searches));
select pg_temp.ok('tarjeta: partidas y victorias como el perfil', (select (c->>'matches')::int = count(*) and (c->>'wins')::int = count(*) filter (where s.team = m.winner_side)
  from u, player_card(vip_p) c, match_player_stats s join matches m on m.id = s.match_id
  where s.player_id = u.vip_p and s.team in (1, 2) and m.kind = 'mix' and m.status = 'finished' group by c));
select pg_temp.ok('tarjeta de un período vacío', (select c->>'matches' = '0' and c->'kd' = 'null' and c->>'streak' = '0' from u, player_card(vip_p, now() + interval '1 day') c));
select pg_temp.ok('desglose: todos los pasos dan el cambio guardado', (select count(*) > 0 and bool_and((i->'steps'->>'exact')::boolean)
  from my_elo_breakdown(50) j, jsonb_array_elements(j->'items') i where i->>'formula' = 'match'));
select pg_temp.ok('desglose: los de la fórmula anterior, sin pasos', (select count(*) > 0 and bool_and(i->'steps' = 'null')
  from generate_series(0, 300, 50) g, my_elo_breakdown(50, g) j, jsonb_array_elements(j->'items') i where i->>'formula' = 'old'));
select pg_temp.ok('filtros: una fila por ficha', (select count(*) = count(distinct player_id) and count(*) = (select count(*) from players) from player_filters));
select pg_temp.ok('filtros: el Histórico tiene los mismos que el ranking', (select count(*) = (select count(*) from player_ranking) and bool_or(vip) and bool_or(has_team) from player_ranking_search));
select pg_temp.ok('filtros: cada temporada tiene los mismos que su ranking', (select count(*) = (select count(*) from season_standings_list) and count(distinct season_id) > 1 from season_standings_search));
select pg_temp.ok('filtros: mismo puesto en los dos', not exists (select 1 from player_ranking a join player_ranking_search b using (id) where a.position <> b.position));

select pg_temp.como(otro) from u \g /dev/null
select pg_temp.ok('no ve lo ajeno', (select (select count(*) from match_favorites) = 0 and (select count(*) from saved_searches) = 0));
select pg_temp.ok('no borra la búsqueda ajena', pg_temp.falla($$select saved_search_delete((select id from saved_searches limit 1))$$, 'P0002'));

reset role;
update vip_memberships set ends_at = now() - interval '1 second', starts_at = now() - interval '1 day' where user_id = (select vip from u);
set local role authenticated;
select pg_temp.como(vip) from u \g /dev/null
select pg_temp.ok('VIP vencido: ve sus favoritas', (select count(*) = 1 from match_favorites));
select pg_temp.ok('VIP vencido: no marca', pg_temp.falla(format('select match_favorite_set(%L, true)', (select m from u)), 'V8901'));
select match_favorite_set(m, false) from u \g /dev/null
select pg_temp.ok('VIP vencido: puede sacar', (select count(*) = 0 from match_favorites));

set local role anon;
select pg_temp.ok('sin sesión: filtros sí, favoritas no', (select count(*) > 0 from player_ranking_search) and pg_temp.falla('select 1 from match_favorites', '42501'));
rollback;
