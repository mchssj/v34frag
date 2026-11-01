-- Replanteo 17: plantilla de torneo groups_double, "Grupos de doble eliminación + playoffs", y sorteo de la siembra
-- (plan docs/bitacora/2026-10-18-torneo-grupos-doble).
--   - Cada grupo juega un cuadro de doble eliminación sin final del grupo: 1.º gana la final del upper, 2.º gana la
--     final del lower y 3.º la pierde. Los que pierden la segunda ronda del upper bajan cruzados.
--   - Los clasificados (2 o 3 por grupo) van a los playoffs de siempre (event_build_ko), ordenados como en groups.
--   - event_draw mezcla la siembra al azar y guarda quién y cuándo sorteó; otro cambio de la siembra borra la marca.
-- NO aplicar en producción antes del corte (ver README.md).
begin;

do $$
begin
  if to_regclass('public.live_match_list') is null then
    raise exception 'replanteo 17: falta live_match_list (aplicar antes 16_mixes_en_vivo.sql)';
  end if;
  if to_regprocedure('public.event_build_group_double(uuid, uuid[], jsonb)') is not null then
    raise exception 'replanteo 17: event_build_group_double ya existe (¿ya se aplicó?)';
  end if;
end $$;

-- ---------- 1. plantilla y sorteo en events ----------
alter table public.events drop constraint events_template_check;
alter table public.events add constraint events_template_check check (template in ('single', 'double', 'groups', 'swiss', 'groups_double'));
comment on column public.events.template is 'Plantilla: single (eliminación directa), double, groups (grupos + playoffs), swiss (suizo + playoffs) o groups_double (grupos de doble eliminación + playoffs)';
alter table public.events
  add column drawn_at timestamptz,
  add column drawn_by uuid;
comment on column public.events.drawn_at is 'Cuándo se sorteó la siembra (event_draw); null si la siembra se cargó a mano o cambió después';
comment on column public.events.drawn_by is 'Quién sorteó la siembra';

alter table public.event_stage_teams drop constraint event_stage_teams_stage_check;
alter table public.event_stage_teams add constraint event_stage_teams_stage_check check (stage in ('group', 'swiss', 'group_double'));

create function pg_temp.reemplazar(fn regprocedure, cambios text[][]) returns void language plpgsql as $f$
declare d text := pg_get_functiondef(fn); i int;
begin
  for i in 1 .. array_length(cambios, 1) loop
    if position(cambios[i][1] in d) = 0 then
      raise exception 'replanteo 17: en % no se encontró: %', fn, left(cambios[i][1], 80);
    end if;
    d := replace(d, cambios[i][1], cambios[i][2]);
  end loop;
  execute d;
end $f$;

-- ---------- 2. configuración ----------
select pg_temp.reemplazar('public.event_config(text, jsonb)', array[
  [E'    when ''swiss'' then event_config_pick(',
   E'    -- (replanteo 17) grupos de doble eliminación: por defecto 2 grupos, clasifican 3, grupos BO3, playoffs BO3 y final BO5\n    when ''groups_double'' then event_config_pick(''{"groups": 2, "advance": 3, "bo_group": 3}'', c)\n                       || jsonb_build_object(''playoffs'', event_config_pick(''{"bo": 3, "bo_semi": 3, "bo_final": 5, "third_place": false, "bo_third": 3}'', c->''playoffs''))\n    when ''swiss'' then event_config_pick('],
  ['La plantilla tiene que ser single, double, groups o swiss', 'La plantilla tiene que ser single, double, groups, swiss o groups_double'],
  [E'  if p_template = ''swiss'' then\n',
   E'  -- (replanteo 17) grupos de doble eliminación\n  if p_template = ''groups_double'' then\n    if jsonb_typeof(out->''groups'') <> ''number'' or (out->>''groups'')::int not between 1 and 8 then raise exception ''Los grupos tienen que ser entre 1 y 8''; end if;\n    if (out->>''advance'') not in (''2'', ''3'') then raise exception ''En los grupos de doble eliminación clasifican 2 o 3 por grupo''; end if;\n  end if;\n  if p_template = ''swiss'' then\n']
]);

-- ---------- 3. cuadro de cada grupo ----------
-- Reparto en serpentina por siembra (como groups) y, en cada grupo, la llave de doble eliminación de event_build_double
-- sin gran final: los lugares vacíos son libres para los primeros de la siembra. Con 6 equipos: S1 y S2 pasan libres.
create function public.event_build_group_double(p_event uuid, p_teams uuid[], p_cfg jsonb) returns void
  language plpgsql security definer set search_path = public as $$
