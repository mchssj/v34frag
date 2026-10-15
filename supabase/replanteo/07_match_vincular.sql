-- Replanteo 07: !match, vincular una partida jugada en el servidor a una partida de torneo o PCW
-- (plan docs/bitacora/2026-10-15-match-y-status).
-- Cada partida de torneo o PCW tiene un código corto (link_code). En el servidor, un inscrito de un equipo
-- propone !match <código> y uno del otro equipo confirma (o un admin solo). El plugin arma los lados con
-- los planteles que devuelve csstv_match_lookup y, al terminar, manda el código y qué equipo jugó en el
-- bando a. El juego se guarda como siempre (mix con stats, demo y ELO) vinculado a la partida, que suma el
-- mapa y termina cuando un equipo gana la serie. Si algo no cuadra, el juego queda como mix común.
-- Además: para inscribirse a un torneo hacen falta 5 jugadores en el plantel, y para publicar o aceptar
-- una PCW, 4 jugadores con cuenta.
-- NO aplicar en producción antes del corte (ver README.md).
begin;

do $$
begin
  if exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'matches' and column_name = 'link_code') then
    raise exception 'replanteo 07: matches.link_code ya existe (¿ya se aplicó?)';
  end if;
  if to_regclass('public.team_members') is null then
    raise exception 'replanteo 07: falta team_members (aplicar antes 05_team_members.sql)';
  end if;
end $$;

-- ---------- 1. columnas ----------
alter table public.matches
  add column link_code       text,
  add column parent_match_id uuid references public.matches(id) on delete set null,
  add column parent_side1    smallint check (parent_side1 in (1, 2));
comment on column public.matches.link_code is 'Torneo/PCW: código para !match en el servidor (5 caracteres, sin 0/O ni 1/I)';
comment on column public.matches.parent_match_id is 'Juego del servidor vinculado con !match: la partida de torneo o PCW a la que pertenece';
comment on column public.matches.parent_side1 is 'Juego vinculado: qué equipo de la partida padre (1 = team1, 2 = team2) jugó en el bando 1';

create unique index matches_link_code on public.matches (link_code) where link_code is not null;
alter table public.matches add constraint matches_link_code_formato
  check (link_code is null or (kind <> 'mix' and link_code ~ '^[A-HJ-NP-Z2-9]{5}$'));
alter table public.matches add constraint matches_juego_vinculado
  check ((parent_match_id is null) = (parent_side1 is null) and (parent_match_id is null or kind = 'mix'));
create index matches_parent on public.matches (parent_match_id) where parent_match_id is not null;

-- ---------- 2. códigos ----------
create function public.csstv_new_link_code() returns text
  language plpgsql volatile set search_path = public as $$
declare abc constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; c text;
begin
  loop
    c := '';
    for i in 1 .. 5 loop c := c || substr(abc, 1 + floor(random() * 32)::int, 1); end loop;
    exit when not exists (select 1 from matches where link_code = c);
  end loop;
  return c;
end $$;

create function public.matches_link_code() returns trigger
  language plpgsql set search_path = public as $$
begin
  if new.kind <> 'mix' and new.link_code is null then new.link_code := csstv_new_link_code(); end if;
  return new;
end $$;
create trigger matches_link_code before insert on public.matches
  for each row execute function public.matches_link_code();

do $$
declare r record;
begin
  for r in select id from public.matches where kind <> 'mix' and link_code is null loop
    update public.matches set link_code = public.csstv_new_link_code() where id = r.id;
  end loop;
end $$;

-- ---------- 3. consulta del plugin (!match y !status) ----------
-- SteamID64 -> STEAM_0:X:Y (null si no es un SteamID64).
create function public.csstv_steam2(p text) returns text
  language sql immutable as $$
  select case when p ~ '^(7656119[0-9]{10}|765612[0-9]{11})$'
              then 'STEAM_0:' || ((p::numeric - 76561197960265728) % 2) || ':' || floor((p::numeric - 76561197960265728) / 2)
         end $$;

