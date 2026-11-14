-- Inversa de la 114: las medallas de torneo que eran manuales (admin_title) vuelven a serlo con su título; las demás
-- de torneo se borran. campeon_torneo y finalista_torneo vuelven a ser manuales, el motor y el aviso quedan como antes,
-- y se borran los triggers, las funciones y las columnas.

begin;

create function pg_temp.reemplazar(fn regprocedure, cambios text[][]) returns void language plpgsql as $$
declare d text := pg_get_functiondef(fn); i int;
begin
  for i in 1 .. array_length(cambios, 1) loop
    if position(cambios[i][1] in d) = 0 then
      raise exception 'inversa 114: en % no se encontró: %', fn, left(cambios[i][1], 80);
    end if;
    d := replace(d, cambios[i][1], cambios[i][2]);
  end loop;
  execute d;
end $$;

drop trigger if exists event_medals on public.events;
drop trigger if exists event_medals on public.tournament_registrations;
drop trigger if exists event_medals on public.tournament_registration_players;
drop function if exists public.tg_event_medals();
drop function if exists public.event_medals_sync(uuid);
drop function if exists public.medal_title_key(text);

update public.player_medals set source = 'admin', event_id = null, title = admin_title, admin_title = null
 where source = 'event' and admin_title is not null;
delete from public.player_medals where source = 'event';

alter table public.player_medals
  drop constraint player_medals_admin_title,
  drop constraint player_medals_event,
  drop constraint player_medals_source_check,
  add constraint player_medals_source_check check (source in ('admin', 'auto', 'season')),
  drop column admin_title,
  drop column event_id;
comment on column public.player_medals.source is 'admin = dada a mano; auto = el motor; season = el cierre de temporada';

alter table public.medal_definitions disable trigger medal_definitions_cambios;
update public.medal_definitions set metric = 'manual', aggregation = 'manual', filters = '{}', updated_at = now()
 where aggregation = 'event_result';
alter table public.medal_definitions enable trigger medal_definitions_cambios;
alter table public.medal_definitions
  drop constraint medal_definitions_aggregation_check,
  add constraint medal_definitions_aggregation_check
    check (aggregation in ('total', 'avg_min_matches', 'max', 'streak', 'once', 'season_rank', 'manual'));

select pg_temp.reemplazar('public.medal_preview(text,text,jsonb,numeric)', array[
  ['if p_aggregation in (''season_rank'', ''manual'', ''event_result'') then', 'if p_aggregation in (''season_rank'', ''manual'') then']]);
select pg_temp.reemplazar('public.medal_metric_values(text,text,jsonb,uuid[])', array[
  ['if p_aggregation in (''season_rank'', ''manual'', ''event_result'') then', 'if p_aggregation in (''season_rank'', ''manual'') then']]);
select pg_temp.reemplazar('public.medal_progress(uuid)', array[
  ['d.aggregation not in (''season_rank'', ''manual'', ''event_result'')', 'd.aggregation not in (''season_rank'', ''manual'')']]);
select pg_temp.reemplazar('public.medals_award(uuid[],uuid[])', array[
  ['aggregation not in (''season_rank'', ''manual'', ''event_result'')', 'aggregation not in (''season_rank'', ''manual'')']]);
select pg_temp.reemplazar('public.tg_notify_player_medals()', array[
  ['  if new.season_id is null and coalesce(current_setting(''cmleague.medals_quiet'', true), '''') <> ''on'' then -- (replanteo 114)',
   '  if new.season_id is null then']]);

commit;