declare
  g     int := (p_cfg->>'groups')::int;
  n     int := cardinality(p_teams);
  bo    int := (p_cfg->>'bo_group')::int;
  i     int;
  fila  int;
  col   int;
  gi    int;
  lista uuid[];
  s     int;
  k     int;
  r     int;
  c     int;
  ord   int[];
  a     int;
  b     int;
begin
  if n < g * 4 or n > g * 8 then
    raise exception 'Con % grupos hacen falta entre % y % equipos (de 4 a 8 por grupo); hay %', g, g * 4, g * 8, n;
  end if;
  for i in 1 .. n loop
    fila := (i - 1) / g; col := (i - 1) % g;
    gi := case when fila % 2 = 0 then col + 1 else g - col end;
    insert into event_stage_teams(event_id, stage, phase, grp, team_id, seed) values (p_event, 'group_double', 1, gi, p_teams[i], i);
  end loop;

  for gi in 1 .. g loop
    select array_agg(st.team_id order by st.seed) into lista
      from event_stage_teams st where st.event_id = p_event and st.stage = 'group_double' and st.grp = gi;
    s := 4; k := 2;
    while s < cardinality(lista) loop s := s * 2; k := k + 1; end loop;
    for r in 1 .. k loop
      for i in 1 .. s / (2 ^ r)::int loop
        insert into matches(event_id, kind, stage, phase, grp, round, pos, status, best_of)
        values (p_event, 'official', 'group_upper', 1, gi, r, i, 'upcoming', bo);
      end loop;
    end loop;
    for r in 1 .. 2 * k - 2 loop
      c := s / (2 ^ (floor((r + 1) / 2.0)::int + 1))::int;
      for i in 1 .. c loop
        insert into matches(event_id, kind, stage, phase, grp, round, pos, status, best_of)
        values (p_event, 'official', 'group_lower', 1, gi, r, i, 'upcoming', bo);
      end loop;
    end loop;
    -- Upper: el ganador sube de ronda. El de la final del upper es el 1.º (no sigue).
    update matches m set next_win = t.id, next_win_slot = case when m.pos % 2 = 1 then 1 else 2 end from matches t
     where m.event_id = p_event and m.stage = 'group_upper' and m.grp = gi and m.round < k
       and t.event_id = p_event and t.stage = 'group_upper' and t.grp = gi and t.round = m.round + 1 and t.pos = (m.pos + 1) / 2;
    -- Perdedores del upper: la ronda 1 llena la ronda 1 del lower; las demás bajan cruzadas a las rondas pares (lugar 2).
    update matches m set next_lose = t.id, next_lose_slot = case when m.pos % 2 = 1 then 1 else 2 end from matches t
     where m.event_id = p_event and m.stage = 'group_upper' and m.grp = gi and m.round = 1
       and t.event_id = p_event and t.stage = 'group_lower' and t.grp = gi and t.round = 1 and t.pos = (m.pos + 1) / 2;
    update matches m set next_lose = t.id, next_lose_slot = 2 from matches t
     where m.event_id = p_event and m.stage = 'group_upper' and m.grp = gi and m.round >= 2
       and t.event_id = p_event and t.stage = 'group_lower' and t.grp = gi and t.round = 2 * m.round - 2
       and t.pos = s / (2 ^ m.round)::int + 1 - m.pos;
    -- Lower: en las rondas impares el ganador pasa a la misma posición; en las pares se juntan de a dos.
    -- La final del lower no sigue: su ganador es el 2.º y su perdedor el 3.º.
    update matches m set next_win = t.id, next_win_slot = 1 from matches t
     where m.event_id = p_event and m.stage = 'group_lower' and m.grp = gi and m.round % 2 = 1 and m.round < 2 * k - 2
       and t.event_id = p_event and t.stage = 'group_lower' and t.grp = gi and t.round = m.round + 1 and t.pos = m.pos;
    update matches m set next_win = t.id, next_win_slot = case when m.pos % 2 = 1 then 1 else 2 end from matches t
     where m.event_id = p_event and m.stage = 'group_lower' and m.grp = gi and m.round % 2 = 0 and m.round < 2 * k - 2
       and t.event_id = p_event and t.stage = 'group_lower' and t.grp = gi and t.round = m.round + 1 and t.pos = (m.pos + 1) / 2;
    ord := event_seed_order(s);
    for i in 1 .. s / 2 loop
      a := ord[2 * i - 1]; b := ord[2 * i];
      update matches set
        team1 = case when a <= cardinality(lista) then lista[a] end, dead1 = a > cardinality(lista),
        team2 = case when b <= cardinality(lista) then lista[b] end, dead2 = b > cardinality(lista)
       where event_id = p_event and stage = 'group_upper' and grp = gi and round = 1 and pos = i;
    end loop;
  end loop;
  perform event_propagate_dead(p_event);
