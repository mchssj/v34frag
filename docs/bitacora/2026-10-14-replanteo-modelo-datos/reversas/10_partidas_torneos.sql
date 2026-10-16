-- Inversa de supabase/replanteo/10_partidas_torneos.sql.
-- Vuelve todo a como lo dejó la 09: reportes de los capitanes, columnas viejas de events, inscripción por
-- RLS, código de !match visible, veto por RLS, chat abierto y PCW sin "jugar como equipo".
-- Los torneos creados con plantillas pierden su configuración (se convierte a format/best_of de forma aproximada).
begin;

create function pg_temp.reemplazar(fn regprocedure, cambios text[][]) returns void language plpgsql as $f$
declare d text := pg_get_functiondef(fn); i int;
begin
  for i in 1 .. array_length(cambios, 1) loop
    if position(cambios[i][1] in d) = 0 then
      raise exception 'inversa 10: en % no se encontró: %', fn, left(cambios[i][1], 80);
    end if;
    d := replace(d, cambios[i][1], cambios[i][2]);
  end loop;
  execute d;
end $f$;

-- ---------- 8. reportes de los capitanes ----------
create table public.result_reports (
  id         uuid primary key default gen_random_uuid(),
  match_id   uuid not null references public.matches(id) on delete cascade,
  team_id    uuid not null references public.teams(id) on delete cascade,
  by_user    uuid not null,
  maps       jsonb not null,
  lineup     uuid[] not null default '{}',
  proof      text[] not null default '{}',
  note       text check (char_length(note) <= 300),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (match_id, team_id)
);
create index idx_reportes_match on public.result_reports (match_id);
alter table public.result_reports enable row level security;
create policy "reportes: admin gestiona" on public.result_reports using (is_admin()) with check (is_admin());
create policy "reportes: el capitan edita el suyo" on public.result_reports for update
  using ((by_user = auth.uid()) and is_team_captain(team_id)) with check ((by_user = auth.uid()) and is_team_captain(team_id));
create policy "reportes: el capitan envia el suyo" on public.result_reports for insert
  with check ((by_user = auth.uid()) and is_team_captain(team_id) and is_match_captain(match_id));
create policy "reportes: el capitan retira el suyo" on public.result_reports for delete
  using (((by_user = auth.uid()) and is_team_captain(team_id) and (exists (select 1 from matches m where m.id = result_reports.match_id and m.status <> 'finished'))) or is_admin());
create policy "reportes: ver" on public.result_reports for select
  using (is_admin() or is_match_captain(match_id) or (exists (select 1 from matches m where m.id = result_reports.match_id and m.status = 'finished')));
CREATE OR REPLACE FUNCTION public.validate_report()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare m matches%rowtype; roster uuid[]; e jsonb; u text;
begin
  select * into m from matches where id = new.match_id;
  if not found or m.team1 is null or m.team2 is null then raise exception 'La partida todavía no tiene los dos equipos'; end if;
  if new.team_id not in (m.team1, m.team2) then raise exception 'Ese equipo no juega esta partida'; end if;
  if m.status = 'finished' then raise exception 'La partida ya terminó'; end if;
  if jsonb_typeof(new.maps) <> 'array' or jsonb_array_length(new.maps) not between 1 and 5 then
    raise exception 'Cargá entre 1 y 5 mapas';
  end if;
  if jsonb_array_length(new.maps) > coalesce(m.best_of, 1) then
    raise exception 'Esta partida es BO% como máximo', coalesce(m.best_of, 1);
  end if;
  for e in select value from jsonb_array_elements(new.maps) loop
    if (e->>'r1') is null or (e->>'r2') is null or (e->>'r1') !~ '^\d{1,2}$' or (e->>'r2') !~ '^\d{1,2}$' then
      raise exception 'Cada mapa necesita las rondas de los dos equipos (números de 0 a 99)';
    end if;
    if length(coalesce(e->>'map','')) > 40 then raise exception 'Nombre de mapa demasiado largo'; end if;
  end loop;
  select coalesce(array_agg(player_id), '{}') into roster from team_members where team_id = new.team_id and left_at is null;
  if coalesce(array_length(new.lineup, 1), 0) > 7 then raise exception 'La alineación puede tener hasta 7 jugadores'; end if;
  if not (new.lineup <@ roster) then raise exception 'La alineación solo puede tener jugadores del plantel del equipo'; end if;
  if coalesce(array_length(new.proof, 1), 0) > 3 then raise exception 'Se pueden subir hasta 3 capturas'; end if;
  foreach u in array new.proof loop
    if u not like 'https://%/storage/v1/object/public/proofs/%' then
      raise exception 'Las capturas tienen que estar subidas a la página';
    end if;
  end loop;
  new.updated_at := now();
  return new;
