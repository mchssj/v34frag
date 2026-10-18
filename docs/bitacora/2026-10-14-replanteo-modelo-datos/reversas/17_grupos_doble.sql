-- Inversa de supabase/replanteo/17_grupos_doble.sql: deja la estructura como estaba después de la 16.
-- Aborta si hay torneos con la plantilla groups_double (borrarlos o cambiarles la plantilla antes). Se pierde la marca del sorteo.
begin;

do $$
begin
  if to_regprocedure('public.event_build_group_double(uuid, uuid[], jsonb)') is null then
    raise exception 'inversa 17: event_build_group_double no existe (¿no se aplicó la 17?)';
  end if;
  if exists (select 1 from public.events where template = 'groups_double') then
    raise exception 'inversa 17: hay torneos con la plantilla groups_double';
  end if;
end $$;

-- ---------- vistas como en la 16 y la 11 ----------
create or replace view public.event_standings with (security_invoker = true) as
select s.event_id, 'group'::text as stage, s.grp, 1 as phase, s.team_id, t.name, t.tag, o.place, o.tied,
       s.played, s.won, s.lost, s.points, s.rounds_for, s.rounds_against, s.rounds_diff,
       null::int as wins, null::int as losses, null::int as buchholz, null::text as state
  from event_group_standings s
  join lateral event_group_order(s.event_id, s.grp) o on o.team_id = s.team_id
  join teams t on t.id = s.team_id
union all
select w.event_id, 'swiss', 1, w.phase, w.team_id, t.name, t.tag,
       row_number() over (partition by w.event_id, w.phase order by w.wins desc, w.losses, w.buchholz desc, w.rounds_diff desc, w.seed)::int,
       false, w.wins + w.losses, w.wins, w.losses, null, null, null, w.rounds_diff,
       w.wins, w.losses, w.buchholz, w.state
  from event_swiss_standings w
  join teams t on t.id = w.team_id;

create or replace view public.match_list with (security_invoker = true) as
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
                and (s.match_id = m.id or s.match_id in (select c.id from matches c where c.parent_match_id = m.id))) as player_ids,
       m.cancel_reason,
       case when mc.match_id is null then null when mc.decision is null then 'pending' else mc.decision end as review,
       mc.max_rounds as review_max_rounds
  from matches m
  left join teams t1 on t1.id = m.team1
  left join teams t2 on t2.id = m.team2
  left join events e on e.id = m.event_id
  left join match_crashes mc on mc.match_id = m.id;

-- ---------- sorteo ----------
drop trigger events_draw_guard on public.events;
drop function public.events_draw_guard();
drop function public.event_draw(uuid);

-- ---------- funciones del motor ----------
create function pg_temp.reemplazar(fn regprocedure, cambios text[][]) returns void language plpgsql as $f$
declare d text := pg_get_functiondef(fn); i int;
begin
  for i in 1 .. array_length(cambios, 1) loop
    if position(cambios[i][1] in d) = 0 then
      raise exception 'inversa 17: en % no se encontró: %', fn, left(cambios[i][1], 80);
    end if;
    d := replace(d, cambios[i][1], cambios[i][2]);
  end loop;
  execute d;
end $f$;

select pg_temp.reemplazar('public.event_generate(uuid)', array[
  [E'    when ''groups_double'' then perform event_build_group_double(p_event, equipos, e.config); -- (replanteo 17)\n', '']
]);

select pg_temp.reemplazar('public.event_progress(uuid)', array[
  [E'  -- (replanteo 17) Grupos de doble eliminación terminados: playoffs con los clasificados.\n  if e.template = ''groups_double'' and not exists (select 1 from matches where event_id = p_event and stage = ''ko'')\n     and exists (select 1 from matches where event_id = p_event and stage in (''group_upper'', ''group_lower''))\n     and not exists (select 1 from matches where event_id = p_event and stage in (''group_upper'', ''group_lower'') and status <> ''finished'') then\n    perform event_build_ko(p_event, event_group_qualifiers(p_event), 2, e.config->''playoffs'');\n    perform event_progress(p_event);\n    return;\n  end if;\n\n', '']
]);

select pg_temp.reemplazar('public.event_group_qualifiers(uuid)', array[
  [E'      -- (replanteo 17) en los grupos de doble eliminación el puesto sale del cuadro\n      if exists (select 1 from events where id = p_event and template = ''groups_double'') then\n        t := event_group_double_team(p_event, grp, p);\n      else\n        select o.team_id into t from event_group_order(p_event, grp) o where o.place = p;\n      end if;\n',
   E'      select o.team_id into t from event_group_order(p_event, grp) o where o.place = p;\n']
]);

select pg_temp.reemplazar('public.event_config(text, jsonb)', array[
  [E'    -- (replanteo 17) grupos de doble eliminación: por defecto 2 grupos, clasifican 3, grupos BO3, playoffs BO3 y final BO5\n    when ''groups_double'' then event_config_pick(''{"groups": 2, "advance": 3, "bo_group": 3}'', c)\n                       || jsonb_build_object(''playoffs'', event_config_pick(''{"bo": 3, "bo_semi": 3, "bo_final": 5, "third_place": false, "bo_third": 3}'', c->''playoffs''))\n', ''],
  ['La plantilla tiene que ser single, double, groups, swiss o groups_double', 'La plantilla tiene que ser single, double, groups o swiss'],
  [E'  -- (replanteo 17) grupos de doble eliminación\n  if p_template = ''groups_double'' then\n    if jsonb_typeof(out->''groups'') <> ''number'' or (out->>''groups'')::int not between 1 and 8 then raise exception ''Los grupos tienen que ser entre 1 y 8''; end if;\n    if (out->>''advance'') not in (''2'', ''3'') then raise exception ''En los grupos de doble eliminación clasifican 2 o 3 por grupo''; end if;\n  end if;\n', '']
]);

drop function public.event_group_double_team(uuid, int, int);
drop view public.event_group_double_standings;
drop function public.event_build_group_double(uuid, uuid[], jsonb);

-- ---------- tablas ----------
alter table public.event_stage_teams drop constraint event_stage_teams_stage_check;
alter table public.event_stage_teams add constraint event_stage_teams_stage_check check (stage in ('group', 'swiss'));
alter table public.events drop column drawn_at, drop column drawn_by;
alter table public.events drop constraint events_template_check;
alter table public.events add constraint events_template_check check (template in ('single', 'double', 'groups', 'swiss'));
comment on column public.events.template is 'Plantilla: single (eliminación directa), double, groups (grupos + playoffs) o swiss (suizo + playoffs)';

commit;