-- Devuelve texto, una línea clave=valor por dato: el plugin no tiene lector de JSON (SourceMod 1.8).
-- Los planteles van como SteamID de 32 bits (STEAM_0:X:Y), que el plugin compara sin aritmética de 64 bits.
-- Los errores también van como texto (ok=0, error=<mensaje para el chat>).
create function public.csstv_match_lookup(p_token text, p_code text) returns text
  language plpgsql security definer set search_path = public as $$
declare
  m      record;
  limpio text;
  linea  text := E'\n';
begin
  begin
    perform csstv_auth(p_token);
  exception when others then
    return 'ok=0' || linea || 'error=' || sqlerrm;
  end;
  select x.id, x.kind, x.status, x.best_of, x.score1, x.score2, x.stage, x.link_code, x.team1, x.team2,
         t1.name n1, t2.name n2, e.name torneo
    into m
    from matches x
    left join teams t1 on t1.id = x.team1
    left join teams t2 on t2.id = x.team2
    left join events e on e.id = x.event_id
   where x.link_code = upper(trim(coalesce(p_code, ''))) and x.kind <> 'mix';
  if not found then
    return 'ok=0' || linea || 'error=No hay ninguna partida con ese código';
  end if;
  if m.status not in ('upcoming', 'live') then
    return 'ok=0' || linea || 'error=Esa partida ya terminó o fue cancelada';
  end if;
  if m.n1 is null or m.n2 is null then
    return 'ok=0' || linea || 'error=La partida todavía no tiene los dos equipos';
  end if;
  return concat_ws(linea,
    'ok=1',
    'kind=' || m.kind,
    'title=' || translate(
       case when m.kind = 'pcw' then 'PCW: ' || m.n1 || ' vs ' || m.n2
            else coalesce(m.torneo || ' · ', '') || coalesce(nullif(m.stage, '') || ': ', '') || m.n1 || ' vs ' || m.n2 end,
       E'\r\n', '  '),
    'best_of=' || coalesce(m.best_of, 1),
    'score1=' || coalesce(m.score1, 0),
    'score2=' || coalesce(m.score2, 0),
    'team1=' || translate(m.n1, E'\r\n', '  '),
    'team2=' || translate(m.n2, E'\r\n', '  '),
    't1=' || coalesce((select string_agg(public.csstv_steam2(p.steam_id), ',' order by p.steam_id) from team_members tm join players p on p.id = tm.player_id
                        where tm.team_id = m.team1 and tm.left_at is null and p.steam_id is not null), ''),
    't2=' || coalesce((select string_agg(public.csstv_steam2(p.steam_id), ',' order by p.steam_id) from team_members tm join players p on p.id = tm.player_id
                        where tm.team_id = m.team2 and tm.left_at is null and p.steam_id is not null), ''),
    'max_standins=' || case when m.kind = 'pcw' then 2 else 0 end,
    'min_roster=' || case when m.kind = 'pcw' then 3 else 5 end,
    'code=' || m.link_code);
end $$;
revoke all on function public.csstv_match_lookup(text, text) from public;
grant execute on function public.csstv_match_lookup(text, text) to anon, authenticated, service_role;

-- ---------- 4. vincular un juego terminado a su partida ----------
-- p_side_a: qué equipo de la partida jugó en el bando a (1 o 2), según el plugin. Se verifica contra los
-- planteles; si viene null (plugin viejo) se deduce por mayoría.
create function public.csstv_link_game(p_game uuid, p_code text, p_side_a int) returns boolean
  language plpgsql security definer set search_path = public as $$
declare
  g       matches%rowtype;
  par     matches%rowtype;
  ta      uuid;  tb uuid;        -- equipo de la partida en el bando a / b según el plugin
  a_ok    int;   a_mal int;      -- jugadores del bando a inscritos en ta / en tb
  b_ok    int;   b_mal int;
  a_tot   int;   b_tot int;      -- jugadores del bando a / b con rondas en el juego
  lado1   smallint;
  r1      int;   r2 int;
  nuevos  jsonb;
  w1      int;   w2 int;
  hace    int;