end $function$;
CREATE OR REPLACE FUNCTION public.autoapply_pcw()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare m matches%rowtype; otro result_reports%rowtype; s1 int := 0; s2 int := 0; e jsonb;
begin
  select * into m from matches where id = new.match_id;
  if not found or m.kind <> 'pcw' or m.status = 'finished' then return new; end if;
  select * into otro from result_reports where match_id = new.match_id and team_id <> new.team_id limit 1;
  if not found then return new; end if;
  if norm_maps(otro.maps) <> norm_maps(new.maps) then return new; end if;
  for e in select value from jsonb_array_elements(new.maps) loop
    if (e->>'r1')::int > (e->>'r2')::int then s1 := s1 + 1;
    elsif (e->>'r2')::int > (e->>'r1')::int then s2 := s2 + 1;
    end if;
  end loop;
  if s1 = s2 then return new; end if;
  update matches set
    status = 'finished', maps = new.maps, score1 = s1, score2 = s2,
    winner = case when s1 > s2 then m.team1 else m.team2 end,
    map = (select string_agg(coalesce(nullif(x->>'map',''), '?'), ', ') from jsonb_array_elements(new.maps) x)
  where id = new.match_id;
  return new;
end $function$;
create trigger validate_report before insert or update on public.result_reports for each row execute function public.validate_report();
create trigger autoapply_pcw after insert or update on public.result_reports for each row execute function public.autoapply_pcw();
create policy "proofs: todos ven" on storage.objects for select using (bucket_id = 'proofs');
create policy "proofs: el capitan sube" on storage.objects for insert to authenticated
  with check (bucket_id = 'proofs' and exists (select 1 from public.matches m
    where (m.id)::text = (storage.foldername(objects.name))[1] and m.status <> 'finished' and public.is_match_captain(m.id)));
create policy "proofs: admin borra" on storage.objects for delete to authenticated using (bucket_id = 'proofs' and public.is_admin());

