-- Inversa de la 123: vuelven las medallas de campeón y finalista de torneo de la 114 (las del respaldo, y
-- event_medals_sync de todos los torneos terminados, sin avisos, por los que terminaron después), y se borran los pines,
-- los premios, la vitrina, los triggers, las funciones y events.pins. Los pines y premios se pierden.

begin;

do $$
begin
  if to_regclass('public.player_medals_123_respaldo') is null then
    raise exception 'inversa 123: no está el respaldo de las medallas (player_medals_123_respaldo)';
  end if;
end $$;

create function pg_temp.reemplazar(fn regprocedure, cambios text[][]) returns void language plpgsql as $$
declare d text := pg_get_functiondef(fn); i int;
begin
  for i in 1 .. array_length(cambios, 1) loop
    if position(cambios[i][1] in d) = 0 then
      raise exception 'inversa 123: en % no se encontró: %', fn, left(cambios[i][1], 80);
    end if;
    d := replace(d, cambios[i][1], cambios[i][2]);
  end loop;
  execute d;
end $$;

drop trigger event_pins on public.events;
drop trigger event_pins on public.tournament_registrations;
drop trigger event_pins on public.tournament_registration_players;
drop trigger event_pins on public.matches;
drop trigger event_pins_log on public.events;
drop function public.tg_event_pins();
drop function public.tg_event_pins_log();
drop view public.player_showcase_shown;
drop view public.player_award_list, public.player_pin_list, public.team_pin_list;
drop function public.player_showcase_set(text, jsonb);
drop function public.player_medals_featured_set(text, jsonb);
drop table public.player_medal_featured;
drop function public.event_award_clear(uuid, text);
drop function public.event_award_pick(uuid, text, uuid, uuid);
drop function public.event_award_candidates(uuid, text);
drop function public.event_pins_sync(uuid);
drop function public.event_award_calculable(uuid, text);
drop function public.event_award_stats(uuid);
drop function public.event_final_places(uuid);
drop table public.player_showcase, public.player_showcase_prefs, public.event_pins_log, public.player_awards,
           public.player_pins, public.team_pins;
