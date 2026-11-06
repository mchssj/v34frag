-- 78: la sala en el link de reemplazo, el detalle de la partida como sala y el ELO del abandono
-- (bitácora docs/bitacora/2026-11-06-reemplazo-sala-y-abandono, Daniel 2026-11-06).
--
--   1. mm_config: abandon_win_min/max (1 a 5) y abandon_loss_min/max (6 a 10). abandon_extra_elo deja de usarse.
--   2. mm_elo_delta: el que abandona pierde de 1 a 5 si su equipo ganó; si perdió o empató, de 6 a 10 pero nunca menos
--      que una derrota normal (irse no puede salir más barato que perder). Dentro de cada rango, según la parte de la
--      partida que no jugó. La sanción de espera no cambia.
--   3. mm_replacements.left_round y joined_round: la ronda en que se pidió el reemplazo y en la que entró.
--   4. mm_lobby_json suma replacements (quién reemplaza a quién, rondas y el plazo para conectarse).
--   5. mm_replace_info suma room: la sala sin el servidor ni lo privado de quien mira.
--   6. mm_game_room: la sala de una partida terminada del matchmaking, para el detalle de la partida.
-- Necesita la 75 (reemplazos). Inversa: docs/bitacora/2026-10-14-replanteo-modelo-datos/reversas/78_mm_reemplazo_sala_y_abandono.sql.
begin;

do $$
begin
  if to_regclass('public.mm_replacements') is null then
    raise exception 'replanteo 78: falta la 75 (mm_replacements)';
  end if;
  if exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'mm_config' and column_name = 'abandon_win_min') then
    raise exception 'replanteo 78: ya se aplicó (mm_config.abandon_win_min existe)';
  end if;
end $$;

create or replace function pg_temp.reemplazar(fn regprocedure, cambios text[][]) returns void language plpgsql as $$
declare d text := pg_get_functiondef(fn); i int;
begin
  for i in 1 .. array_length(cambios, 1) loop
    if position(cambios[i][1] in d) = 0 then
      raise exception 'replanteo 78: en % no se encontró: %', fn, left(cambios[i][1], 80);
    end if;
    d := replace(d, cambios[i][1], cambios[i][2]);
  end loop;
  execute d;
end $$;

-- ---------- 1. Los topes del ELO del abandono ----------

alter table public.mm_config
  add column abandon_win_min integer not null default 1 check (abandon_win_min between 0 and 50),
  add column abandon_win_max integer not null default 5 check (abandon_win_max between 0 and 50),
  add column abandon_loss_min integer not null default 6 check (abandon_loss_min between 0 and 50),
  add column abandon_loss_max integer not null default 10 check (abandon_loss_max between 0 and 50),
  add constraint mm_config_abandon_ranges check (abandon_win_min <= abandon_win_max and abandon_loss_min <= abandon_loss_max);
comment on column public.mm_config.abandon_win_min is 'ELO que pierde quien abandona si su equipo ganó: mínimo (se fue cerca del final). Replanteo 78';
comment on column public.mm_config.abandon_win_max is 'ELO que pierde quien abandona si su equipo ganó: máximo (se fue al principio). Replanteo 78';
comment on column public.mm_config.abandon_loss_min is 'ELO que pierde quien abandona si su equipo perdió o empató: mínimo; nunca menos que una derrota normal. Replanteo 78';
comment on column public.mm_config.abandon_loss_max is 'ELO que pierde quien abandona si su equipo perdió o empató: máximo; nunca menos que una derrota normal. Replanteo 78';
comment on column public.mm_config.abandon_extra_elo is 'Sin uso desde el replanteo 78 (antes: el fijo que se sumaba a la derrota completa del que abandonó)';

-- ---------- 2. El ELO del que abandona ----------

