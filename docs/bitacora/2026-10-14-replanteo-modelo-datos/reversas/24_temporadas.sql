-- Inversa de supabase/replanteo/24_temporadas.sql: deja el ELO y las medallas como después de la 23.
-- Se borran las temporadas, sus fotos y sus medallas. El ELO queda como lo dejaron los cierres: para sacar los
-- reinicios, recalcular después (select elo_recompute_all()).
begin;

do $$
begin
  if to_regclass('public.seasons') is null then
    raise exception 'inversa 24: no existe seasons (¿no se aplicó la 24?)';
  end if;
end $$;

create function pg_temp.reemplazar(fn regprocedure, cambios text[][]) returns void language plpgsql as $$
declare d text := pg_get_functiondef(fn); i int;
begin
  for i in 1 .. array_length(cambios, 1) loop
    if position(cambios[i][1] in d) = 0 then
      raise exception 'inversa 24: en % no se encontró: %', fn, left(cambios[i][1], 80);
    end if;
    d := replace(d, cambios[i][1], cambios[i][2]);
  end loop;
  execute d;
end $$;

select pg_temp.reemplazar('public.elo_apply_match(uuid)', array[
  [E'  -- (replanteo 24) anterior a un cierre de temporada: recalcula todo, para que el reinicio quede después del mix\n' ||
   E'  if current_setting(''v34.elo_recompute'', true) is distinct from ''on''\n' ||
   E'     and exists (select 1 from seasons s, matches x\n' ||
   E'                  where x.id = p_match and coalesce(s.closed_at, s.starts_at) >= coalesce(x.played_at, x.starts_at)) then\n' ||
   E'    perform elo_recompute_all();\n' ||
   E'    return;\n' ||
   E'  end if;\n',
   '']
]);

-- La de 20261015210000_elo_ajustes.sql.
create or replace function public.elo_recompute_all()
returns integer language plpgsql security definer set search_path = public as $$
declare
  ev record;
  n  integer := 0;
begin
  -- Desde la web solo un admin; desde el SQL Editor no hay usuario.
  if auth.uid() is not null and not is_admin() then
    raise exception 'Solo un admin puede recalcular el ELO' using errcode = '42501';
  end if;
  lock table player_elo in exclusive mode;   -- espera a los envíos en curso y frena los nuevos hasta terminar

  delete from player_elo where true;
  update match_player_stats set elo_before = null, elo_after = null, elo_delta = null, win_prob = null
   where elo_after is not null or win_prob is not null;

  for ev in
    select * from (
      select coalesce(played_at, starts_at) at, 1 k, id mid, null::bigint aid, null::text steam_id, null::integer delta
        from matches where kind = 'mix' and status = 'finished'
      union all
      select applied_at, 0, null, id, steam_id, delta from elo_adjustments
    ) e
    order by e.at, e.k, e.mid, e.aid
  loop
    if ev.k = 1 then
      perform elo_apply_match(ev.mid);
      n := n + 1;
    else
      perform elo_apply_adjustment(ev.steam_id, ev.delta);
    end if;
  end loop;
  return n;
end $$;

drop function public.season_preview_summary(integer, integer, integer, integer);
drop function public.season_preview(integer, integer, integer, integer);
drop function public.season_close_due();
drop function public.season_close(uuid, text);
drop function public.season_close_run(uuid, uuid);
drop function public.set_season_config(integer, integer, integer, integer, integer, jsonb);
drop function public.season_update(uuid, text, timestamptz, integer, integer, integer, integer, jsonb);
drop function public.season_start(text, timestamptz);
drop function public.elo_season_event(uuid, boolean);
drop view public.player_season_list;
drop view public.season_list;
drop view public.season_standings_list;
drop view public.season_live_standings;
drop function public.season_rank(timestamptz, timestamptz, integer);

delete from public.player_medals where season_id is not null;
drop index public.player_medals_season;
alter table public.player_medals
  drop constraint player_medals_temporada,
  drop column season_id,
  drop column rank,
  drop column tier;

drop table public.season_standings;
drop table public.seasons;
drop table public.season_config;

drop function public.season_check(integer, integer, integer, integer, jsonb);
drop function public.season_default_end(timestamptz, integer);
drop function public.season_reset_elo(integer, integer, integer);
drop function public.season_tier(jsonb, integer, integer);
drop function public.season_tiers_ok(jsonb);

commit;
