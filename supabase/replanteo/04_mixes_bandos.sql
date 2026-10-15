-- Replanteo 04: los mixes guardan sus bandos en la partida y dejan de crear equipos; winner_side
-- (1, 2 o null = empate) pasa a ser la forma única de saber quién ganó (plan, sección 2.1).
-- El ELO y las victorias/derrotas NO cambian: lo verifica pruebas/ensayo_elo.sh con datos reales.
-- NO aplicar en producción antes del corte (ver README.md).
begin;

-- ---------- estado esperado ----------
do $$
begin
  if exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'matches' and column_name = 'winner_side') then
    raise exception 'replanteo 04: matches.winner_side ya existe (¿ya se aplicó?)';
  end if;
  -- El ganador siempre es uno de los dos equipos de la partida.
  if exists (select 1 from public.matches where winner is not null and winner is distinct from team1 and winner is distinct from team2) then
    raise exception 'replanteo 04: hay partidas cuyo winner no es team1 ni team2';
  end if;
  -- Todo mix tiene sus dos equipos y son de tipo mix.
  if exists (select 1 from public.matches m where m.kind = 'mix' and not exists (
               select 1 from public.teams t1, public.teams t2
                where t1.id = m.team1 and t2.id = m.team2 and t1.kind = 'mix' and t2.kind = 'mix')) then
    raise exception 'replanteo 04: hay un mix sin sus dos equipos mix';
  end if;
  -- Ningún equipo mix se usa fuera de su partida (si no, borrarlo arrastraría otras filas por cascada).
  if exists (select 1 from public.teams t where t.kind = 'mix' and (
               exists (select 1 from public.matches m where (m.team1 = t.id or m.team2 = t.id) and m.kind <> 'mix')
            or exists (select 1 from public.pcw_posts x where x.team_id = t.id)
            or exists (select 1 from public.tournament_registrations x where x.team_id = t.id)
            or exists (select 1 from public.match_vetos x where x.team_id = t.id)
            or exists (select 1 from public.result_reports x where x.team_id = t.id)
            or exists (select 1 from public.events x where x.champion = t.id))) then
    raise exception 'replanteo 04: un equipo mix se usa fuera de su mix';
  end if;
  -- Los planteles de los mixes van a lineup1/lineup2: tienen que estar vacíos.
  if exists (select 1 from public.matches where kind = 'mix' and (cardinality(lineup1) > 0 or cardinality(lineup2) > 0)) then
    raise exception 'replanteo 04: hay mixes con lineup1/lineup2 cargados';
  end if;
end $$;

-- Conteos para verificar al final que no se perdió nada.
create temp table replanteo04_conteo on commit drop as
  select (select count(*) from public.matches) partidas, (select count(*) from public.match_player_stats) stats;

-- ---------- 1. columnas ----------
alter table public.matches
  add column side1_name   text,
  add column side2_name   text,
  add column side1_guests text[] not null default '{}',
  add column side2_guests text[] not null default '{}',
  add column winner_side  smallint check (winner_side in (1, 2));
comment on column public.matches.winner_side is 'Bando ganador: 1 (team1 / bando 1), 2 (team2 / bando 2) o null (empate o sin resultado)';
comment on column public.matches.side1_name is 'Mixes: nombre del bando 1 (los mixes no tienen equipos)';
comment on column public.matches.side1_guests is 'Mixes: nicks del bando 1 sin jugador vinculado (los vinculados van en lineup1)';

-- ---------- 2. winner_side de todas las partidas ----------
update public.matches set winner_side = case when winner = team1 then 1 when winner = team2 then 2 end
 where winner is not null;

-- En partidas con equipos (PCW, torneos) winner_side se mantiene solo a partir de winner.
create function public.matches_winner_side() returns trigger
  language plpgsql set search_path = public as $$
begin
  if new.kind <> 'mix' then
    new.winner_side := case when new.winner is null then null
                            when new.winner = new.team1 then 1
                            when new.winner = new.team2 then 2 end;
  end if;
  return new;