-- ---------- 7. PCW ----------
drop function public.pcw_set_result(uuid, jsonb);
select pg_temp.reemplazar('public.pcw_cleanup()', array[
  [E'    and not exists (select 1 from matches m where m.team1 = t.id or m.team2 = t.id);\n  -- (replanteo 10) PCW vencidas: 48 h después de su hora sin mapas jugados\n  with vencidas as (\n    select m.id from matches m join pcw_posts p on p.match_id = m.id\n     where m.kind = ''pcw'' and m.status = ''upcoming'' and coalesce(m.starts_at, p.created_at) < now() - interval ''48 hours''\n       and not exists (select 1 from matches c where c.parent_match_id = m.id)),\n  anuncios as (update pcw_posts set status = ''cancelled'' where match_id in (select id from vencidas))\n  delete from matches where id in (select id from vencidas);\n  delete from teams t where t.kind = ''pcw''\n    and not exists (select 1 from matches m where m.team1 = t.id or m.team2 = t.id)\n    and not exists (select 1 from pcw_posts p where p.team_id = t.id and p.status = ''open'');\nend',
   E'    and not exists (select 1 from matches m where m.team1 = t.id or m.team2 = t.id);\nend']
]);
select pg_temp.reemplazar('public.cancel_pcw_match(uuid)', array[
  ['if m.status = ''finished'' then raise exception ''La práctica ya terminó''; end if;' || E'\n  -- (replanteo 10) con mapas jugados ya no se cancela\n  if exists (select 1 from matches c where c.parent_match_id = p_match) then raise exception ''Ya se jugaron mapas de esta práctica: no se puede cancelar''; end if;',
   'if m.status = ''finished'' then raise exception ''La práctica ya terminó''; end if;']
]);
drop function public.create_pcw_post(text, integer, text, timestamp with time zone, text, uuid[], text[], uuid);
drop function public.accept_pcw(uuid, text, uuid[], text[], uuid);
CREATE OR REPLACE FUNCTION public.create_pcw_post(p_name text, p_best_of integer, p_maps text, p_starts_at timestamp with time zone, p_note text, p_players uuid[], p_guests text[])
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare tid uuid; pid uuid;
begin
  if auth.uid() is null then raise exception 'Tenés que iniciar sesión'; end if;
  perform pcw_cleanup();
  if p_best_of not in (1, 3, 5) then raise exception 'El formato tiene que ser BO1, BO3 o BO5'; end if;
  -- (replanteo 08) solo los formatos que habilitó el admin
  if not exists (select 1 from pcw_config c where c.id = 1 and p_best_of = any(c.best_of)) then
    raise exception 'El formato BO% no está habilitado para las PCW', p_best_of;
  end if;
  if exists (select 1 from pcw_posts where by_user = auth.uid() and status = 'open') then
    raise exception 'Ya tenés un anuncio abierto. Cancelalo para publicar otro.';
  end if;
  if (select count(*) from pcw_posts where by_user = auth.uid() and created_at > now() - interval '1 day') >= 6 then
    raise exception 'Alcanzaste el límite de anuncios por día';
  end if;
  tid := pcw_make_side(p_name, p_players, p_guests);
  insert into pcw_posts(team_id, by_user, best_of, maps, starts_at, note, status)
  values (tid, auth.uid(), p_best_of, left(nullif(trim(p_maps), ''), 120), p_starts_at, left(nullif(trim(p_note), ''), 200), 'open')
  returning id into pid;
  return pid;
end $function$;
CREATE OR REPLACE FUNCTION public.accept_pcw(p_post uuid, p_name text, p_players uuid[], p_guests text[])
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare po pcw_posts%rowtype; tid uuid; mid uuid;
begin
  if auth.uid() is null then raise exception 'Tenés que iniciar sesión'; end if;
  select * into po from pcw_posts where id = p_post for update;
  if not found or po.status <> 'open' then raise exception 'Este anuncio ya no está disponible'; end if;
  if po.by_user = auth.uid() then raise exception 'No podés aceptar tu propio anuncio'; end if;
  tid := pcw_make_side(p_name, p_players, p_guests);
  if exists (select 1 from team_members a join team_members b on b.player_id = a.player_id where a.team_id = po.team_id and b.team_id = tid and a.left_at is null and b.left_at is null) then
    raise exception 'Hay jugadores que están en los dos rosters';
  end if;
  if exists (select 1 from teams a, teams b, unnest(a.guests) x, unnest(b.guests) y
             where a.id = po.team_id and b.id = tid and lower(x) = lower(y)) then
    raise exception 'Hay tags repetidos entre los dos rosters';
  end if;
  insert into matches(team1, team2, status, starts_at, best_of, kind)
  values (po.team_id, tid, 'upcoming', po.starts_at, po.best_of, 'pcw')
  returning id into mid;
  update pcw_posts set status = 'matched', match_id = mid where id = p_post;
  return mid;
end $function$;
revoke all on function public.create_pcw_post(text, integer, text, timestamp with time zone, text, uuid[], text[]) from public;
revoke all on function public.accept_pcw(uuid, text, uuid[], text[]) from public;
drop function public.pcw_side_team(uuid, uuid);

