-- 114: medallas de campeón y finalista de torneo automáticas (bitácora docs/bitacora/2026-11-13-medallas-de-torneo/,
-- Daniel 2026-11-13).
--
-- Al terminar un torneo público o histórico aprobado (sin testing), los jugadores con ficha del campeón y del finalista
-- reciben «Campeón de torneo» y «Finalista de torneo» (las de player_titles). Las medallas siguen al palmarés: si se
-- corrige la final, se reinicia o se cancela el torneo, deja de estar aprobado o cambia el plantel de un histórico, se
-- quitan las que sobran y se dan las que faltan.
--
--   1. player_medals.event_id y source = 'event' (una por jugador, torneo y medalla).
--   2. medal_definitions.aggregation = 'event_result' (filters.result = champion | runner_up). campeon_torneo y
--      finalista_torneo pasan a ese tipo, con el diseño que ya tienen (si faltan, se crean con el de templates.json).
--      El motor (medals_award, medal_progress, medal_metric_values, medal_preview) las saltea, como a las manuales.
--   3. event_medals_sync(evento): deja las medallas del torneo iguales a player_titles. Antes de dar una, adopta la
--      que un admin ya dio a mano a ese jugador con el nombre del torneo («CAMPEON TORNEO TITAN» para TORNEO TITAN),
--      para no duplicarla, y guarda su título en admin_title: si deja de corresponder, vuelve a ser la manual. Las
--      demás medallas a mano no se tocan nunca.
--   4. Triggers diferidos (al confirmar la transacción) en events, tournament_registrations y
--      tournament_registration_players: un plantel que se borra y se vuelve a cargar no quita y vuelve a dar.
--   5. tg_notify_player_medals respeta cmleague.medals_quiet = 'on' (el retroactivo de esta migración no avisa).
--   6. Retroactivo: event_medals_sync de todos los torneos.
--
-- Necesita la 113. Inversa: docs/bitacora/2026-10-14-replanteo-modelo-datos/reversas/114_medallas_de_torneo.sql.
begin;

do $$
begin
  if not exists (select 1 from information_schema.columns
                  where table_schema = 'public' and table_name = 'tournament_registrations' and column_name = 'guest_names') then
    raise exception 'replanteo 114: falta la 113 (tournament_registrations.guest_names)';
  end if;
  if exists (select 1 from information_schema.columns
              where table_schema = 'public' and table_name = 'player_medals' and column_name = 'event_id') then
    raise exception 'replanteo 114: ya se aplicó (player_medals.event_id existe)';
  end if;
end $$;

create function pg_temp.reemplazar(fn regprocedure, cambios text[][]) returns void language plpgsql as $$
declare d text := pg_get_functiondef(fn); i int;
begin
  for i in 1 .. array_length(cambios, 1) loop
    if position(cambios[i][1] in d) = 0 then
      raise exception 'replanteo 114: en % no se encontró: %', fn, left(cambios[i][1], 80);
    end if;
    d := replace(d, cambios[i][1], cambios[i][2]);
  end loop;
  execute d;
end $$;

-- =====================================================================================================
-- 1. player_medals
-- =====================================================================================================
alter table public.player_medals
  add column event_id uuid references public.events(id) on delete cascade,
  add column admin_title text,
  drop constraint player_medals_source_check,
  add constraint player_medals_source_check check (source in ('admin', 'auto', 'season', 'event')),
  add constraint player_medals_event check ((source = 'event') = (event_id is not null)),
  add constraint player_medals_admin_title check (admin_title is null or source = 'event');
comment on column public.player_medals.event_id is 'El torneo de una medalla de campeón o finalista (source = event, replanteo 114)';
comment on column public.player_medals.source is
  'admin = dada a mano; auto = el motor; season = el cierre de temporada; event = campeón o finalista de un torneo (replanteo 114)';
comment on column public.player_medals.admin_title is
  'Si era una medalla dada a mano que el torneo adoptó, su título de antes: vuelve a ser manual si deja de corresponder (replanteo 114)';
create unique index player_medals_event on public.player_medals (player_id, event_id, definition_id) where source = 'event';
create index player_medals_event_id on public.player_medals (event_id) where event_id is not null;