alter table public.events drop constraint events_pins_valid, drop column pins;
drop function public.pins_valid(jsonb);
drop function public.pins_config(jsonb);
drop function public.pins_default();
delete from public.notifications where type in ('event_pin', 'event_award');
select pg_temp.reemplazar('public.notification_category(text)', array[
  ['''booking_attention'', ''event_reviewed'', ''game_reviewed'', ''event_pin'', ''event_award'') then ''tournament'' -- (replanteo 123) event_pin y event_award',
   '''booking_attention'', ''event_reviewed'', ''game_reviewed'') then ''tournament''']]);

-- Las medallas de torneo de la 114, como estaban.
alter table public.medal_definitions disable trigger medal_definitions_cambios;
update public.medal_definitions set metric = 'event_result', aggregation = 'event_result', filters = '{"result":"champion"}', status = 'active', updated_at = now()
 where key = 'campeon_torneo';
update public.medal_definitions set metric = 'event_result', aggregation = 'event_result', filters = '{"result":"runner_up"}', status = 'active', updated_at = now()
 where key = 'finalista_torneo';
alter table public.medal_definitions enable trigger medal_definitions_cambios;
insert into public.player_medals select * from public.player_medals_123_respaldo on conflict do nothing;
drop table public.player_medals_123_respaldo;

create function public.event_medals_sync(p_event uuid) returns void
  language plpgsql security definer set search_path = public as $$
declare
  e   events%rowtype;
  r   record;
  v_t text;
  v_id uuid;
begin
  select * into e from events where id = p_event;
  if not found then return; end if;

  -- Lo que corresponde: nada si el torneo no terminó, está en testing o no está aprobado.
  if to_regclass('pg_temp.medallas_torneo') is null then
    create temp table medallas_torneo (player_id uuid, definition_id uuid, title text) on commit drop;
  else
    truncate pg_temp.medallas_torneo;
  end if;
  if e.status = 'finished' and not e.testing and e.approval = 'approved' then
    insert into pg_temp.medallas_torneo
    select distinct t.player_id, d.id,
           case t.result when 'champion' then 'Campeón' else 'Finalista' end || ' · ' || e.name
      from player_titles t
      join medal_definitions d on d.aggregation = 'event_result' and d.status = 'active' and d.filters->>'result' = t.result
     where t.event_id = p_event and t.player_id is not null;
  end if;

  -- Sobran: la adoptada vuelve a ser la que dio el admin; la otra se borra.
  update player_medals pm set source = 'admin', event_id = null, title = pm.admin_title, admin_title = null
   where pm.source = 'event' and pm.event_id = p_event and pm.admin_title is not null
     and not exists (select 1 from pg_temp.medallas_torneo w where w.player_id = pm.player_id and w.definition_id = pm.definition_id);
  delete from player_medals pm
   where pm.source = 'event' and pm.event_id = p_event
     and not exists (select 1 from pg_temp.medallas_torneo w where w.player_id = pm.player_id and w.definition_id = pm.definition_id);

  -- Las que quedan, con el nombre del torneo al día.
  update player_medals pm set title = w.title
    from pg_temp.medallas_torneo w
   where pm.source = 'event' and pm.event_id = p_event
     and pm.player_id = w.player_id and pm.definition_id = w.definition_id and pm.title is distinct from w.title;

  -- Faltan: primero se adopta la que un admin dio a mano con el nombre de este torneo; si no hay, se da.
  v_t := medal_title_key(e.name);
  for r in select w.* from pg_temp.medallas_torneo w
            where not exists (select 1 from player_medals pm where pm.source = 'event' and pm.event_id = p_event
                                 and pm.player_id = w.player_id and pm.definition_id = w.definition_id) loop
    select pm.id into v_id from player_medals pm
     where pm.source = 'admin' and pm.player_id = r.player_id and pm.definition_id = r.definition_id
       and v_t <> '' and medal_title_key(pm.title) = v_t
     order by pm.created_at limit 1;
    if v_id is not null then
      update player_medals set source = 'event', event_id = p_event, admin_title = title, title = r.title where id = v_id;
    else
      insert into player_medals (player_id, title, icon, definition_id, source, event_id)
      values (r.player_id, r.title, null, r.definition_id, 'event', p_event);
    end if;
  end loop;
end $$;
revoke all on function public.event_medals_sync(uuid) from public, anon, authenticated;
comment on function public.event_medals_sync(uuid) is
  'Deja las medallas de campeón y finalista de un torneo iguales a player_titles (replanteo 114)';

-- =====================================================================================================
-- 4. Triggers diferidos
-- =====================================================================================================
create function public.tg_event_medals() returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_table_name = 'events' then
    if tg_op = 'UPDATE' then perform event_medals_sync(new.id); end if;
  elsif tg_op = 'DELETE' then
    perform event_medals_sync(old.event_id);
  else
    perform event_medals_sync(new.event_id);
    if tg_op = 'UPDATE' and old.event_id is distinct from new.event_id then perform event_medals_sync(old.event_id); end if;
  end if;
  return null;
end $$;

create constraint trigger event_medals after update of status, champion, approval, testing, name on public.events
  deferrable initially deferred for each row execute function public.tg_event_medals();
create constraint trigger event_medals after insert or update or delete on public.tournament_registrations
  deferrable initially deferred for each row execute function public.tg_event_medals();
create constraint trigger event_medals after insert or update or delete on public.tournament_registration_players
  deferrable initially deferred for each row execute function public.tg_event_medals();


-- Los torneos que terminaron después de la 123 también, sin avisos.
set local cmleague.medals_quiet = 'on';
select event_medals_sync(id) from events where status = 'finished';
set local cmleague.medals_quiet = 'off';

commit;
