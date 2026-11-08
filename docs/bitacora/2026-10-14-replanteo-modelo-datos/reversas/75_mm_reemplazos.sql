-- Inversa del replanteo 75: sin reemplazos en el matchmaking. Deja mm_tick, csstv_mm_report, csstv_mm_poll, mm_elo_delta,
-- mm_player_card, mm_set_config y manual_valores como antes, y borra mm_replacements, sus funciones y los campos nuevos (se pierde quién
-- reemplazó a quién en las salas ya jugadas).
begin;

create or replace function pg_temp.reemplazar(fn regprocedure, cambios text[][]) returns void language plpgsql as $$
declare d text := pg_get_functiondef(fn); i int; a text; b text;
begin
  for i in 1 .. array_length(cambios, 1) loop
    a := replace(cambios[i][1], E'\r', ''); b := replace(cambios[i][2], E'\r', '');
    if position(a in d) = 0 then
      raise exception 'inversa 75: en % no se encontró: %', fn, left(a, 80);
    end if;
    d := replace(d, a, b);
  end loop;
  execute d;
end $$;

select pg_temp.reemplazar('public.mm_tick()', array[
  ['      -- (replanteo 75) Reemplazos: vencen los links, sale el que no entró y se llama por los abandonos nuevos.' || E'\n' ||
   '      perform mm_replace_sweep(l.id);' || E'\n' ||
   '      -- 2 o más abandonos: ese equipo pierde (el plugin lo ve en el poll). En los dos equipos, la partida se anula.' || E'\n' ||
   '      -- (replanteo 75) Un abandono cubierto por un reemplazo que ya entró no cuenta.' || E'\n' ||
   '      select count(*) filter (where team = 1 and abandoned and replaced_by is null), count(*) filter (where team = 2 and abandoned and replaced_by is null) into v_ab1, v_ab2',
   '      -- 2 o más abandonos: ese equipo pierde (el plugin lo ve en el poll). En los dos equipos, la partida se anula.' || E'\n' ||
   '      select count(*) filter (where team = 1 and abandoned), count(*) filter (where team = 2 and abandoned) into v_ab1, v_ab2'],
  ['  -- (replanteo 75) Los pedidos de reemplazo de salas que terminaron vencen.' || E'\n' ||
   '  perform mm_replace_close_finished();' || E'\n',
   '']
]);

select pg_temp.reemplazar('public.csstv_mm_report(text,uuid,text,text)', array[
  ['  v_user uuid;' || E'\n' ||
   '  v_team smallint;',
   '  v_user uuid;'],
  ['  if p_event in (''connected'', ''left'', ''back'', ''callreplace'') then',
   '  if p_event in (''connected'', ''left'', ''back'') then'],
  ['      update mm_lobby_players set connected_at = coalesce(connected_at, now()) where lobby_id = l.id and user_id = v_user;' || E'\n' ||
   '      perform mm_replace_arrived(l.id, v_user);',
   '      update mm_lobby_players set connected_at = coalesce(connected_at, now()) where lobby_id = l.id and user_id = v_user;'],
  ['      -- (replanteo 75) En vivo, un reemplazo que entra llega como "back": también cuenta como conectado.' || E'\n' ||
   '      update mm_lobby_players set left_at = null, connected_at = coalesce(connected_at, now()) where lobby_id = l.id and user_id = v_user and not abandoned;' || E'\n' ||
   '      perform mm_replace_arrived(l.id, v_user);',
   '      update mm_lobby_players set left_at = null where lobby_id = l.id and user_id = v_user and not abandoned;'],
  ['    when ''callreplace'' then' || E'\n' ||
   '      -- (replanteo 75) Pasó el voto de !callreplace: el desconectado abandona ya, sin esperar los minutos de reconexión.' || E'\n' ||
   '      select team into v_team from mm_lobby_players where lobby_id = l.id and user_id = v_user and left_at is not null and not abandoned;' || E'\n' ||
   '      if v_team is null or not mm_replace_can_open(l.id, v_team) then return false; end if;' || E'\n' ||
   '      update mm_lobby_players set abandoned = true, left_at = null where lobby_id = l.id and user_id = v_user;' || E'\n' ||
   '      perform mm_penalize(v_user, ''Abandonaste una partida (tu equipo pidió un reemplazo)'');' || E'\n' ||
   '      perform mm_replace_open(l.id, v_team, v_user, ''vote'');' || E'\n',
   '']
]);