-- ---------- 6. !match ----------
select pg_temp.reemplazar('public.team_members_rules()', array[
  [E'  -- (replanteo 10) el control de torneos pasa a los inscritos (tournament_registration_players)\n',
   E'  -- Un jugador no puede estar en dos equipos inscritos en el mismo torneo (sin campeón todavía).\n  select e.name as torneo, t2.name as equipo into x\n    from tournament_registrations r\n    join events e on e.id = r.event_id and e.champion is null\n    join tournament_registrations r2 on r2.event_id = r.event_id and r2.team_id <> r.team_id\n    join team_members m2 on m2.team_id = r2.team_id and m2.player_id = new.player_id and m2.left_at is null\n    join teams t2 on t2.id = r2.team_id\n   where r.team_id = new.team_id\n   limit 1;\n  if found then\n    raise exception ''% ya está inscrito en el torneo % con %'', pl.nick, x.torneo, x.equipo;\n  end if;\n']
]);
select pg_temp.reemplazar('public.csstv_link_game(uuid, text, integer)', array[
  ['select 1 from match_roster(par.id, ta) rr where rr = s.player_id',
   'select 1 from team_members tm where tm.team_id = ta and tm.player_id = s.player_id and tm.left_at is null'],
  ['select 1 from match_roster(par.id, tb) rr where rr = s.player_id',
   'select 1 from team_members tm where tm.team_id = tb and tm.player_id = s.player_id and tm.left_at is null'],
  ['    into w1, w2 from jsonb_array_elements(nuevos) e;' || E'\n  -- (replanteo 10) mapa de ventaja\n  w1 := w1 + case when par.advantage_side = 1 then 1 else 0 end;\n  w2 := w2 + case when par.advantage_side = 2 then 1 else 0 end;',
   '    into w1, w2 from jsonb_array_elements(nuevos) e;']
]);
select pg_temp.reemplazar('public.csstv_match_lookup(text, text)', array[
  ['x.link_code, x.team1, x.team2, e.players_min, -- (replanteo 10) inscritos y mínimo del torneo' || E'\n        ',
   'x.link_code, x.team1, x.team2,'],
  ['from match_roster(m.id, m.team1) r join players p on p.id = r' || E'\n                        where p.steam_id is not null',
   'from team_members tm join players p on p.id = tm.player_id' || E'\n                        where tm.team_id = m.team1 and tm.left_at is null and p.steam_id is not null'],
  ['from match_roster(m.id, m.team2) r join players p on p.id = r' || E'\n                        where p.steam_id is not null',
   'from team_members tm join players p on p.id = tm.player_id' || E'\n                        where tm.team_id = m.team2 and tm.left_at is null and p.steam_id is not null'],
  ['''min_roster='' || case when m.kind = ''pcw'' then 3 else coalesce(m.players_min, 5) end,',
   '''min_roster='' || case when m.kind = ''pcw'' then 3 else 5 end,']
]);

-- ---------- 5. chat, veto, mapas y código ----------
drop view public.match_chat_public;
drop policy "chat: escribir" on public.match_chat;
create policy "Usuarios autenticados pueden enviar mensajes" on public.match_chat for insert with check (auth.uid() = user_id);
drop function public.match_chat_can_write(uuid);
drop function public.veto_act(uuid, text, text);
drop function public.veto_reset(uuid);
drop function public.veto_sequence(integer, integer);
create policy "vetos: capitan en su turno" on public.match_vetos for insert
  with check ((by_user = auth.uid()) and (exists (select 1 from (matches m join teams t on (t.id = match_vetos.team_id))
    where m.id = match_vetos.match_id and m.status <> 'finished' and t.captain_id = auth.uid()
      and match_vetos.team_id = case when (match_vetos.seq % 2) = 1 then m.team1 else m.team2 end))
    and (seq = (select count(*) + 1 from match_vetos v where v.match_id = match_vetos.match_id)));
alter table public.match_vetos drop column version;
drop table public.map_pool;
drop view public.game_servers_public;
drop function public.match_link_code(uuid);
drop function public.is_match_participant(uuid);
do $$
begin
  execute 'revoke select (' || (select string_agg(quote_ident(column_name), ', ' order by ordinal_position)
                                  from information_schema.columns where table_schema = 'public' and table_name = 'matches'
                                   and column_name <> 'link_code') || ') on public.matches from anon, authenticated';
end $$;
grant select on public.matches to anon, authenticated;

-- ---------- 4. motor ----------
create or replace view public.team_standings with (security_invoker = true) as
with jugadas as (
  select m.team1 as team_id, m.winner_side = 1 as gano, 'official' as tipo from matches m
   where m.kind = 'official' and m.status = 'finished' and not coalesce(m.bye, false) and m.winner_side is not null
     and m.team1 is not null and m.team2 is not null
     and not (coalesce(m.stage, '') <> '' and (m.event_id is null or not exists (select 1 from events e where e.id = m.event_id)))
  union all
  select m.team2, m.winner_side = 2, 'official' from matches m
   where m.kind = 'official' and m.status = 'finished' and not coalesce(m.bye, false) and m.winner_side is not null
     and m.team1 is not null and m.team2 is not null
     and not (coalesce(m.stage, '') <> '' and (m.event_id is null or not exists (select 1 from events e where e.id = m.event_id)))
  union all
  select s.parent_team_id, m.winner_side = 1, 'pcw' from matches m join teams s on s.id = m.team1
   where m.kind = 'pcw' and m.status = 'finished' and m.winner_side is not null and s.parent_team_id is not null
  union all
  select s.parent_team_id, m.winner_side = 2, 'pcw' from matches m join teams s on s.id = m.team2
   where m.kind = 'pcw' and m.status = 'finished' and m.winner_side is not null and s.parent_team_id is not null
)
select t.id as team_id, t.name, t.tag,
       count(j.*) filter (where j.tipo = 'official')::int                 as official_played,
       count(j.*) filter (where j.tipo = 'official' and j.gano)::int      as official_won,
       count(j.*) filter (where j.tipo = 'official' and not j.gano)::int  as official_lost,
       count(j.*) filter (where j.tipo = 'pcw')::int                      as pcw_played,
       count(j.*) filter (where j.tipo = 'pcw' and j.gano)::int           as pcw_won,
       count(j.*) filter (where j.tipo = 'pcw' and not j.gano)::int       as pcw_lost,
       (count(j.*) filter (where j.tipo = 'official' and j.gano) * c.win_official)::int as official_points,
       (count(j.*) filter (where j.tipo = 'pcw' and j.gano) * c.win_pcw)::int           as pcw_points
  from teams t
  cross join ranking_config c
  left join jugadas j on j.team_id = t.id
 where t.kind = 'official'
 group by t.id, t.name, t.tag, c.win_official, c.win_pcw;
drop trigger matches_event_progress on public.matches;
drop function public.matches_event_progress();
drop function public.match_schedule(uuid, timestamptz, uuid);
drop function public.event_resolve_tie(uuid, int, uuid[]);
drop function public.event_set_result(uuid, jsonb, uuid, boolean);
drop function public.event_unroute(uuid);
drop function public.event_reset(uuid);
drop function public.event_generate(uuid);
drop function public.event_progress(uuid);
drop function public.event_group_qualifiers(uuid);
drop function public.event_group_clashes(uuid, uuid[]);
drop function public.event_swiss_phase(uuid, int);
drop function public.event_swiss_round(uuid, int);
drop view public.event_swiss_standings;
drop function public.event_group_order(uuid, int);
drop view public.event_group_standings;
drop function public.match_rounds(jsonb);
drop function public.event_build_groups(uuid, uuid[], jsonb);
drop function public.event_build_double(uuid, uuid[], jsonb);
drop function public.event_build_ko(uuid, uuid[], int, jsonb);
drop function public.event_propagate_dead(uuid);
drop function public.event_seed_order(int);

-- ---------- 3. inscripción ----------
drop function public.match_roster(uuid, uuid);
drop trigger team_members_unregister on public.team_members;
drop function public.team_members_unregister();
drop function public.event_register(uuid, uuid, uuid[], int);
drop function public.event_unregister(uuid, uuid);
drop table public.tournament_registration_players;
-- Inscripción a un torneo: ningún jugador del plantel puede estar inscrito con otro equipo.
create function public.tournament_registrations_unicos() returns trigger
  language plpgsql security definer set search_path = public as $$
declare x record;
begin
  select pl.nick, t2.name as equipo into x
    from team_members m
    join team_members m2 on m2.player_id = m.player_id and m2.left_at is null and m2.team_id <> m.team_id
    join tournament_registrations r2 on r2.team_id = m2.team_id and r2.event_id = new.event_id
    join players pl on pl.id = m.player_id
    join teams t2 on t2.id = m2.team_id
   where m.team_id = new.team_id and m.left_at is null
   order by pl.nick
   limit 1;
  if found then
    raise exception '% ya está inscrito en este torneo con %. Uno de los dos equipos tiene que sacarlo de su plantel', x.nick, x.equipo;
  end if;
  return new;
end $$;
create trigger tournament_registrations_unicos before insert on public.tournament_registrations
  for each row execute function public.tournament_registrations_unicos();

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

-- ---------- 2. torneos ----------
drop policy "torneos: crear" on public.events;
drop policy "torneos: gestionar" on public.events;
drop policy "torneos: borrar" on public.events;
create policy "torneos: admin gestiona" on public.events using (is_admin()) with check (is_admin());
drop trigger events_safe_delete on public.events;
drop function public.events_safe_delete();
drop trigger events_guard on public.events;
drop function public.events_guard();
drop function public.event_engine_on();
drop function public.can_manage_event(uuid);
drop function public.event_config(text, jsonb);
drop function public.event_config_pick(jsonb, jsonb);
drop table public.event_stage_teams;
alter table public.tournament_registrations drop column start_stage;
alter table public.matches drop column phase, drop column advantage_side;
alter table public.matches drop constraint matches_end_reason_check;
update public.matches set end_reason = null where end_reason = 'walkover';
alter table public.matches add constraint matches_end_reason_check check (end_reason is null or end_reason = 'surrender');
alter table public.events
  add column format text default 'playoffs',
  add column stage text default 'Inscripciones',
  add column best_of integer not null default 1,
  add column final_bo integer not null default 1,
  add column group_count integer not null default 2,
  add column advance integer not null default 2,
  add column double_rr boolean not null default false,
  add column generated boolean not null default false,
  add constraint events_format_check check (format is null or format in ('playoffs', 'single', 'double', 'rr', 'groups'));
update public.events set
  format = case template when 'double' then 'double' when 'groups' then 'groups' else 'single' end,
  best_of = coalesce((config->>'bo')::int, (config->>'bo_group')::int, 1),
  final_bo = coalesce((config->>'bo_final')::int, (config->>'bo_grand_final')::int, (config->'playoffs'->>'bo_final')::int, 1),
  group_count = coalesce((config->>'groups')::int, 2), advance = coalesce((config->>'advance')::int, 2),
  double_rr = coalesce((config->>'double_rr')::boolean, false),
  generated = status <> 'registration',
  stage = case status when 'finished' then 'Finalizado' when 'in_progress' then 'En curso' else 'Inscripciones' end;
create policy "inscripciones: duenio o capitan inscribe" on public.tournament_registrations for insert
  with check ((exists (select 1 from teams t where t.id = tournament_registrations.team_id and (t.owner_id = auth.uid() or t.captain_id = auth.uid())))
    and (exists (select 1 from events e where e.id = tournament_registrations.event_id
                 and coalesce(e.stage, 'Inscripciones') = 'Inscripciones' and not coalesce(e.generated, false))));
create policy "inscripciones: duenio o capitan se da de baja" on public.tournament_registrations for delete
  using ((exists (select 1 from teams t where t.id = tournament_registrations.team_id and (t.owner_id = auth.uid() or t.captain_id = auth.uid()))) or is_admin());
alter table public.events
  drop constraint events_template_check, drop constraint events_status_check, drop constraint events_players_check,
  drop column organizer_id, drop column template, drop column config, drop column players_min, drop column players_max,
  drop column status, drop column tie_pending;

-- ---------- 1. organizadores ----------
update public.profiles set role = 'user' where role = 'organizer';
drop function public.set_user_role(uuid, text);
drop function public.is_organizer();
alter table public.profiles drop constraint profiles_role_check;

commit;