begin
  select * into g from matches where id = p_game and kind = 'mix' and status = 'finished' and parent_match_id is null;
  if not found then return false; end if;
  select * into par from matches
   where link_code = upper(trim(coalesce(p_code, ''))) and kind <> 'mix' and status in ('upcoming', 'live')
     and team1 is not null and team2 is not null
   for update;
  if not found then
    raise notice 'csstv_link_game: no hay partida abierta con el código %', p_code;
    return false;
  end if;

  -- Sin lado declarado (plugin anterior a 2.0.0): se deduce por mayoría de inscritos.
  if p_side_a is null then
    select case when count(*) filter (where (s.team = 1 and tm.team_id = par.team1) or (s.team = 2 and tm.team_id = par.team2))
                   > count(*) filter (where (s.team = 1 and tm.team_id = par.team2) or (s.team = 2 and tm.team_id = par.team1))
                then 1 else 2 end
      into p_side_a
      from match_player_stats s join team_members tm on tm.player_id = s.player_id and tm.left_at is null
     where s.match_id = g.id and tm.team_id in (par.team1, par.team2);
  end if;
  ta := case p_side_a when 1 then par.team1 else par.team2 end;
  tb := case p_side_a when 1 then par.team2 else par.team1 end;

  -- Jugadores del juego (los que tienen rondas) y a qué plantel pertenecen.
  select count(*) filter (where s.team = 1),
         count(*) filter (where s.team = 1 and exists (select 1 from team_members tm where tm.team_id = ta and tm.player_id = s.player_id and tm.left_at is null)),
         count(*) filter (where s.team = 1 and exists (select 1 from team_members tm where tm.team_id = tb and tm.player_id = s.player_id and tm.left_at is null)),
         count(*) filter (where s.team = 2),
         count(*) filter (where s.team = 2 and exists (select 1 from team_members tm where tm.team_id = tb and tm.player_id = s.player_id and tm.left_at is null)),
         count(*) filter (where s.team = 2 and exists (select 1 from team_members tm where tm.team_id = ta and tm.player_id = s.player_id and tm.left_at is null))
    into a_tot, a_ok, a_mal, b_tot, b_ok, b_mal
    from match_player_stats s
   where s.match_id = g.id and s.rounds > 0;

  -- El lado declarado tiene que cuadrar con los planteles.
  if a_ok = 0 or b_ok = 0 or a_ok + b_ok <= a_mal + b_mal then
    raise notice 'csstv_link_game: los bandos no coinciden con los planteles (a %/% b %/%); queda como mix', a_ok, a_mal, b_ok, b_mal;
    return false;
  end if;
  -- Regla del tipo de partida: torneo sin stand-ins; PCW con al menos 3 inscritos por bando.
  if par.kind = 'pcw' and (a_ok < 3 or b_ok < 3) then
    raise notice 'csstv_link_game: PCW con menos de 3 inscritos en un bando (% y %); queda como mix', a_ok, b_ok;
    return false;
  end if;
  if par.kind <> 'pcw' and (a_ok < a_tot or b_ok < b_tot) then
    raise notice 'csstv_link_game: torneo con jugadores que no son del plantel (a %/% b %/%); queda como mix', a_ok, a_tot, b_ok, b_tot;
    return false;
  end if;

  lado1 := p_side_a;
  r1 := case lado1 when 1 then g.score1 else g.score2 end;
  r2 := case lado1 when 1 then g.score2 else g.score1 end;
  -- Vinculado: los bandos llevan el nombre de cada equipo (no "Equipo <nick>").
  update matches set parent_match_id = par.id, parent_side1 = lado1,
    side1_name = coalesce((select name from teams where id = ta), side1_name),
    side2_name = coalesce((select name from teams where id = tb), side2_name)
  where id = g.id;

  -- La partida suma el mapa y el marcador en mapas ganados (como autoapply_pcw).
  nuevos := coalesce(par.maps, '[]'::jsonb) || jsonb_build_array(jsonb_build_object('map', g.map, 'r1', r1, 'r2', r2, 'game_id', g.id));
  select count(*) filter (where (e->>'r1')::int > (e->>'r2')::int), count(*) filter (where (e->>'r2')::int > (e->>'r1')::int)
    into w1, w2 from jsonb_array_elements(nuevos) e;
  hace := coalesce(par.best_of, 1) / 2 + 1;   -- mapas para ganar la serie
  update matches set
    maps = nuevos, score1 = w1, score2 = w2,
    map = (select string_agg(coalesce(nullif(x->>'map', ''), '?'), ', ') from jsonb_array_elements(nuevos) x),
    server_id = g.server_id, played_at = g.played_at,
    status = case when w1 >= hace or w2 >= hace then 'finished' else 'live' end,
    winner = case when w1 >= hace then par.team1 when w2 >= hace then par.team2 end
  where id = par.id;
  return true;
