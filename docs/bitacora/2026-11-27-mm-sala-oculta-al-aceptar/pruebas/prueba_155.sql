-- Prueba del replanteo 155 contra producción, todo con rollback. Se corre así (el begin/commit del 155 se saca):
--   (echo 'begin;'; sed -e '/^begin;$/d' -e '/^commit;$/d' supabase/replanteo/155_mm_sala_oculta_al_aceptar.sql;
--    cat docs/bitacora/2026-11-27-mm-sala-oculta-al-aceptar/pruebas/prueba_155.sql) | psql -U supabase_admin
-- Usa la última sala terminada: la pone en accepting y mira lo que ve uno de sus jugadores.
\set ON_ERROR_STOP 1
create temp table t_sala as
  select l.id, (select user_id from mm_lobby_players where lobby_id = l.id and user_id is not null order by player_id limit 1) as viewer
    from mm_lobbies l where l.status = 'finished' order by l.ended_at desc limit 1;

update mm_lobbies set status = 'accepting' where id = (select id from t_sala);

do $$
declare s t_sala%rowtype; j jsonb; n_total int; n_named int; n_hidden int; n_team int; n_me int; leaked int; txt text;
begin
  select * into s from t_sala;
  j := mm_lobby_json(s.id, s.viewer);
  n_total := jsonb_array_length(j->'players');
  select count(*) filter (where p->>'nick' <> ''), count(*) filter (where p->>'player_id' like 'oculto-%'),
         count(*) filter (where p->'team' <> 'null'::jsonb), count(*) filter (where (p->>'is_me')::boolean)
    into n_named, n_hidden, n_team, n_me from jsonb_array_elements(j->'players') p;
  -- Ningún nick de los demás aparece en ningún lado del JSON (salvo nicks muy cortos que puedan coincidir).
  txt := j::text;
  select count(*) into leaked from mm_lobby_players lp join players p on p.id = lp.player_id
   where lp.lobby_id = s.id and lp.user_id <> s.viewer and length(p.nick) >= 4 and position(('"' || p.nick || '"') in txt) > 0;
  raise notice 'accepting, jugador: % tarjetas, % con nick, % ocultas, % con equipo, % is_me, % nicks filtrados',
    n_total, n_named, n_hidden, n_team, n_me, leaked;
  if n_named <> 1 or n_hidden <> n_total - 1 or n_me <> 1 or n_team > 1 or leaked > 0 then raise exception 'FALLA: accepting no oculta'; end if;

  -- Alguien que no es de la sala (Administración) ve todo.
  j := mm_lobby_json(s.id, gen_random_uuid());
  select count(*) filter (where p->>'nick' <> '') into n_named from jsonb_array_elements(j->'players') p;
  raise notice 'accepting, de afuera: % con nick de %', n_named, n_total;
  if n_named <> n_total then raise exception 'FALLA: el de afuera no ve todo'; end if;

  -- En el veto, la sala completa.
  update mm_lobbies set status = 'veto' where id = s.id;
  j := mm_lobby_json(s.id, s.viewer);
  select count(*) filter (where p->>'nick' <> '') into n_named from jsonb_array_elements(j->'players') p;
  raise notice 'veto: % con nick de %', n_named, n_total;
  if n_named <> n_total then raise exception 'FALLA: el veto no muestra la sala'; end if;

  -- Cancelada antes del veto (sin match_id): sigue oculta. Con match_id: completa.
  update mm_lobbies set status = 'cancelled' where id = s.id;
  j := mm_lobby_json(s.id, s.viewer);
  select count(*) filter (where p->>'nick' <> '') into n_named from jsonb_array_elements(j->'players') p;
  raise notice 'cancelada después del veto: % con nick', n_named;
  if n_named <> n_total then raise exception 'FALLA: cancelada después del veto'; end if;
  update mm_lobbies set match_id = null where id = s.id;
  j := mm_lobby_json(s.id, s.viewer);
  select count(*) filter (where p->>'nick' <> '') into n_named from jsonb_array_elements(j->'players') p;
  raise notice 'cancelada antes del veto: % con nick', n_named;
  if n_named <> 1 then raise exception 'FALLA: cancelada antes del veto'; end if;

  -- El aviso del socket ya no lleva el user_id.
  if pg_get_functiondef('public.mm_trg_notify()'::regprocedure) ~ '''user_id'', new.user_id' then raise exception 'FALLA: lobby.accept con user_id'; end if;
  raise notice 'OK';
end $$;
rollback;
