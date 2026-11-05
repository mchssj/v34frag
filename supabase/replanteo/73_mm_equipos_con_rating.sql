-- Replanteo 73: equipos del matchmaking más parejos con el rating (plan docs/bitacora/2026-11-04-mm-equipos-con-rating,
-- pedido por Daniel el 2026-11-04).
--   1. mm_config: balance_rating (apagado por defecto) y sus cuatro valores: peso, tope, mapas previos y días.
--   2. mm_balance_elos(fichas, elos): el ELO de armado de cada uno = ELO + peso × (rating corregido − 1,00), con tope.
--      El rating corregido acerca a 1,00 a los que tienen pocos mapas: (mapas × rating + previos) / (mapas + previos).
--      Sin rating en esos días, el ajuste es 0. Con balance_rating apagado devuelve null.
--   3. mm_try_build reparte los equipos (mm_best_split) con el ELO de armado. Quién entra a la sala (la ventana de ELO), el
--      capitán, quién banea primero, la probabilidad de ganar y el ELO que se gana o pierde siguen con el ELO.
--   4. mm_lobby_players.balance_elo: el ELO de armado con que se repartió (null con el interruptor apagado).
--   5. mm_set_config acepta los campos nuevos. mm_admin_config ya los devuelve (to_jsonb de la fila).
begin;

do $$
begin
  if to_regprocedure('public.mm_try_build_now(text)') is null then
    raise exception 'replanteo 73: falta el replanteo 64 (aplicar antes 64_mm_pasos_en_el_acto.sql)';
  end if;
  if to_regprocedure('public.mm_balance_elos(uuid[], integer[])') is not null then
    raise exception 'replanteo 73: mm_balance_elos ya existe (¿ya se aplicó?)';
  end if;
end $$;

create or replace function pg_temp.reemplazar(fn regprocedure, cambios text[][]) returns void language plpgsql as $$
declare d text := pg_get_functiondef(fn); i int; a text; b text;
begin
  for i in 1 .. array_length(cambios, 1) loop
    -- Sin \r: con el archivo en CRLF (autocrlf), los textos de varias líneas no coincidirían con la función.
    a := replace(cambios[i][1], E'\r', ''); b := replace(cambios[i][2], E'\r', '');
    if position(a in d) = 0 then
      raise exception 'replanteo 73: en % no se encontró: %', fn, left(a, 80);
    end if;
    d := replace(d, a, b);
  end loop;
  execute d;
end $$;

-- ---------- 1. Configuración ----------

alter table public.mm_config
  add column balance_rating boolean not null default false,
  add column balance_rating_weight integer not null default 200 check (balance_rating_weight between 0 and 1000),
  add column balance_rating_cap integer not null default 100 check (balance_rating_cap between 0 and 500),
  add column balance_rating_prior_maps integer not null default 5 check (balance_rating_prior_maps between 0 and 100),
  add column balance_rating_days integer not null default 60 check (balance_rating_days between 1 and 365);
comment on column public.mm_config.balance_rating is 'Repartir los equipos con el ELO de armado (ELO + ajuste por rating). Apagado: solo el ELO. Replanteo 73';
comment on column public.mm_config.balance_rating_weight is 'Puntos de ELO de armado por cada 1,00 de rating sobre o bajo 1,00. Replanteo 73';
comment on column public.mm_config.balance_rating_cap is 'Máximo que el rating sube o baja el ELO de armado. Replanteo 73';
comment on column public.mm_config.balance_rating_prior_maps is 'Mapas con rating 1,00 que se suman para corregir el rating de los que jugaron poco. Replanteo 73';
comment on column public.mm_config.balance_rating_days is 'Días de partidas 5v5 que se miran para el rating (player_recent_rating). Replanteo 73';

alter table public.mm_lobby_players add column balance_elo integer;
comment on column public.mm_lobby_players.balance_elo is 'ELO de armado con que se repartieron los equipos (null: solo con el ELO). Replanteo 73';

-- ---------- 2. ELO de armado ----------

create function public.mm_balance_elos(p_players uuid[], p_elos integer[]) returns integer[]
  language sql stable security definer set search_path = public as $$
  select case when not c.balance_rating then null else array(
    select e.elo + case
             when r.rating is null or r.maps + c.balance_rating_prior_maps = 0 then 0
             else greatest(-c.balance_rating_cap, least(c.balance_rating_cap, round(c.balance_rating_weight *
                    ((r.maps * r.rating + c.balance_rating_prior_maps) / (r.maps + c.balance_rating_prior_maps) - 1))))::int
           end
      from unnest(p_players, p_elos) with ordinality e(player_id, elo, o)
      left join player_recent_rating(p_players, c.balance_rating_days) r on r.player_id = e.player_id
     order by e.o) end
    from mm_config c
$$;
revoke all on function public.mm_balance_elos(uuid[], integer[]) from public, anon, authenticated;
comment on function public.mm_balance_elos(uuid[], integer[]) is
  'ELO de armado de cada ficha, en el mismo orden: ELO + peso × (rating corregido − 1,00), con tope. Null con balance_rating apagado. Replanteo 73';

-- ---------- 3. El armado de la sala ----------

select pg_temp.reemplazar('public.mm_try_build(text)', array[
  ['  v_window int;',
   '  v_window int;' || E'\n' ||
   '  v_bal int[];'],
  ['    teams := mm_best_split(v_users, v_elos, v_parties, v_size);',
   '    -- (replanteo 73) Con balance_rating, los equipos se reparten con el ELO de armado (null si está apagado).' || E'\n' ||
   '    v_bal := mm_balance_elos(v_players, v_elos);' || E'\n' ||
   '    teams := mm_best_split(v_users, coalesce(v_bal, v_elos), v_parties, v_size);'],
  ['      insert into mm_lobby_players (lobby_id, user_id, player_id, party_id, region, team, elo, joined_at)' || E'\n' ||
   '        values (v_lobby, v_users[i], v_players[i], v_parties[i], v_regions[i], teams[i], v_elos[i], v_joined[i]);',
   '      insert into mm_lobby_players (lobby_id, user_id, player_id, party_id, region, team, elo, joined_at, balance_elo)' || E'\n' ||
   '        values (v_lobby, v_users[i], v_players[i], v_parties[i], v_regions[i], teams[i], v_elos[i], v_joined[i], v_bal[i]);']
]);

-- ---------- 4. Guardar la configuración ----------

select pg_temp.reemplazar('public.mm_set_config(jsonb)', array[
  ['    season_queue_close_minutes = coalesce((p->>''season_queue_close_minutes'')::int, season_queue_close_minutes)',
   '    season_queue_close_minutes = coalesce((p->>''season_queue_close_minutes'')::int, season_queue_close_minutes),' || E'\n' ||
   '    balance_rating = coalesce((p->>''balance_rating'')::boolean, balance_rating),' || E'\n' ||
   '    balance_rating_weight = coalesce((p->>''balance_rating_weight'')::int, balance_rating_weight),' || E'\n' ||
   '    balance_rating_cap = coalesce((p->>''balance_rating_cap'')::int, balance_rating_cap),' || E'\n' ||
   '    balance_rating_prior_maps = coalesce((p->>''balance_rating_prior_maps'')::int, balance_rating_prior_maps),' || E'\n' ||
   '    balance_rating_days = coalesce((p->>''balance_rating_days'')::int, balance_rating_days)']
]);

notify pgrst, 'reload schema';
commit;
