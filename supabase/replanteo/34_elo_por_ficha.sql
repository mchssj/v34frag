-- Replanteo 34: al sumar o quitar un SteamID de una ficha se recalcula solo el ELO de esa ficha
-- (plan docs/bitacora/2026-10-28-elo-por-ficha).
--   - elo_recompute_player: rehace la línea de tiempo de una clave de ELO (mixes con la probabilidad guardada en
--     win_prob, ajustes y temporadas) sin tocar a nadie más.
--   - approve_steam_request, link_steam_id y admin_remove_steam la usan en vez de elo_recompute_all.
--   - elo_recompute_all queda para los recálculos exactos (mix que llega tarde, deshacer un "fijar").
-- Necesita la 21 (desvincular), la 24 (temporadas) y la 25 (ajustes).
-- NO aplicar en producción antes del corte (ver README.md).
begin;

do $$
begin
  if to_regprocedure('public.elo_key(text)') is null or to_regprocedure('public.steam_attach(text, uuid, uuid)') is null
     or to_regprocedure('public.steam_detach(text)') is null or to_regprocedure('public.elo_apply_set(text, integer)') is null
     or to_regprocedure('public.season_reset_elo(integer, integer, integer)') is null or to_regclass('public.seasons') is null then
    raise exception 'replanteo 34: faltan las migraciones 15, 21, 24 o 25';
  end if;
  if to_regprocedure('public.elo_recompute_player(text, text[])') is not null then
    raise exception 'replanteo 34: elo_recompute_player ya existe (¿ya se aplicó?)';
  end if;
end $$;

-- Cierre o comienzo de temporada sobre una sola clave. Como elo_season_event.
create function public.elo_season_event_key(p_season uuid, p_close boolean, p_key text) returns void
  language plpgsql security definer set search_path = public as $$
declare s seasons%rowtype;
begin
  select * into s from seasons where id = p_season;
  if p_close then
    update player_elo set elo = season_reset_elo(elo, s.reset_pct, s.reset_floor), updated_at = now()
     where steam_id = p_key and elo > s.reset_floor;
  end if;
  update player_elo set peak_elo = elo, updated_at = now() where steam_id = p_key and peak_elo is distinct from elo;
end $$;

-- Rehace el ELO de una clave (el SteamID principal de una ficha, o un SteamID sin ficha) con sus mixes, ajustes y
-- temporadas, en el orden de elo_recompute_all. Cada mix usa la probabilidad guardada (win_prob), así que los demás
-- jugadores no cambian. p_from: otras claves cuya fila de player_elo era de esta identidad (se borran).
-- μ y σ: los de la fila con más mixes (no se pueden reproducir sin la fuerza de cada mix).
create function public.elo_recompute_player(p_key text, p_from text[] default '{}') returns integer
  language plpgsql security definer set search_path = public as $$
declare
  cfg    record;
  ev     record;
  r      record;
  ids    text[];
  v_mu   double precision;
  v_sig  double precision;
  v_elo  integer;
  v_new  integer;
  total  integer;
  wt     double precision;
  res    double precision;
  base   integer;
  bonus  integer;
  delta  integer;
  n      integer := 0;