end $$;
create trigger matches_winner_side before insert or update of winner, team1, team2, kind on public.matches
  for each row execute function public.matches_winner_side();

-- ---------- 3. bandos de los mixes, copiados de sus equipos ----------
update public.matches m
   set side1_name = t1.name, side2_name = t2.name,
       lineup1 = t1.members, lineup2 = t2.members,
       side1_guests = t1.guests, side2_guests = t2.guests
  from public.teams t1, public.teams t2
 where m.kind = 'mix' and t1.id = m.team1 and t2.id = m.team2;

-- ---------- 4. funciones ----------
-- Cambia solo fragmentos puntuales de la definición actual; si alguno no está tal cual, aborta.
create function pg_temp.reemplazar(fn regprocedure, cambios text[][]) returns void language plpgsql as $$
declare d text := pg_get_functiondef(fn); i int;
begin
  for i in 1 .. array_length(cambios, 1) loop
    if position(cambios[i][1] in d) = 0 then
      raise exception 'replanteo 04: en % no se encontró: %', fn, left(cambios[i][1], 80);
    end if;
    d := replace(d, cambios[i][1], cambios[i][2]);
  end loop;
  execute d;
end $$;

-- ELO: el resultado sale de winner_side (la fórmula no cambia).
select pg_temp.reemplazar('public.elo_apply_match(uuid)', array[
  ['select id, kind, status, team1, team2, winner, score1, score2 into m',
   'select id, kind, status, winner_side, score1, score2 into m'],
  ['res1 := case when m.winner is null then 0.5 when m.winner = m.team1 then 1 else 0 end;',
   'res1 := case m.winner_side when 1 then 1 when 2 then 0 else 0.5 end;']
]);

-- Victorias y derrotas: el bando del jugador contra winner_side.
select pg_temp.reemplazar('public.recompute_player_stats(uuid)', array[
  ['count(*) filter (where m.winner is not null and m.winner =  case s.team when 1 then m.team1 else m.team2 end) as w,',
   'count(*) filter (where m.winner_side = s.team) as w,'],
  ['count(*) filter (where m.winner is not null and m.winner <> case s.team when 1 then m.team1 else m.team2 end) as l',
   'count(*) filter (where m.winner_side is not null and m.winner_side <> s.team) as l']
]);

-- Ingesta del plugin: el mix guarda sus bandos y no crea equipos.
select pg_temp.reemplazar('public.csstv_ingest(uuid, jsonb)', array[
  [E'  insert into teams(name, tag, members, guests, kind)\n  values (coalesce(''Equipo '' || v_name_a, ''Mix de '' || coalesce(top_a, ''A'')), ''MIX'', array(select distinct unnest(mem_a)), g_a, ''mix'')\n  returning id into v_ta;\n  insert into teams(name, tag, members, guests, kind)\n  values (coalesce(''Equipo '' || v_name_b, ''Mix de '' || coalesce(top_b, ''B'')), ''MIX'', array(select distinct unnest(mem_b)), g_b, ''mix'')\n  returning id into v_tb;\n',
   E'  -- Los mixes no crean equipos: los bandos van en la partida (replanteo 04).\n'],
  ['insert into matches(team1, team2, score1, score2, map, maps, status, best_of, kind, winner,',
   'insert into matches(side1_name, side2_name, lineup1, lineup2, side1_guests, side2_guests, score1, score2, map, maps, status, best_of, kind, winner_side,'],
  [E'values (v_ta, v_tb, v_a, v_b, nullif(v_map, ''''),',
   E'values (coalesce(''Equipo '' || v_name_a, ''Mix de '' || coalesce(top_a, ''A'')), coalesce(''Equipo '' || v_name_b, ''Mix de '' || coalesce(top_b, ''B'')),\n          array(select distinct unnest(mem_a)), array(select distinct unnest(mem_b)), g_a, g_b,\n          v_a, v_b, nullif(v_map, ''''),'],
  ['case when v_status = ''finished'' then case when v_a > v_b then v_ta when v_b > v_a then v_tb end end,',
   'case when v_status = ''finished'' then case when v_a > v_b then 1 when v_b > v_a then 2 end end,']
]);

