-- Inversa de supabase/replanteo/04_mixes_bandos.sql.
-- Vuelve a crear un equipo 'mix' por bando, apunta cada mix a sus equipos y restaura las funciones.
-- Los reemplazos de funciones son los de la migración invertidos (generados desde ella).
-- Los ids de los equipos recreados son nuevos, y los 8 equipos mix huérfanos (sin partida) que borró la
-- migración no vuelven: están en el respaldo previo al corte.
begin;

alter table public.teams drop constraint teams_kind_check;
alter table public.teams add constraint teams_kind_check check ((kind = any (array['official'::text, 'pcw'::text, 'mix'::text]))) not valid;
alter table public.matches drop constraint matches_mix_sin_equipos;

-- Un equipo mix por bando, como los creaba la ingesta.
do $$
declare m record; t1 uuid; t2 uuid;
begin
  for m in select * from public.matches where kind = 'mix' loop
    insert into public.teams(name, tag, members, guests, kind) values (m.side1_name, 'MIX', m.lineup1, m.side1_guests, 'mix') returning id into t1;
    insert into public.teams(name, tag, members, guests, kind) values (m.side2_name, 'MIX', m.lineup2, m.side2_guests, 'mix') returning id into t2;
    update public.matches
       set team1 = t1, team2 = t2,
           winner = case m.winner_side when 1 then t1 when 2 then t2 end,
           lineup1 = '{}', lineup2 = '{}'
     where id = m.id;
  end loop;
end $$;

create function pg_temp.reemplazar(fn regprocedure, cambios text[][]) returns void language plpgsql as $f$
declare d text := pg_get_functiondef(fn); i int;
begin
  for i in 1 .. array_length(cambios, 1) loop
    if position(cambios[i][1] in d) = 0 then
      raise exception 'inversa 04: en % no se encontró: %', fn, left(cambios[i][1], 80);
    end if;
    d := replace(d, cambios[i][1], cambios[i][2]);
  end loop;
  execute d;
end $f$;

select pg_temp.reemplazar('public.elo_apply_match(uuid)', array[
  ['select id, kind, status, winner_side, score1, score2 into m',
   'select id, kind, status, team1, team2, winner, score1, score2 into m'],
  ['res1 := case m.winner_side when 1 then 1 when 2 then 0 else 0.5 end;',
   'res1 := case when m.winner is null then 0.5 when m.winner = m.team1 then 1 else 0 end;']
]);

do $$ begin
  if to_regprocedure('public.elo_crash_apply(uuid)') is not null then
    perform pg_temp.reemplazar('public.elo_crash_apply(uuid)', array[
      ['select id, kind, status, cancel_reason, score1, score2 into m',
       'select id, kind, status, cancel_reason, team1, team2, score1, score2 into m'],
      ['winner_side = case when score1 > score2 then 1 else 2 end',
       'winner = case when score1 > score2 then team1 else team2 end']
    ]);
  end if;
end $$;

select pg_temp.reemplazar('public.recompute_player_stats(uuid)', array[
  ['count(*) filter (where m.winner_side = s.team) as w,',
   'count(*) filter (where m.winner is not null and m.winner =  case s.team when 1 then m.team1 else m.team2 end) as w,'],
  ['count(*) filter (where m.winner_side is not null and m.winner_side <> s.team) as l',
   'count(*) filter (where m.winner is not null and m.winner <> case s.team when 1 then m.team1 else m.team2 end) as l']
]);

select pg_temp.reemplazar('public.csstv_ingest(uuid, jsonb)', array[
  [E'  -- Los mixes no crean equipos: los bandos van en la partida (replanteo 04).\n',
   E'  insert into teams(name, tag, members, guests, kind)\n  values (coalesce(''Equipo '' || v_name_a, ''Mix de '' || coalesce(top_a, ''A'')), ''MIX'', array(select distinct unnest(mem_a)), g_a, ''mix'')\n  returning id into v_ta;\n  insert into teams(name, tag, members, guests, kind)\n  values (coalesce(''Equipo '' || v_name_b, ''Mix de '' || coalesce(top_b, ''B'')), ''MIX'', array(select distinct unnest(mem_b)), g_b, ''mix'')\n  returning id into v_tb;\n'],
  ['insert into matches(side1_name, side2_name, lineup1, lineup2, side1_guests, side2_guests, score1, score2, map, maps, status, best_of, kind, winner_side,',
   'insert into matches(team1, team2, score1, score2, map, maps, status, best_of, kind, winner,'],
  [E'values (coalesce(''Equipo '' || v_name_a, ''Mix de '' || coalesce(top_a, ''A'')), coalesce(''Equipo '' || v_name_b, ''Mix de '' || coalesce(top_b, ''B'')),\n          array(select distinct unnest(mem_a)), array(select distinct unnest(mem_b)), g_a, g_b,\n          v_a, v_b, nullif(v_map, ''''),',
   E'values (v_ta, v_tb, v_a, v_b, nullif(v_map, ''''),'],
  ['case when v_status = ''finished'' then case when v_a > v_b then 1 when v_b > v_a then 2 end end,',
   'case when v_status = ''finished'' then case when v_a > v_b then v_ta when v_b > v_a then v_tb end end,']
]);

select pg_temp.reemplazar('public.link_steam_id(text, uuid)', array[
  [E'    update matches m\n       set lineup1      = case when s.team = 1 then array_remove(m.lineup1, cur) else m.lineup1 end,\n           lineup2      = case when s.team = 2 then array_remove(m.lineup2, cur) else m.lineup2 end,\n           side1_guests = case when s.team = 1 and not (s.nick = any(m.side1_guests)) then array_append(m.side1_guests, s.nick) else m.side1_guests end,\n           side2_guests = case when s.team = 2 and not (s.nick = any(m.side2_guests)) then array_append(m.side2_guests, s.nick) else m.side2_guests end\n      from match_player_stats s\n     where s.steam_id = s64 and s.match_id = m.id and m.kind = ''mix'';',
   E'    update teams t\n       set members = array_remove(t.members, cur),\n           guests  = case when s.nick = any(t.guests) then t.guests else array_append(t.guests, s.nick) end\n      from match_player_stats s join matches m on m.id = s.match_id\n     where s.steam_id = s64 and t.kind = ''mix'' and t.id = case s.team when 1 then m.team1 else m.team2 end;'],
  [E'  update matches m\n     set lineup1      = case when s.team = 1 and not (p_player = any(m.lineup1)) then array_append(m.lineup1, p_player) else m.lineup1 end,\n         lineup2      = case when s.team = 2 and not (p_player = any(m.lineup2)) then array_append(m.lineup2, p_player) else m.lineup2 end,\n         side1_guests = case when s.team = 1 then array_remove(m.side1_guests, s.nick) else m.side1_guests end,\n         side2_guests = case when s.team = 2 then array_remove(m.side2_guests, s.nick) else m.side2_guests end\n    from match_player_stats s\n   where s.steam_id = s64 and s.match_id = m.id and m.kind = ''mix'';',
   E'  update teams t\n     set members = case when p_player = any(t.members) then t.members else array_append(t.members, p_player) end,\n         guests  = array_remove(t.guests, s.nick)\n    from match_player_stats s join matches m on m.id = s.match_id\n   where s.steam_id = s64 and t.kind = ''mix'' and t.id = case s.team when 1 then m.team1 else m.team2 end;']
]);

drop trigger matches_winner_side on public.matches;
drop function public.matches_winner_side();
alter table public.matches
  drop column side1_name, drop column side2_name, drop column side1_guests, drop column side2_guests, drop column winner_side;

commit;