begin
  if p_key is null then return 0; end if;
  p_key := elo_key(p_key);
  lock table player_elo in exclusive mode;   -- como elo_recompute_all
  perform set_config('v34.elo_recompute', 'on', true);
  select c.base, c.bonus_max, c.bonus_factor, c.elo_floor, c.start_elo, c.min_pct, c.full_pct into cfg from elo_config c where c.id = 1;
  if not found then
    select 30 as base, 5 as bonus_max, 10::numeric as bonus_factor, 100 as elo_floor, 1000 as start_elo,
           35 as min_pct, 90 as full_pct into cfg;
  end if;

  select coalesce(array_agg(a.steam_id), array[p_key]) into ids
    from player_steam_all a where a.player_id = (select id from players where steam_id = p_key);

  select e.mu, e.sigma into v_mu, v_sig from player_elo e
   where e.steam_id = any(ids || p_from) order by e.matches desc, e.steam_id = p_key desc limit 1;
  delete from player_elo where steam_id = any(ids || p_from);
  update match_player_stats set elo_before = null, elo_after = null, elo_delta = null
   where steam_id = any(ids) and elo_after is not null;

  if not exists (select 1 from match_player_stats where steam_id = any(ids) and win_prob is not null)
     and not exists (select 1 from elo_adjustments where steam_id = any(ids)) then
    perform set_config('v34.elo_recompute', 'off', true);
    return 0;
  end if;

  for ev in
    select * from (
      select coalesce(m.played_at, m.starts_at) at, 1 k, m.id mid, null::bigint aid, null::uuid sid
        from matches m
       where m.kind = 'mix' and m.status = 'finished'
         and exists (select 1 from match_player_stats s where s.match_id = m.id and s.steam_id = any(ids) and s.win_prob is not null)
      union all
      select applied_at, 0, null, id, null from elo_adjustments where steam_id = any(ids)
      union all
      select closed_at, 2, null, null, id from seasons where status = 'closed'
      union all
      select starts_at, 3, null, null, id from seasons
    ) e
    order by e.at, e.k, e.mid, e.aid, e.sid
  loop
    -- La fila nace con su primer mix o ajuste, como en elo_recompute_all: las temporadas anteriores no la tocan.
    if ev.k <= 1 and not exists (select 1 from player_elo where steam_id = p_key) then
      insert into player_elo(steam_id, elo, peak_elo) values (p_key, cfg.start_elo, cfg.start_elo);
      if v_mu is not null then
        update player_elo set mu = v_mu, sigma = v_sig where steam_id = p_key;
      end if;
    end if;
    if ev.k = 1 then
      -- Si dos SteamID de la ficha están en el mismo mix (vinculados a mano), cuenta el de más rondas.
      select s.id, s.team, s.rounds, s.rating, s.win_prob, m.winner_side, m.score1, m.score2 into r
        from match_player_stats s join matches m on m.id = s.match_id
       where s.match_id = ev.mid and s.steam_id = any(ids) and s.win_prob is not null
       order by s.rounds desc, s.id limit 1;
      select greatest(coalesce(r.score1, 0) + coalesce(r.score2, 0), coalesce(max(rounds), 0)) into total
        from match_player_stats where match_id = ev.mid and team in (1, 2);
      wt := elo_weight(r.rounds, total, cfg.min_pct, cfg.full_pct);
      continue when wt <= 0;

      res := case r.winner_side when r.team then 1 when 3 - r.team then 0 else 0.5 end;
      -- La misma cuenta que elo_apply_match, con la probabilidad guardada.
      base  := round(2 * cfg.base * (res - r.win_prob::double precision));
      bonus := greatest(-cfg.bonus_max, least(cfg.bonus_max, round((coalesce(r.rating, 1) - 1) * cfg.bonus_factor)::integer));
      delta := round((base + bonus) * wt);
      if res = 1 then delta := greatest(delta, 1); elsif res = 0 then delta := least(delta, -1); end if;

      select elo into v_elo from player_elo where steam_id = p_key;
      v_new := greatest(cfg.elo_floor, v_elo + delta);
      update player_elo set elo = v_new, peak_elo = greatest(peak_elo, v_new), matches = matches + 1, updated_at = now()
       where steam_id = p_key;
      update match_player_stats set elo_before = v_elo, elo_after = v_new, elo_delta = v_new - v_elo where id = r.id;
      n := n + 1;
    elsif ev.k = 0 then
      perform elo_apply_adjustment_row(ev.aid);
    else
      perform elo_season_event_key(ev.sid, ev.k = 2, p_key);
    end if;
  end loop;

  perform set_config('v34.elo_recompute', 'off', true);
  return n;
end $$;
revoke all on function public.elo_season_event_key(uuid, boolean, text), public.elo_recompute_player(text, text[])
  from public, anon, authenticated;

-- Después de sumar un SteamID adicional: la ficha (con la fila del SteamID nuevo).
create function public.elo_after_attach(p_steam text) returns void
  language plpgsql security definer set search_path = public as $$
begin
  perform elo_recompute_player(elo_key(p_steam), array[p_steam]);
end $$;

-- Quita un SteamID de su ficha y, si la ficha tenía varios, recalcula la ficha (que conserva su μ y σ aunque cambie
-- de principal) y el SteamID que queda libre (arranca como un jugador nuevo).
create function public.steam_detach_elo(p_steam text) returns void
  language plpgsql security definer set search_path = public as $$
declare v_player uuid; v_old text;
begin
  v_player := steam_owner(p_steam);
  v_old := elo_key(p_steam);
  if steam_detach(p_steam) then
    perform elo_recompute_player((select steam_id from players where id = v_player), array[v_old]);
    perform elo_recompute_player(p_steam);
  end if;
end $$;
revoke all on function public.elo_after_attach(text), public.steam_detach_elo(text) from public, anon, authenticated;

create function pg_temp.reemplazar(fn regprocedure, cambios text[][]) returns void language plpgsql as $$
declare d text := pg_get_functiondef(fn); i int;
begin
  for i in 1 .. array_length(cambios, 1) loop
    if position(cambios[i][1] in d) = 0 then
      raise exception 'replanteo 34: en % no se encontró: %', fn, left(cambios[i][1], 80);
    end if;
    d := replace(d, cambios[i][1], cambios[i][2]);
  end loop;
  execute d;
end $$;

select pg_temp.reemplazar('public.approve_steam_request(bigint)', array[
  ['    if steam_detach(r.steam_id) then perform elo_recompute_all(); end if;',
   '    perform steam_detach_elo(r.steam_id); -- (replanteo 34) solo esa ficha'],
  ['  if steam_attach(r.steam_id, r.player_id, auth.uid()) then perform elo_recompute_all(); end if;',
   '  if steam_attach(r.steam_id, r.player_id, auth.uid()) then perform elo_after_attach(r.steam_id); end if; -- (replanteo 34)']
]);
select pg_temp.reemplazar('public.link_steam_id(text, uuid)', array[
  ['    if steam_detach(s64) then perform elo_recompute_all(); end if;',
   '    perform steam_detach_elo(s64); -- (replanteo 34) solo esa ficha'],
  ['  if steam_attach(s64, p_player, auth.uid()) then perform elo_recompute_all(); end if;',
   '  if steam_attach(s64, p_player, auth.uid()) then perform elo_after_attach(s64); end if; -- (replanteo 34)']
]);
select pg_temp.reemplazar('public.admin_remove_steam(text)', array[
  ['  if steam_detach(p_steam) then perform elo_recompute_all(); end if;',
   '  perform steam_detach_elo(p_steam); -- (replanteo 34) solo esa ficha']
]);

commit;