select pg_temp.reemplazar('public.csstv_mm_poll(text,text,text)', array[
  ['where lp.lobby_id = l.id and lp.team = 1 and not mm_replace_out(l.id, lp.user_id)), ''''),',
   'where lp.lobby_id = l.id and lp.team = 1), ''''),'],
  ['where lp.lobby_id = l.id and lp.team = 2 and not mm_replace_out(l.id, lp.user_id)), ''''),',
   'where lp.lobby_id = l.id and lp.team = 2), ''''),'],
  ['    ''n1='' || (select count(*) from mm_lobby_players lp where lobby_id = l.id and team = 1 and not mm_replace_out(l.id, lp.user_id)),' || E'\n' ||
   '    ''n2='' || (select count(*) from mm_lobby_players lp where lobby_id = l.id and team = 2 and not mm_replace_out(l.id, lp.user_id)),',
   '    ''n1='' || (select count(*) from mm_lobby_players where lobby_id = l.id and team = 1),' || E'\n' ||
   '    ''n2='' || (select count(*) from mm_lobby_players where lobby_id = l.id and team = 2),'],
  ['    -- (replanteo 75) Solo los abandonos sin cubrir; si se puede pedir un reemplazo en cada equipo; y los desconectados' || E'\n' ||
   '    -- (SteamID|equipo|nick;…) para el menú de !callreplace.' || E'\n' ||
   '    ''abandons='' || (select count(*) filter (where team = 1 and abandoned and replaced_by is null) || '','' || count(*) filter (where team = 2 and abandoned and replaced_by is null) from mm_lobby_players where lobby_id = l.id),' || E'\n' ||
   '    ''replace='' || case when mm_replace_can_open(l.id, 1::smallint) then 1 else 0 end || '','' || case when mm_replace_can_open(l.id, 2::smallint) then 1 else 0 end,' || E'\n' ||
   '    ''replace_vote='' || (select replace_vote_pct || '','' || replace_vote_seconds || '','' || replace_vote_cooldown_s from mm_config),' || E'\n' ||
   '    ''away='' || coalesce((select string_agg(csstv_steam2(p.steam_id) || ''|'' || lp.team || ''|'' || left(regexp_replace(p.nick, ''[|;=\r\n]'', '''', ''g''), 24), '';'')' || E'\n' ||
   '        from mm_lobby_players lp join players p on p.id = lp.player_id' || E'\n' ||
   '       where lp.lobby_id = l.id and lp.left_at is not null and not lp.abandoned and p.steam_id is not null), ''''),',
   '    ''abandons='' || (select count(*) filter (where team = 1 and abandoned) || '','' || count(*) filter (where team = 2 and abandoned) from mm_lobby_players where lobby_id = l.id),']
]);

select pg_temp.reemplazar('public.mm_elo_delta(uuid,text,integer,double precision,double precision,integer)', array[
  ['    from mm_lobby_players where lobby_id = v_lobby and abandoned and replaced_by is null;   -- (replanteo 75) sin los cubiertos',
   '    from mm_lobby_players where lobby_id = v_lobby and abandoned;'],
  ['   where lp.lobby_id = v_lobby and lp.abandoned and lp.replaced_by is null;',
   '   where lp.lobby_id = v_lobby and lp.abandoned;']
]);

select pg_temp.reemplazar('public.mm_player_card(uuid,uuid,mm_lobby_players)', array[
  ['    ''abandoned'', coalesce((p_lp).abandoned, false),' || E'\n' ||
   '    ''replacement'', (p_lp).replaces_user_id is not null, ''replaced'', (p_lp).replaced_by is not null,',
   '    ''abandoned'', coalesce((p_lp).abandoned, false),']
]);

select pg_temp.reemplazar('public.mm_set_config(jsonb)', array[
  ['    balance_rating_days = coalesce((p->>''balance_rating_days'')::int, balance_rating_days),' || E'\n' ||
   '    replace_enabled = coalesce((p->>''replace_enabled'')::boolean, replace_enabled),' || E'\n' ||
   '    replace_link_minutes = coalesce((p->>''replace_link_minutes'')::int, replace_link_minutes),' || E'\n' ||
   '    replace_min_rounds_left = coalesce((p->>''replace_min_rounds_left'')::int, replace_min_rounds_left),' || E'\n' ||
   '    replace_vote_pct = coalesce((p->>''replace_vote_pct'')::int, replace_vote_pct),' || E'\n' ||
   '    replace_vote_seconds = coalesce((p->>''replace_vote_seconds'')::int, replace_vote_seconds),' || E'\n' ||
   '    replace_vote_cooldown_s = coalesce((p->>''replace_vote_cooldown_s'')::int, replace_vote_cooldown_s)',
   '    balance_rating_days = coalesce((p->>''balance_rating_days'')::int, balance_rating_days)']
]);

select pg_temp.reemplazar('public.manual_valores()', array[
  ['    ''mm.volver'', m.reconnect_minutes,' || E'
' ||
   '    ''mm.reemplazo_link'', m.replace_link_minutes, ''mm.reemplazo_voto'', m.replace_vote_pct, ''mm.reemplazo_rondas'', m.replace_min_rounds_left,',
   '    ''mm.volver'', m.reconnect_minutes,']
]);

drop function public.mm_replace_info(text), public.mm_replace_take(text), public.mm_replace_pending(),
  public.mm_replace_mark(uuid, text, text, boolean), public.mm_replace_reason(uuid, uuid), public.mm_replace_arrived(uuid, uuid),
  public.mm_replace_close_finished(), public.mm_replace_sweep(uuid), public.mm_replace_open(uuid, smallint, uuid, text),
  public.mm_replace_out(uuid, uuid), public.mm_replace_can_open(uuid, smallint), public.mm_replace_rounds_left(uuid),
  public.mm_replace_shown(text), public.mm_replace_hash(text);
drop table public.mm_replacements;
alter table public.mm_lobby_players drop column replaces_user_id, drop column replaced_by;
alter table public.mm_config
  drop column replace_enabled, drop column replace_link_minutes, drop column replace_min_rounds_left,
  drop column replace_vote_pct, drop column replace_vote_seconds, drop column replace_vote_cooldown_s;

notify pgrst, 'reload schema';
commit;
