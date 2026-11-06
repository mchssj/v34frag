-- Inversa del replanteo 79 (medallas configurables). Borra las definiciones, la cola y el motor. Las medallas que dio el
-- motor se borran (sin su definición no tienen dibujo); las de temporada y las manuales quedan con su título (y las
-- manuales recuperan el emoji 🏆 que tenían).
begin;

create function pg_temp.reemplazar(fn regprocedure, cambios text[][]) returns void language plpgsql as $$
declare d text := pg_get_functiondef(fn); i int;
begin
  for i in 1 .. array_length(cambios, 1) loop
    if position(cambios[i][1] in d) = 0 then
      raise exception 'inversa 79: en % no se encontró: %', fn, left(cambios[i][1], 80);
    end if;
    d := replace(d, cambios[i][1], cambios[i][2]);
  end loop;
  execute d;
end $$;

select pg_temp.reemplazar('public.season_close_run(uuid, uuid)', array[
  [E'insert into player_medals(player_id, title, icon, season_id, rank, tier, definition_id, source)\n  select player_id, s.name || '' · #'' || rank, icon, s.id, rank, tier, (select d.id from medal_definitions d where d.key = season_tier_definition(s.tiers, rank, s.top_n)), ''season'' -- (replanteo 79)\n',
   E'insert into player_medals(player_id, title, icon, season_id, rank, tier)\n  select player_id, s.name || '' · #'' || rank, icon, s.id, rank, tier\n']
]);
select pg_temp.reemplazar('public.tg_notify_season_standings()', array[
  ['jsonb_build_object(''name'', new.tier, ''design'', (select medal_design(d, new.rank, s.number) from medal_definitions d where d.key = season_tier_definition(s.tiers, new.rank, s.top_n)))',
   'jsonb_build_object(''name'', new.tier, ''icon'', new.icon)']
]);

create or replace function public.tg_notify_player_medals() returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.season_id is null then
    perform notify(users_of_players(array[new.player_id]), 'medal_granted', jsonb_build_object('title', new.title, 'icon', new.icon));
  end if;
  return null;
end $$;

drop trigger season_config_tier_definitions on public.season_config;
drop trigger seasons_tier_definitions on public.seasons;
drop function public.tg_season_tier_definitions();

-- Tramos sin definición; los que no tenían emoji toman uno.
create function pg_temp.sin_definiciones(p jsonb) returns jsonb language sql as $$
  select jsonb_agg((t - 'definition') || case when coalesce(jsonb_typeof(t->'icon'), 'null') = 'null' then '{"icon":"🏅"}'::jsonb else '{}'::jsonb end order by ord)
    from jsonb_array_elements(p) with ordinality as x(t, ord) $$;
update public.season_config set tiers = pg_temp.sin_definiciones(tiers);
update public.seasons set tiers = pg_temp.sin_definiciones(tiers) where tiers::text like '%"definition"%';

create or replace function public.season_tiers_ok(p jsonb) returns boolean language plpgsql immutable as $$
declare
  t      jsonb;
  v_next integer := 1;
  v_open boolean := false;
begin
  if p is null or jsonb_typeof(p) is distinct from 'array' or jsonb_array_length(p) not between 1 and 20 then return false; end if;
  for t in select value from jsonb_array_elements(p) loop
    if v_open then return false; end if;   -- después del tramo abierto no puede haber otro
    if jsonb_typeof(t) is distinct from 'object'
       or exists (select 1 from jsonb_object_keys(t) k where k not in ('from', 'to', 'name', 'icon'))
       or jsonb_typeof(t->'from') is distinct from 'number' or (t->>'from')::numeric is distinct from v_next
       or jsonb_typeof(t->'name') is distinct from 'string' or length(btrim(t->>'name')) not between 1 and 40
       or jsonb_typeof(t->'icon') is distinct from 'string' or length(btrim(t->>'icon')) not between 1 and 8 then
      return false;
    end if;
    if coalesce(jsonb_typeof(t->'to'), 'null') = 'null' then
      v_open := true;
    elsif jsonb_typeof(t->'to') <> 'number' or (t->>'to')::numeric <> trunc((t->>'to')::numeric) or (t->>'to')::numeric < v_next then
      return false;
    else
      v_next := (t->>'to')::integer + 1;
    end if;
  end loop;
  return v_open;
end $$;
drop function public.season_tier_definition(jsonb, integer, integer);

drop trigger medal_queue_stats_ins on public.match_player_stats;
drop trigger medal_queue_stats_upd on public.match_player_stats;
drop trigger medal_queue_match on public.matches;
drop function public.tg_medal_queue_stats();
drop function public.tg_medal_queue_match();
drop function public.medals_evaluate_pending(integer);
drop function if exists public.medal_evaluate_now(uuid[]);
drop function public.medal_enqueue(uuid[]);
drop table public.medal_queue;
drop function public.medal_progress(uuid);
drop function public.medal_preview(text, text, jsonb, numeric);
drop function public.medal_archive(uuid);
drop function public.medal_activate(uuid, boolean);
drop function public.medals_evaluate_all(uuid);
drop function public.medals_award(uuid[], uuid[]);
drop function public.medal_metric_values(text, text, jsonb, uuid[]);
drop trigger seasons_medal_stats_start on public.seasons;
drop function public.tg_medal_stats_start();
drop function public.medal_stats_since();

drop view public.medal_holders;
delete from public.player_medals where source = 'auto';
update public.player_medals set icon = coalesce(icon, '🏆') where source = 'admin';
drop index public.player_medals_auto;
alter table public.player_medals drop column definition_id, drop column source;

drop function public.medal_design(public.medal_definitions, integer, integer);
drop table public.medal_definitions;
drop function public.tg_medal_definitions();

notify pgrst, 'reload schema';
commit;