select pg_temp.reemplazar('public.mm_elo_delta(uuid,text,integer,double precision,double precision,integer)', array[
  [E'    -- Derrota completa, sin ajuste por participación ni bonus, más el fijo.\n'
   || E'    return least(round(2 * coalesce((select base from elo_config where id = 1), 30) * (0 - p_prob))::int - c.abandon_extra_elo, -1);\n',
   E'    -- (replanteo 78) Pierde poco: la sanción fuerte es la espera. Ganó su equipo: de abandon_win_min a _max. Perdió o\n'
   || E'    -- empató: de abandon_loss_min a _max, pero nunca menos que una derrota normal. f: la parte de la partida que no jugó.\n'
   || E'    select greatest(coalesce(g.score1, 0) + coalesce(g.score2, 0), coalesce(max(rounds), 0)) into v_total\n'
   || E'      from match_player_stats where match_id = p_game and team in (1, 2);\n'
   || E'    select coalesce(max(s.rounds), 0) into v_rounds from match_player_stats s where s.match_id = p_game and elo_key(s.steam_id) = p_key;\n'
   || E'    f := coalesce(least(greatest((v_total - v_rounds) / nullif(v_total, 0), 0), 1), 1);\n'
   || E'    if p_res = 1 then\n'
   || E'      return -(c.abandon_win_min + round((c.abandon_win_max - c.abandon_win_min) * f))::int;\n'
   || E'    end if;\n'
   || E'    return least(round(2 * coalesce((select base from elo_config where id = 1), 30) * (0 - p_prob))::int,\n'
   || E'                 -(c.abandon_loss_min + round((c.abandon_loss_max - c.abandon_loss_min) * f))::int, -1);\n']
]);

-- ---------- 3. Las rondas del reemplazo ----------

alter table public.mm_replacements
  add column left_round integer,
  add column joined_round integer;
comment on column public.mm_replacements.left_round is 'Ronda en que se pidió el reemplazo (el abandono ya confirmado), del mix en vivo del servidor. Replanteo 78';
comment on column public.mm_replacements.joined_round is 'Ronda en que el reemplazo entró al servidor. Replanteo 78';

/** La ronda que se está jugando en el servidor de la sala (null: no hay mix en vivo reciente). */
create function public.mm_replace_round(p_lobby uuid) returns integer
  language sql stable security definer set search_path = public as $$
  select m.score_a + m.score_b + 1
    from live_matches m join mm_lobbies l on l.server_id = m.server_id
   where l.id = p_lobby and m.updated_at > now() - interval '10 minutes'
   order by m.updated_at desc limit 1
$$;
revoke all on function public.mm_replace_round(uuid) from public, anon, authenticated;

select pg_temp.reemplazar('public.mm_replace_open(uuid,smallint,uuid,text)', array[
  [E'    returning id into v_id;\n',
   E'    returning id into v_id;\n  update mm_replacements set left_round = mm_replace_round(p_lobby) where id = v_id;   -- (replanteo 78)\n']
]);

select pg_temp.reemplazar('public.mm_replace_arrived(uuid,uuid)', array[
  ['update mm_replacements set status = ''connected'', connected_at = now()',
   'update mm_replacements set status = ''connected'', connected_at = now(), joined_round = mm_replace_round(p_lobby)']
]);

-- ---------- 4. Los reemplazos en la sala ----------

/** Los reemplazos de una sala: buscando, tomados (con el plazo para conectarse) y los que entraron. */
create function public.mm_lobby_replacements(p_lobby uuid) returns jsonb
  language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(jsonb_build_object(
      'team', x.team, 'status', x.status,
      'replaced_player_id', a.id, 'replaced_nick', a.nick,
      'by_player_id', b.id, 'by_nick', b.nick,
      'left_round', x.left_round, 'joined_round', x.joined_round,
      'connect_deadline', case when x.status = 'taken' then x.connect_deadline end) order by x.created_at), '[]')
    from mm_replacements x
    left join players a on a.user_id = x.replaced_user_id
    left join players b on b.user_id = x.taken_by
   where x.lobby_id = p_lobby and (x.status in ('taken', 'connected') or (x.status = 'open' and x.expires_at > now()))
