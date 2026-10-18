-- Inversa de supabase/replanteo/16_mixes_en_vivo.sql: deja la estructura como estaba después de la 15.
-- Se pierde el código de !match de los mixes interrumpidos pendientes (no se vincularán al aprobarlos).
begin;

do $$
begin
  if to_regclass('public.live_match_list') is null then
    raise exception 'inversa 16: live_match_list no existe (¿no se aplicó la 16?)';
  end if;
end $$;

drop view public.live_match_players;
drop view public.live_match_list;

-- match_list como en la 11 (create or replace no puede sacar columnas).
drop view public.match_list;
create view public.match_list with (security_invoker = true) as
select m.id, m.kind, m.status, m.event_id, e.name as event_name, m.stage, m.phase, m.grp, m.round, m.pos, m.bye,
       m.best_of, m.map, m.starts_at, m.played_at, coalesce(m.played_at, m.starts_at) as at, m.score1, m.score2, m.winner_side, m.side1_name, m.side2_name,
       m.team1 as team1_id, t1.name as team1_name, t1.tag as team1_tag,
       m.team2 as team2_id, t2.name as team2_name, t2.tag as team2_tag,
       m.end_reason, m.demo_status, m.parent_match_id,
       max(m.round) over (partition by m.event_id, m.stage, m.phase) as last_round,
       case m.stage when 'swiss' then 0 when 'group' then 0 when 'upper' then 1 when 'ko' then 1 when 'lower' then 2
                    when 'third' then 3 when 'grand' then 4 end as stage_order,
       search_norm(concat_ws(' ', t1.name, t1.tag, t2.name, t2.tag, m.side1_name, m.side2_name, e.name)) as search,
       array(select distinct s.player_id from match_player_stats s
              where s.player_id is not null
                and (s.match_id = m.id or s.match_id in (select c.id from matches c where c.parent_match_id = m.id))) as player_ids
  from matches m
  left join teams t1 on t1.id = m.team1
  left join teams t2 on t2.id = m.team2
  left join events e on e.id = m.event_id;
comment on view public.match_list is 'Listado de partidas: nombres, búsqueda, jugadores, última ronda de la etapa y orden de llave';
grant select on public.match_list to anon, authenticated;

create function pg_temp.reemplazar(fn regprocedure, cambios text[][]) returns void language plpgsql as $f$
declare d text := pg_get_functiondef(fn); i int;
begin
  for i in 1 .. array_length(cambios, 1) loop
    if position(cambios[i][1] in d) = 0 then
      raise exception 'inversa 16: en % no se encontró: %', fn, left(cambios[i][1], 80);
    end if;
    d := replace(d, cambios[i][1], cambios[i][2]);
  end loop;
  execute d;
end $f$;

select pg_temp.reemplazar('public.elo_crash_apply(uuid)', array[
  [E'  -- (replanteo 16) !match: el juego se vincula a su partida de torneo o PCW, como en la ingesta\n  if c.link_code is not null then\n    perform csstv_link_game(p_match, c.link_code, c.link_side_a);\n  end if;\n',
   '']
]);

select pg_temp.reemplazar('public.csstv_after_ingest(uuid, jsonb, text)', array[
  [E'      -- (replanteo 16) con el código de !match, para vincularlo si se aprueba\n      insert into match_crashes(match_id, max_rounds, source, link_code, link_side_a)\n      values (p_match, greatest(csstv_jint(p, ''max_rounds'', 200), 1), p_source,\n              nullif(upper(trim(p->>''link_code'')), ''''), case when p->>''link_side_a'' in (''1'', ''2'') then (p->>''link_side_a'')::smallint end)\n',
   E'      insert into match_crashes(match_id, max_rounds, source)\n      values (p_match, greatest(csstv_jint(p, ''max_rounds'', 200), 1), p_source)\n']
]);

alter table public.match_crashes drop column link_code, drop column link_side_a;

commit;