end $$;
revoke all on function public.event_build_group_double(uuid, uuid[], jsonb) from public, anon, authenticated;

-- ---------- 4. tabla de cada grupo ----------
-- Puesto: 1.º gana la final del upper, 2.º gana la final del lower; los demás, por la ronda del lower en que
-- sumaron la segunda derrota (más tarde, mejor puesto; los que caen en la misma ronda comparten puesto).
-- Mientras el grupo se juega, los que siguen en carrera van arriba de los eliminados (estado active).
create view public.event_group_double_standings with (security_invoker = true) as
with ult as (
  select event_id, grp, stage, max(round) as last_round
    from matches where stage in ('group_upper', 'group_lower') group by event_id, grp, stage
),
res as (
  select m.event_id, m.grp, m.stage, m.round, m.team1 as team_id, m.winner_side = 1 as gano, m.winner_side = 2 as perdio,
         (match_rounds(m.maps))[1] as rf, (match_rounds(m.maps))[2] as ra
    from matches m where m.stage in ('group_upper', 'group_lower') and m.status = 'finished' and not m.bye
  union all
  select m.event_id, m.grp, m.stage, m.round, m.team2, m.winner_side = 2, m.winner_side = 1,
         (match_rounds(m.maps))[2], (match_rounds(m.maps))[1]
    from matches m where m.stage in ('group_upper', 'group_lower') and m.status = 'finished' and not m.bye
),
agg as (
  select st.event_id, st.grp, st.team_id, st.seed,
         count(r.*) filter (where r.gano)::int as won,
         count(r.*) filter (where r.perdio)::int as lost,
         coalesce(sum(r.rf), 0)::int as rounds_for,
         coalesce(sum(r.ra), 0)::int as rounds_against,
         bool_or(r.gano and r.stage = 'group_upper' and r.round = uu.last_round) as gano_upper,
         bool_or(r.gano and r.stage = 'group_lower' and r.round = ul.last_round) as gano_lower,
         max(r.round) filter (where r.perdio and r.stage = 'group_lower') as cayo
    from event_stage_teams st
    left join res r on r.event_id = st.event_id and r.grp = st.grp and r.team_id = st.team_id
    left join ult uu on uu.event_id = st.event_id and uu.grp = st.grp and uu.stage = 'group_upper'
    left join ult ul on ul.event_id = st.event_id and ul.grp = st.grp and ul.stage = 'group_lower'
   where st.stage = 'group_double'
   group by st.event_id, st.grp, st.team_id, st.seed
),
clave as (
  select a.*, a.lost >= 2 as afuera,
         case when coalesce(a.gano_upper, false) then 3000 when coalesce(a.gano_lower, false) then 2000
              when a.lost < 2 then 1000 else a.cayo end as k
    from agg a
),
puesto as (
  select c.*,
         case when c.afuera then rank() over (partition by c.event_id, c.grp order by c.k desc)
              else row_number() over (partition by c.event_id, c.grp order by c.k desc, c.lost, c.won desc, c.seed) end::int as place
    from clave c
)
select p.event_id, p.grp, p.team_id, p.seed, p.place, p.won, p.lost, p.rounds_for, p.rounds_against,
       (p.rounds_for - p.rounds_against)::int as rounds_diff,
       case when p.k >= 2000 or (p.afuera and p.place <= (e.config->>'advance')::int) then 'qualified'
            when p.afuera then 'eliminated' else 'active' end as state
  from puesto p join events e on e.id = p.event_id;
comment on view public.event_group_double_standings is 'Grupos de doble eliminación: puesto, victorias, derrotas, rondas y estado de cada equipo';
grant select on public.event_group_double_standings to anon, authenticated;

-- El clasificado de un puesto (o null si todavía no se sabe).
create function public.event_group_double_team(p_event uuid, p_grp int, p_place int) returns uuid
  language sql stable security definer set search_path = public as $$
  select team_id from event_group_double_standings
   where event_id = p_event and grp = p_grp and place = p_place and state = 'qualified' limit 1
$$;
revoke all on function public.event_group_double_team(uuid, int, int) from public, anon, authenticated;

select pg_temp.reemplazar('public.event_group_qualifiers(uuid)', array[
  [E'      select o.team_id into t from event_group_order(p_event, grp) o where o.place = p;\n',
   E'      -- (replanteo 17) en los grupos de doble eliminación el puesto sale del cuadro\n      if exists (select 1 from events where id = p_event and template = ''groups_double'') then\n        t := event_group_double_team(p_event, grp, p);\n      else\n        select o.team_id into t from event_group_order(p_event, grp) o where o.place = p;\n      end if;\n']
]);