$$;
revoke all on function public.mm_lobby_replacements(uuid) from public, anon, authenticated;

select pg_temp.reemplazar('public.mm_lobby_json(uuid,uuid)', array[
  ['    ''reported'', (select coalesce(jsonb_agg(p.id), ''[]'')',
   E'    ''replacements'', mm_lobby_replacements(l.id),   -- (replanteo 78)\n    ''reported'', (select coalesce(jsonb_agg(p.id), ''[]'')']
]);

-- ---------- 5. La sala en la página del link ----------

select pg_temp.reemplazar('public.mm_replace_info(text)', array[
  ['    ''reason'', case when v_status = ''open'' then mm_replace_reason(me, x.lobby_id) end);',
   E'    ''reason'', case when v_status = ''open'' then mm_replace_reason(me, x.lobby_id) end,\n'
   || E'    -- (replanteo 78) La sala en vista previa, sin el servidor (la IP y la contraseña, recién al tomarlo) ni lo de quien mira.\n'
   || E'    ''replaced_player_id'', (select id from players where user_id = x.replaced_user_id),\n'
   || E'    ''replaced_nick'', (select nick from players where user_id = x.replaced_user_id),\n'
   || E'    ''left_round'', x.left_round,\n'
   || E'    ''room'', case when v_status = ''open'' then mm_lobby_json(x.lobby_id, me) - ''server'' - ''reported'' - ''commended'' - ''elo_stake'' end);']
]);

-- ---------- 6. La sala de una partida terminada (el detalle de la partida) ----------

/** La sala de una partida del matchmaking terminada (el juego, no la serie), para cualquiera con sesión; null si no es. */
create function public.mm_game_room(p_game uuid) returns jsonb
  language plpgsql stable security definer set search_path = public as $$
declare v_lobby uuid;
begin
  if auth.uid() is null then raise exception 'Tenés que iniciar sesión' using errcode = '42501'; end if;
  select l.id into v_lobby from matches g join mm_lobbies l on l.match_id = g.parent_match_id
   where g.id = p_game and l.status = 'finished';
  if v_lobby is null then return null; end if;
  return mm_lobby_json(v_lobby, auth.uid()) - 'server' - 'reported' - 'commended' - 'elo_stake';
end $$;
revoke all on function public.mm_game_room(uuid) from public, anon;
grant execute on function public.mm_game_room(uuid) to authenticated;

-- ---------- 7. Administración y el manual ----------

select pg_temp.reemplazar('public.mm_set_config(jsonb)', array[
  ['    abandon_extra_elo = coalesce((p->>''abandon_extra_elo'')::int, abandon_extra_elo),',
   E'    abandon_extra_elo = coalesce((p->>''abandon_extra_elo'')::int, abandon_extra_elo),\n'
   || E'    abandon_win_min = coalesce((p->>''abandon_win_min'')::int, abandon_win_min),\n'
   || E'    abandon_win_max = coalesce((p->>''abandon_win_max'')::int, abandon_win_max),\n'
   || E'    abandon_loss_min = coalesce((p->>''abandon_loss_min'')::int, abandon_loss_min),\n'
   || E'    abandon_loss_max = coalesce((p->>''abandon_loss_max'')::int, abandon_loss_max),']
]);

select pg_temp.reemplazar('public.manual_valores()', array[
  ['    ''mm.volver'', m.reconnect_minutes,',
   E'    ''mm.volver'', m.reconnect_minutes,\n'
   || E'    ''mm.abandono_ganado_min'', m.abandon_win_min, ''mm.abandono_ganado_max'', m.abandon_win_max,\n'
   || E'    ''mm.abandono_perdido_min'', m.abandon_loss_min, ''mm.abandono_perdido_max'', m.abandon_loss_max,']
]);

notify pgrst, 'reload schema';

commit;