-- =====================================================================================================
-- 2. Definiciones event_result
-- =====================================================================================================
alter table public.medal_definitions
  drop constraint medal_definitions_aggregation_check,
  add constraint medal_definitions_aggregation_check
    check (aggregation in ('total', 'avg_min_matches', 'max', 'streak', 'once', 'season_rank', 'manual', 'event_result'));

-- La condición de una medalla activa no se puede cambiar (tg_medal_definitions): acá sí, una sola vez.
alter table public.medal_definitions disable trigger medal_definitions_cambios;
insert into public.medal_definitions (key, template, title, description, design, metric, aggregation, filters, target,
                                      status, activated_at, retroactive)
values ('campeon_torneo', 'campeon_torneo', 'Campeón de torneo', 'Ganó un torneo de la plataforma.',
        '{"label":"CM LEAGUE","band":"CAMPEÓN","metal":"oro","accent":"campeon"}', 'event_result', 'event_result',
        '{"result":"champion"}', 1, 'active', now(), true),
       ('finalista_torneo', 'finalista_torneo', 'Finalista de torneo', 'Jugó la final de un torneo de la plataforma.',
        '{"label":"CM LEAGUE","band":"FINALISTA","metal":"plata","accent":"finalista"}', 'event_result', 'event_result',
        '{"result":"runner_up"}', 1, 'active', now(), true)
on conflict (key) do update
   set metric = 'event_result', aggregation = 'event_result', filters = excluded.filters, target = 1,
       updated_at = now();
alter table public.medal_definitions enable trigger medal_definitions_cambios;

select pg_temp.reemplazar('public.medal_preview(text,text,jsonb,numeric)', array[
  ['if p_aggregation in (''season_rank'', ''manual'') then',
   'if p_aggregation in (''season_rank'', ''manual'', ''event_result'') then']]);
select pg_temp.reemplazar('public.medal_metric_values(text,text,jsonb,uuid[])', array[
  ['if p_aggregation in (''season_rank'', ''manual'') then',
   'if p_aggregation in (''season_rank'', ''manual'', ''event_result'') then']]);
select pg_temp.reemplazar('public.medal_progress(uuid)', array[
  ['d.aggregation not in (''season_rank'', ''manual'')',
   'd.aggregation not in (''season_rank'', ''manual'', ''event_result'')']]);
select pg_temp.reemplazar('public.medals_award(uuid[],uuid[])', array[
  ['aggregation not in (''season_rank'', ''manual'')',
   'aggregation not in (''season_rank'', ''manual'', ''event_result'')']]);

-- =====================================================================================================
-- 3. event_medals_sync
-- =====================================================================================================
-- Clave para comparar el título de una medalla dada a mano con el nombre del torneo: mayúsculas, sin tildes ni signos,
-- y sin «Campeón (de)» o «Finalista (de)» al principio. «CAMPEON TORNEO TITAN» y «TORNEO TITAN» dan lo mismo;
-- «CAMPEON TORNEO TITAN 2», no.
create function public.medal_title_key(p text) returns text language sql immutable set search_path = public as $$
  select btrim(regexp_replace(
           regexp_replace(
             regexp_replace(translate(upper(coalesce(p, '')), 'ÁÉÍÓÚÜÑ', 'AEIOUUN'), '[^A-Z0-9]+', ' ', 'g'),
             '^ *(CAMPEONES|CAMPEON|SUBCAMPEON|FINALISTA)( DEL?)? ', ''),
           ' +', ' ', 'g'))
$$;

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

-- =====================================================================================================
-- 5. Avisos: se pueden apagar para la transacción
-- =====================================================================================================
select pg_temp.reemplazar('public.tg_notify_player_medals()', array[
  ['  if new.season_id is null then',
   '  if new.season_id is null and coalesce(current_setting(''cmleague.medals_quiet'', true), '''') <> ''on'' then -- (replanteo 114)']]);

-- =====================================================================================================
-- 6. Retroactivo, sin avisos
-- =====================================================================================================
set local cmleague.medals_quiet = 'on';
select event_medals_sync(id) from events where status = 'finished';
set local cmleague.medals_quiet = 'off';

commit;