end $$;
revoke all on function public.csstv_link_game(uuid, text, int) from public, anon, authenticated;

-- ---------- 5. reglas de inscripción ----------
-- Torneo: el equipo necesita al menos 5 jugadores activos en su plantel.
create function public.tournament_registrations_plantel() returns trigger
  language plpgsql set search_path = public as $$
begin
  if (select count(*) from team_members where team_id = new.team_id and left_at is null) < 5 then
    raise exception 'Para inscribirse a un torneo el equipo necesita al menos 5 jugadores en su plantel';
  end if;
  return new;
end $$;
create trigger tournament_registrations_plantel before insert on public.tournament_registrations
  for each row execute function public.tournament_registrations_plantel();

-- ---------- 6. funciones existentes ----------
create function pg_temp.reemplazar(fn regprocedure, cambios text[][]) returns void language plpgsql as $$
declare d text := pg_get_functiondef(fn); i int;
begin
  for i in 1 .. array_length(cambios, 1) loop
    if position(cambios[i][1] in d) = 0 then
      raise exception 'replanteo 07: en % no se encontró: %', fn, left(cambios[i][1], 80);
    end if;
    d := replace(d, cambios[i][1], cambios[i][2]);
  end loop;
  execute d;
end $$;

-- La ingesta vincula si el plugin mandó un código (y el lado del bando a).
select pg_temp.reemplazar('public.csstv_ingest(uuid, jsonb)', array[
  [E'  -- Las stats de cada jugador salen de la vista player_stats (replanteo 06): no hay nada que recalcular.\n',
   E'  -- Las stats de cada jugador salen de la vista player_stats (replanteo 06): no hay nada que recalcular.\n  -- (replanteo 07) !match: si el plugin mandó un código, el juego se vincula a esa partida de torneo o PCW.\n  if v_status = ''finished'' and nullif(trim(p->>''link_code''), '''') is not null then\n    perform csstv_link_game(v_id, p->>''link_code'', case when p->>''link_side_a'' in (''1'', ''2'') then (p->>''link_side_a'')::int end);\n  end if;\n']
]);

-- PCW: al menos 4 jugadores con cuenta para publicar o aceptar (en el servidor pueden jugar stand-ins).
select pg_temp.reemplazar('public.pcw_make_side(text, uuid[], text[])', array[
  ['if n < 1 or n > 7 then raise exception ''El roster tiene que tener entre 1 y 7 jugadores''; end if;',
   E'if n < 1 or n > 7 then raise exception ''El roster tiene que tener entre 1 y 7 jugadores''; end if;\n  -- (replanteo 07) mínimo de jugadores con cuenta para una PCW\n  if coalesce(array_length(p_players, 1), 0) < 4 then raise exception ''El roster tiene que tener al menos 4 jugadores con cuenta en la web''; end if;']
]);

commit;