-- ---------- 5. avance y generación ----------
select pg_temp.reemplazar('public.event_progress(uuid)', array[
  [E'  -- Suizo: ronda terminada',
   E'  -- (replanteo 17) Grupos de doble eliminación terminados: playoffs con los clasificados.\n  if e.template = ''groups_double'' and not exists (select 1 from matches where event_id = p_event and stage = ''ko'')\n     and exists (select 1 from matches where event_id = p_event and stage in (''group_upper'', ''group_lower''))\n     and not exists (select 1 from matches where event_id = p_event and stage in (''group_upper'', ''group_lower'') and status <> ''finished'') then\n    perform event_build_ko(p_event, event_group_qualifiers(p_event), 2, e.config->''playoffs'');\n    perform event_progress(p_event);\n    return;\n  end if;\n\n  -- Suizo: ronda terminada']
]);

select pg_temp.reemplazar('public.event_generate(uuid)', array[
  [E'    when ''groups'' then perform event_build_groups(p_event, equipos, e.config);\n',
   E'    when ''groups'' then perform event_build_groups(p_event, equipos, e.config);\n    when ''groups_double'' then perform event_build_group_double(p_event, equipos, e.config); -- (replanteo 17)\n']
]);

-- ---------- 6. sorteo ----------
-- Mezcla al azar la siembra con todos los inscritos. Se puede repetir hasta generar el fixture.
create function public.event_draw(p_event uuid) returns uuid[]
  language plpgsql security definer set search_path = public as $$
declare
  e events%rowtype;
  s uuid[];
begin
  if not can_manage_event(p_event) then raise exception 'Solo el organizador del torneo o un admin puede sortear' using errcode = '42501'; end if;
  select * into e from events where id = p_event for update;
  if e.status <> 'registration' then raise exception 'El sorteo se hace antes de generar el fixture'; end if;
  select array_agg(r.team_id order by random()) into s from tournament_registrations r where r.event_id = p_event;
  if coalesce(cardinality(s), 0) < 2 then raise exception 'Hacen falta al menos 2 equipos inscritos para sortear'; end if;
  perform set_config('v34.draw', '1', true);
  update events set seeds = s, drawn_at = now(), drawn_by = auth.uid() where id = p_event;
  perform set_config('v34.draw', '', true);
  return s;
end $$;
revoke all on function public.event_draw(uuid) from public, anon;
grant execute on function public.event_draw(uuid) to authenticated;

-- Solo event_draw marca el sorteo. Si la siembra cambia por otro lado (a mano, una inscripción o una baja), la marca se borra.
create function public.events_draw_guard() returns trigger
  language plpgsql set search_path = public as $$
begin
  if current_setting('v34.draw', true) is distinct from '1' then
    if tg_op = 'INSERT' then
      new.drawn_at := null; new.drawn_by := null;
    elsif new.seeds is distinct from old.seeds then
      new.drawn_at := null; new.drawn_by := null;
    else
      new.drawn_at := old.drawn_at; new.drawn_by := old.drawn_by;
    end if;
  end if;
  return new;
end $$;
create trigger events_draw_guard before insert or update on public.events for each row execute function public.events_draw_guard();

-- ---------- 7. vistas de listados ----------
-- match_list como en la 16, con las etapas nuevas en el orden de la llave (con los grupos).
create or replace view public.match_list with (security_invoker = true) as
select m.id, m.kind, m.status, m.event_id, e.name as event_name, m.stage, m.phase, m.grp, m.round, m.pos, m.bye,
       m.best_of, m.map, m.starts_at, m.played_at, coalesce(m.played_at, m.starts_at) as at, m.score1, m.score2, m.winner_side, m.side1_name, m.side2_name,
       m.team1 as team1_id, t1.name as team1_name, t1.tag as team1_tag,
       m.team2 as team2_id, t2.name as team2_name, t2.tag as team2_tag,
       m.end_reason, m.demo_status, m.parent_match_id,
       max(m.round) over (partition by m.event_id, m.stage, m.phase) as last_round,
       case m.stage when 'swiss' then 0 when 'group' then 0 when 'group_upper' then 0 when 'group_lower' then 0
                    when 'upper' then 1 when 'ko' then 1 when 'lower' then 2
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

-- event_standings como en la 11, más las tablas de los grupos de doble eliminación (stage group_double).
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
  join teams t on t.id = w.team_id
union all
select d.event_id, 'group_double', d.grp, 1, d.team_id, t.name, t.tag, d.place, false,
       d.won + d.lost, d.won, d.lost, null, d.rounds_for, d.rounds_against, d.rounds_diff,
       d.won, d.lost, null, d.state
  from event_group_double_standings d
  join teams t on t.id = d.team_id;

commit;