-- Vincular o desvincular un SteamID mueve al jugador entre lineup y invitados del bando de cada mix.
select pg_temp.reemplazar('public.link_steam_id(text, uuid)', array[
  [E'    update teams t\n       set members = array_remove(t.members, cur),\n           guests  = case when s.nick = any(t.guests) then t.guests else array_append(t.guests, s.nick) end\n      from match_player_stats s join matches m on m.id = s.match_id\n     where s.steam_id = s64 and t.kind = ''mix'' and t.id = case s.team when 1 then m.team1 else m.team2 end;',
   E'    update matches m\n       set lineup1      = case when s.team = 1 then array_remove(m.lineup1, cur) else m.lineup1 end,\n           lineup2      = case when s.team = 2 then array_remove(m.lineup2, cur) else m.lineup2 end,\n           side1_guests = case when s.team = 1 and not (s.nick = any(m.side1_guests)) then array_append(m.side1_guests, s.nick) else m.side1_guests end,\n           side2_guests = case when s.team = 2 and not (s.nick = any(m.side2_guests)) then array_append(m.side2_guests, s.nick) else m.side2_guests end\n      from match_player_stats s\n     where s.steam_id = s64 and s.match_id = m.id and m.kind = ''mix'';'],
  [E'  update teams t\n     set members = case when p_player = any(t.members) then t.members else array_append(t.members, p_player) end,\n         guests  = array_remove(t.guests, s.nick)\n    from match_player_stats s join matches m on m.id = s.match_id\n   where s.steam_id = s64 and t.kind = ''mix'' and t.id = case s.team when 1 then m.team1 else m.team2 end;',
   E'  update matches m\n     set lineup1      = case when s.team = 1 and not (p_player = any(m.lineup1)) then array_append(m.lineup1, p_player) else m.lineup1 end,\n         lineup2      = case when s.team = 2 and not (p_player = any(m.lineup2)) then array_append(m.lineup2, p_player) else m.lineup2 end,\n         side1_guests = case when s.team = 1 then array_remove(m.side1_guests, s.nick) else m.side1_guests end,\n         side2_guests = case when s.team = 2 then array_remove(m.side2_guests, s.nick) else m.side2_guests end\n    from match_player_stats s\n   where s.steam_id = s64 and s.match_id = m.id and m.kind = ''mix'';']
]);

-- ---------- 5. desvincular los mixes de sus equipos y borrar los equipos mix ----------
update public.matches set team1 = null, team2 = null, winner = null where kind = 'mix';

do $$
begin
  if exists (select 1 from public.matches m join public.teams t on t.id in (m.team1, m.team2) where t.kind = 'mix') then
    raise exception 'replanteo 04: todavía hay partidas apuntando a equipos mix';
  end if;
end $$;
delete from public.teams where kind = 'mix';

do $$
declare c record;
begin
  select * into c from replanteo04_conteo;
  if (select count(*) from public.matches) <> c.partidas or (select count(*) from public.match_player_stats) <> c.stats then
    raise exception 'replanteo 04: se perdieron partidas o stats al borrar los equipos mix';
  end if;
  if exists (select 1 from public.matches where kind = 'mix' and (side1_name is null or side2_name is null)) then
    raise exception 'replanteo 04: quedó un mix sin nombre de bando';
  end if;
end $$;

-- ---------- 6. reglas ----------
alter table public.matches add constraint matches_mix_sin_equipos
  check (kind <> 'mix' or (team1 is null and team2 is null and winner is null));
alter table public.teams drop constraint teams_kind_check;
alter table public.teams add constraint teams_kind_check check (kind in ('official', 'pcw'));

commit;
