-- 142: desglose de tu ELO para VIP (bitácora docs/bitacora/2026-11-24-desglose-elo-vip, Kyan y Daniel 2026-11-24).
--
-- my_elo_breakdown(tope, desde): los mixes con ELO de la ficha de la sesión, del más nuevo al más viejo, con la configuración
-- vigente. Con VIP, cada mix de la fórmula por partida (100) trae los pasos de la cuenta, hechos con las mismas funciones
-- que elo_apply_match (elo_weight, mm_elo_abandoned, mm_elo_delta y elo_min_for) y con lo que quedó guardado (win_prob,
-- elo_mult y elo_scale). Sin VIP, solo el cambio. `exact`: si la cuenta con la configuración de hoy da el cambio guardado
-- (no, si un admin cambió la configuración después). Los mixes de la fórmula anterior no traen pasos (`steps` null).
-- Si cambia elo_apply_match, hay que cambiar esta función.
-- Inversa: docs/bitacora/2026-10-14-replanteo-modelo-datos/reversas/142_desglose_de_elo.sql.
begin;

do $$
begin
  if to_regprocedure('public.my_elo_breakdown(integer, integer)') is not null then raise exception 'replanteo 142: ya se aplicó'; end if;
  if not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'match_player_stats' and column_name = 'elo_mult') then
    raise exception 'replanteo 142: falta la 100';
  end if;
end $$;

create function public.my_elo_breakdown(p_limit integer default 20, p_offset integer default 0) returns jsonb
  language plpgsql stable security definer set search_path = public as $$
declare
  v_player uuid;
  v_vip    boolean := is_vip(auth.uid());
  cfg      elo_config%rowtype;
  v_out    jsonb;
begin
  if auth.uid() is null then raise exception 'Para ver tu ELO tienes que iniciar sesión' using errcode = '28000'; end if;
  select id into v_player from players where user_id = auth.uid();
  select * into cfg from elo_config where id = 1;

  with mios as (
    select s.id, s.match_id, s.steam_id, s.team, s.rounds, s.rating, s.elo_before, s.elo_after, s.elo_delta, s.win_prob, s.elo_mult, s.elo_scale,
           m.map, m.score1, m.score2, m.winner_side, coalesce(m.played_at, m.starts_at) as at
      from match_player_stats s join matches m on m.id = s.match_id
     where s.player_id = v_player and s.elo_after is not null and m.kind = 'mix' and m.status = 'finished'
  ), pag as materialized (
    select * from mios order by at desc nulls last, match_id desc
     limit greatest(1, least(p_limit, 50)) offset greatest(0, p_offset)
  ), a as (
    select p.*, t.total, mm_elo_abandoned(p.match_id, elo_key(p.steam_id)) as aband
      from pag p
      cross join lateral (
        select greatest(coalesce(p.score1, 0) + coalesce(p.score2, 0), coalesce(max(x.rounds), 0)) as total
          from match_player_stats x where x.match_id = p.match_id and x.team in (1, 2)) t
  ), b as (
    select a.*,
           case when a.aband then 1 else elo_weight(a.rounds, a.total, cfg.min_pct, cfg.full_pct) end as wt,
           case when a.aband then 0::double precision when a.winner_side in (1, 2) then (a.winner_side = a.team)::int::double precision else 0.5 end as res,
           elo_min_for(a.match_id) as vmin
      from a
  ), c as (
    select b.*, 2 * cfg.base * (b.res - b.win_prob::double precision) as base,
           round(2 * cfg.base * (b.res - b.win_prob::double precision) * b.elo_mult::double precision * b.wt)::int as d0
      from b
  ), d as (
    select c.*, case when c.elo_mult is not null
                     then coalesce(mm_elo_delta(c.match_id, elo_key(c.steam_id), c.team, c.res, c.win_prob::double precision, c.d0), c.d0) end as dd
      from c
  ), e as (
    select d.*, case when d.aband then d.dd else round(d.dd * d.elo_scale)::int end as d2,
           case when d.res = 0.5 then 0 else greatest(round(d.vmin * d.wt)::int, 1) end as mn
      from d
  ), g as (
    select e.*, case when e.res = 1 then greatest(e.d2, e.mn) when e.res = 0 then least(e.d2, -e.mn) else e.d2 end as d3 from e
  )
  select jsonb_build_object(
    'vip', v_vip,
    'total', (select count(*) from mios),
    'config', case when v_vip then jsonb_build_object(
      'base', cfg.base, 'mult_win_min', cfg.mult_win_min, 'mult_win_max', cfg.mult_win_max, 'mult_loss_min', cfg.mult_loss_min,
      'mult_loss_max', cfg.mult_loss_max, 'team_cap', cfg.team_cap, 'min_delta', cfg.min_delta, 'elo_floor', cfg.elo_floor,
      'min_pct', cfg.min_pct, 'full_pct', cfg.full_pct) end,
    'items', coalesce((select jsonb_agg(jsonb_build_object(
      'match_id', g.match_id, 'map', g.map, 'at', g.at,
      'own_score', case when g.team = 1 then g.score1 else g.score2 end,
      'other_score', case when g.team = 1 then g.score2 else g.score1 end,
      'result', case when g.winner_side in (1, 2) then case when g.winner_side = g.team then 'win' else 'loss' end else 'draw' end,
      'elo_before', g.elo_before, 'elo_after', g.elo_after, 'elo_delta', g.elo_delta,
      'formula', case when g.elo_mult is null then 'old' else 'match' end,
      'steps', case when v_vip and g.elo_mult is not null then jsonb_build_object(
        'abandoned', g.aband, 'counted_as', case when g.res = 1 then 'win' when g.res = 0 then 'loss' else 'draw' end,
        'win_prob', g.win_prob, 'base', round(g.base::numeric, 2), 'rating', g.rating, 'mult', g.elo_mult,
        'rounds', g.rounds, 'total_rounds', g.total, 'weight', round(g.wt::numeric, 4),
        'raw', g.d0, 'adjusted', g.dd, 'scale', g.elo_scale, 'scaled', g.d2,
        'min', g.mn, 'after_min', g.d3, 'floor_hit', g.elo_before + g.d3 < cfg.elo_floor,
        'exact', greatest(cfg.elo_floor, g.elo_before + g.d3) - g.elo_before = g.elo_delta) end)
      order by g.at desc nulls last, g.match_id desc) from g), '[]'::jsonb))
    into v_out;
  return v_out;
end $$;
comment on function public.my_elo_breakdown(integer, integer) is 'Desglose del ELO de los mixes de la ficha de la sesión: los pasos, con VIP (replanteo 142)';
revoke all on function public.my_elo_breakdown(integer, integer) from public, anon, authenticated;
grant execute on function public.my_elo_breakdown(integer, integer) to authenticated;

notify pgrst, 'reload schema';

commit;
