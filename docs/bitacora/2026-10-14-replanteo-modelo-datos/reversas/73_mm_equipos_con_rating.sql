-- Inversa del replanteo 73: los equipos se reparten otra vez solo con el ELO. Borra mm_balance_elos, los campos de
-- mm_config y mm_lobby_players.balance_elo (se pierde el ELO de armado de las salas ya jugadas).
begin;

create or replace function pg_temp.reemplazar(fn regprocedure, cambios text[][]) returns void language plpgsql as $$
declare d text := pg_get_functiondef(fn); i int; a text; b text;
begin
  for i in 1 .. array_length(cambios, 1) loop
    a := replace(cambios[i][1], E'\r', ''); b := replace(cambios[i][2], E'\r', '');
    if position(a in d) = 0 then
      raise exception 'inversa 73: en % no se encontró: %', fn, left(a, 80);
    end if;
    d := replace(d, a, b);
  end loop;
  execute d;
end $$;

select pg_temp.reemplazar('public.mm_try_build(text)', array[
  ['  v_window int;' || E'\n' ||
   '  v_bal int[];',
   '  v_window int;'],
  ['    -- (replanteo 73) Con balance_rating, los equipos se reparten con el ELO de armado (null si está apagado).' || E'\n' ||
   '    v_bal := mm_balance_elos(v_players, v_elos);' || E'\n' ||
   '    teams := mm_best_split(v_users, coalesce(v_bal, v_elos), v_parties, v_size);',
   '    teams := mm_best_split(v_users, v_elos, v_parties, v_size);'],
  ['      insert into mm_lobby_players (lobby_id, user_id, player_id, party_id, region, team, elo, joined_at, balance_elo)' || E'\n' ||
   '        values (v_lobby, v_users[i], v_players[i], v_parties[i], v_regions[i], teams[i], v_elos[i], v_joined[i], v_bal[i]);',
   '      insert into mm_lobby_players (lobby_id, user_id, player_id, party_id, region, team, elo, joined_at)' || E'\n' ||
   '        values (v_lobby, v_users[i], v_players[i], v_parties[i], v_regions[i], teams[i], v_elos[i], v_joined[i]);']
]);

select pg_temp.reemplazar('public.mm_set_config(jsonb)', array[
  ['    season_queue_close_minutes = coalesce((p->>''season_queue_close_minutes'')::int, season_queue_close_minutes),' || E'\n' ||
   '    balance_rating = coalesce((p->>''balance_rating'')::boolean, balance_rating),' || E'\n' ||
   '    balance_rating_weight = coalesce((p->>''balance_rating_weight'')::int, balance_rating_weight),' || E'\n' ||
   '    balance_rating_cap = coalesce((p->>''balance_rating_cap'')::int, balance_rating_cap),' || E'\n' ||
   '    balance_rating_prior_maps = coalesce((p->>''balance_rating_prior_maps'')::int, balance_rating_prior_maps),' || E'\n' ||
   '    balance_rating_days = coalesce((p->>''balance_rating_days'')::int, balance_rating_days)',
   '    season_queue_close_minutes = coalesce((p->>''season_queue_close_minutes'')::int, season_queue_close_minutes)']
]);

drop function public.mm_balance_elos(uuid[], integer[]);
alter table public.mm_lobby_players drop column balance_elo;
alter table public.mm_config
  drop column balance_rating,
  drop column balance_rating_weight,
  drop column balance_rating_cap,
  drop column balance_rating_prior_maps,
  drop column balance_rating_days;

notify pgrst, 'reload schema';
commit;
