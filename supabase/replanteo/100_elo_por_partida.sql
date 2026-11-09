-- 100: el ELO se gana en la partida que jugaste (bitácora docs/bitacora/2026-11-09-elo-por-partida/, Kyan y Daniel 2026-11-09).
--
-- Desde elo_config.formula_from (inicio de la Temporada 2), en cada mix:
--   probabilidad  p = 1 / (1 + 10^((ELO rival − ELO propio) / 400)), con el ELO visible promedio de cada equipo
--                 (ponderado por la participación; el que abandona cuenta 1). Sin mu/sigma ni el rating general.
--   base          2 × base × (resultado − p)   (base 20: K 40, ±20 con equipos parejos)
--   multiplicador gana: rating del mix entre mult_win_min y mult_win_max (0,75 a 1,5)
--                 pierde: 2 − rating entre mult_loss_min y mult_loss_max (0,5 a 1,25); empate: 1
--   delta         base × multiplicador × peso, después mm_elo_delta (abandono y rendición, como antes)
--   tope          si en un equipo alguien (sin contar al que abandona) pasa de team_cap (30), todo el equipo se
--                 escala en la misma proporción
--   mínimo        min_delta × peso (10) en los mixes terminados con ganador (elo_min_for); ±1 en los interrumpidos
--                 (end_reason = 'crash'); nada en los empates
-- Los mixes anteriores a formula_from siguen con la fórmula de antes (TrueSkill + bonus). mu y sigma se siguen
-- actualizando, pero ya no deciden el ELO. El ajuste manual del armado (mm_balance_overrides) no entra.
--
-- match_player_stats.elo_mult y elo_scale guardan el multiplicador y el factor del tope, y win_prob la probabilidad
-- (redondeada a 4 decimales, la misma que usa el cálculo): elo_recompute_player rehace la cuenta sin el resto del equipo.
--
-- Respaldo de las funciones y de la configuración en replanteo100_funciones, para la inversa.
-- Después de aplicarla: notify pgrst y elo_recompute_all().

begin;

create table public.replanteo100_funciones (nombre text primary key, def text not null, extra jsonb);
alter table public.replanteo100_funciones enable row level security;
insert into public.replanteo100_funciones(nombre, def)
select p.proname, pg_get_functiondef(p.oid) from pg_proc p join pg_namespace n on n.oid = p.pronamespace
 where n.nspname = 'public' and p.proname in ('elo_apply_match', 'elo_recompute_player', 'mm_elo_stake', 'elo_set_config');
do $$ begin
  if (select count(*) from public.replanteo100_funciones) <> 4 then
    raise exception 'replanteo 100: falta alguna función para respaldar (¿hay sobrecargas?)';
  end if;
  if not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'elo_config' and column_name = 'min_delta') then
    raise exception 'replanteo 100: falta la 98';
  end if;
end $$;
insert into public.replanteo100_funciones(nombre, def, extra)
select 'elo_config', '', jsonb_build_object('base', base, 'min_delta', min_delta) from public.elo_config where id = 1;

alter table public.elo_config
  add column mult_win_min  numeric(4, 2) not null default 0.75 check (mult_win_min between 0.1 and 1),
  add column mult_win_max  numeric(4, 2) not null default 1.5  check (mult_win_max between 1 and 3),
  add column mult_loss_min numeric(4, 2) not null default 0.5  check (mult_loss_min between 0.1 and 1),
  add column mult_loss_max numeric(4, 2) not null default 1.25 check (mult_loss_max between 1 and 3),
  add column team_cap      integer not null default 30 check (team_cap between 5 and 200),
  add column formula_from  timestamptz;
comment on column public.elo_config.mult_win_min is 'Multiplicador mínimo del que gana (su rating del mix, acotado). Replanteo 100';
comment on column public.elo_config.mult_win_max is 'Multiplicador máximo del que gana. Replanteo 100';
comment on column public.elo_config.mult_loss_min is 'Multiplicador mínimo del que pierde (2 − su rating, acotado). Replanteo 100';
comment on column public.elo_config.mult_loss_max is 'Multiplicador máximo del que pierde. Replanteo 100';
comment on column public.elo_config.team_cap is 'Tope por equipo: si alguien lo pasa, todo el equipo se escala. Replanteo 100';
comment on column public.elo_config.formula_from is 'Desde cuándo vale la fórmula por partida (played_at del mix; null = nunca). Replanteo 100';
update public.elo_config
   set base = 20, min_delta = 10, formula_from = (select starts_at from public.seasons where number = 2)
 where id = 1;

alter table public.match_player_stats
  add column elo_mult  numeric(4, 2),
  add column elo_scale numeric(6, 4);
comment on column public.match_player_stats.elo_mult is 'Multiplicador del ELO por su rating del mix (fórmula de la 100)';
comment on column public.match_player_stats.elo_scale is 'Factor del tope por equipo (1 si no actuó; fórmula de la 100)';

-- El recálculo limpia también las columnas nuevas.
create or replace function public.tg_mps_elo_clear_extra() returns trigger language plpgsql as $$
begin
  if new.elo_after is null and new.win_prob is null then
    new.elo_mult := null;
    new.elo_scale := null;
  end if;
  return new;
end $$;
create trigger match_player_stats_elo_clear_extra before update of elo_after, win_prob on public.match_player_stats
  for each row execute function public.tg_mps_elo_clear_extra();

---------------------------------------------------------------------------------------------------- elo_apply_match
create or replace function public.elo_apply_match(p_match uuid) returns void
  language plpgsql security definer set search_path = public as $$
declare
  c_mu0   constant double precision := 25;          -- jugador nuevo / sin SteamID
  c_sig0  constant double precision := 25.0 / 3;
  c_beta  constant double precision := 25.0 / 6;    -- σ₀ / 2
  c_tau   constant double precision := 25.0 / 300;  -- σ₀ / 100
  cfg     record;
  m       record;
  r       record;
  ids     text[];
  total   integer;
  n1      integer;
  n2      integer;
  mu1     double precision;
  mu2     double precision;
  s2_tot  double precision;
  c       double precision;
  p_ts    double precision;   -- probabilidad de TrueSkill (fórmula vieja y actualización de mu/sigma)
  p1      double precision;   -- probabilidad por ELO visible (fórmula de la 100)
  e1      double precision;
  e2      double precision;
  res1    double precision;
  t       double precision;
  v       double precision;
  w       double precision;
  s2      double precision;
  p_team  double precision;
  res     double precision;
  base    integer;
  bonus   integer;
  delta   integer;
  new_elo integer;
  new_mu  double precision;
  v_min   integer;
  v_new   boolean;
begin
  select id, kind, status, winner_side, score1, score2, played_at, starts_at into m from matches where id = p_match for update;
  select c.base, c.bonus_max, c.bonus_factor, c.elo_floor, c.start_elo, c.min_pct, c.full_pct,
         c.mult_win_min, c.mult_win_max, c.mult_loss_min, c.mult_loss_max, c.team_cap, c.formula_from
    into cfg from elo_config c where c.id = 1;
  if not found then
    select 30 as base, 5 as bonus_max, 10::numeric as bonus_factor, 100 as elo_floor, 1000 as start_elo, 35 as min_pct, 90 as full_pct,
           0.75::numeric as mult_win_min, 1.5::numeric as mult_win_max, 0.5::numeric as mult_loss_min, 1.25::numeric as mult_loss_max,
           30 as team_cap, null::timestamptz as formula_from into cfg;
  end if;
  if m.id is null or m.kind <> 'mix' or m.status <> 'finished' then return; end if;
  -- (replanteo 88) los mapas de una PCW no dan ELO
  if exists (select 1 from matches g join matches p on p.id = g.parent_match_id where g.id = p_match and p.kind = 'pcw') then return; end if;
  if exists (select 1 from match_player_stats where match_id = p_match and elo_after is not null) then return; end if;
  -- (replanteo 24) anterior a un cierre de temporada: recalcula todo, para que el reinicio quede después del mix
  if current_setting('v34.elo_recompute', true) is distinct from 'on'
     and exists (select 1 from seasons s, matches x
                  where x.id = p_match and coalesce(s.closed_at, s.starts_at) >= coalesce(x.played_at, x.starts_at)) then
    perform elo_recompute_all();
    return;
  end if;

  select greatest(coalesce(m.score1, 0) + coalesce(m.score2, 0), coalesce(max(rounds), 0)) into total
    from match_player_stats where match_id = p_match and team in (1, 2);
  if total <= 0 then return; end if;

  select array_agg(distinct elo_key(steam_id) order by elo_key(steam_id)) into ids
    from match_player_stats
   where match_id = p_match and steam_id ~ '^(7656119[0-9]{10}|765612[0-9]{11})$' and team in (1, 2)
     and (elo_weight(rounds, total, cfg.min_pct, cfg.full_pct) > 0 or mm_elo_abandoned(p_match, elo_key(steam_id)));
  if ids is null then return; end if;

  insert into player_elo(steam_id, elo, peak_elo) select x, cfg.start_elo, cfg.start_elo from unnest(ids) x
  on conflict (steam_id) do nothing;
  perform 1 from player_elo where steam_id = any(ids) order by steam_id for update;

  -- TrueSkill: sigue actualizando mu/sigma (y decide el ELO de los mixes anteriores a formula_from).
  select count(*) filter (where x.team = 1), count(*) filter (where x.team = 2),
         coalesce(sum(x.wt * x.mu) filter (where x.team = 1), 0),
         coalesce(sum(x.wt * x.mu) filter (where x.team = 2), 0),
         sum(x.wt * x.wt * (x.sigma ^ 2 + c_tau * c_tau + c_beta * c_beta))
    into n1, n2, mu1, mu2, s2_tot
    from (select s.team, case when mm_elo_abandoned(p_match, elo_key(s.steam_id)) then 1 else elo_weight(s.rounds, total, cfg.min_pct, cfg.full_pct) end wt,
                 coalesce(e.mu, c_mu0) mu, coalesce(e.sigma, c_sig0) sigma
            from match_player_stats s left join player_elo e on e.steam_id = elo_key(s.steam_id)
           where s.match_id = p_match and s.team in (1, 2)) x
   where x.wt > 0;
  if n1 = 0 or n2 = 0 then return; end if;

  c    := sqrt(s2_tot);
  p_ts := csstv_ncdf((mu1 - mu2) / c);
  res1 := case m.winner_side when 1 then 1 when 2 then 0 else 0.5 end;
  if res1 <> 0.5 then
    t := case when res1 = 1 then mu1 - mu2 else mu2 - mu1 end / c;
    if t < -4 then
      v := -t - 1 / t;
    else
      v := csstv_npdf(t) / csstv_ncdf(t);
    end if;
    w := v * (v + t);
  end if;

  v_min := elo_min_for(p_match);
  v_new := cfg.formula_from is not null and coalesce(m.played_at, m.starts_at) >= cfg.formula_from;

  if not v_new then
    -------------------------------------------------------------------- fórmula anterior (TrueSkill + bonus, replanteo 98)
    for r in
      select s.id, s.team, s.rating, e.steam_id, e.elo, e.peak_elo, e.mu, e.sigma,
             case when mm_elo_abandoned(p_match, elo_key(s.steam_id)) then 1 else elo_weight(s.rounds, total, cfg.min_pct, cfg.full_pct) end wt
        from match_player_stats s join player_elo e on e.steam_id = elo_key(s.steam_id)
       where s.match_id = p_match and elo_key(s.steam_id) = any(ids)
    loop
      p_team := case when r.team = 1 then p_ts else 1 - p_ts end;
      res    := case when mm_elo_abandoned(p_match, r.steam_id) then 0 when r.team = 1 then res1 else 1 - res1 end;
      base  := round(2 * cfg.base * (res - p_team));
      if v_min > 0 and res = 1 then base := greatest(base, v_min); elsif v_min > 0 and res = 0 then base := least(base, -v_min); end if;
      bonus := greatest(-cfg.bonus_max, least(cfg.bonus_max, round((coalesce(r.rating, 1) - 1) * cfg.bonus_factor)::integer));
      delta := round((base + bonus) * r.wt);
      if res = 1 then delta := greatest(delta, 1); elsif res = 0 then delta := least(delta, -1); end if;
      delta := coalesce(mm_elo_delta(p_match, r.steam_id, r.team, res, p_team, delta), delta);
      if v_min > 0 and res = 1 then delta := greatest(delta, round(v_min * r.wt)::int); elsif v_min > 0 and res = 0 then delta := least(delta, -round(v_min * r.wt)::int); end if;
      new_elo := greatest(cfg.elo_floor, r.elo + delta);

      s2     := r.sigma * r.sigma + c_tau * c_tau;
      new_mu := r.mu;
      if res = 1 then new_mu := r.mu + r.wt * s2 / c * coalesce(v, 0);
      elsif res = 0 then new_mu := r.mu - r.wt * s2 / c * coalesce(v, 0); end if;
      if res <> 0.5 then s2 := s2 * greatest(1 - r.wt * r.wt * s2 / (c * c) * coalesce(w, 0), 0.0001); end if;

      update player_elo
         set elo = new_elo, peak_elo = greatest(r.peak_elo, new_elo), mu = new_mu, sigma = sqrt(s2),
             matches = matches + 1, updated_at = now()
       where steam_id = r.steam_id;
      update match_player_stats
         set elo_before = r.elo, elo_after = new_elo, elo_delta = new_elo - r.elo, win_prob = round(p_team::numeric, 4)
       where id = r.id;
    end loop;
    return;
  end if;

  ---------------------------------------------------------------------- fórmula por partida (replanteo 100)
  -- Fuerza de cada equipo: ELO visible promedio, ponderado por la participación.
  select sum(x.wt * x.elo) filter (where x.team = 1) / nullif(sum(x.wt) filter (where x.team = 1), 0),
         sum(x.wt * x.elo) filter (where x.team = 2) / nullif(sum(x.wt) filter (where x.team = 2), 0)
    into e1, e2
    from (select s.team, case when mm_elo_abandoned(p_match, elo_key(s.steam_id)) then 1 else elo_weight(s.rounds, total, cfg.min_pct, cfg.full_pct) end wt,
                 coalesce(e.elo, cfg.start_elo)::double precision elo
            from match_player_stats s left join player_elo e on e.steam_id = elo_key(s.steam_id)
           where s.match_id = p_match and s.team in (1, 2)) x
   where x.wt > 0;
  p1 := round((1 / (1 + power(10::double precision, (coalesce(e2, cfg.start_elo) - coalesce(e1, cfg.start_elo)) / 400)))::numeric, 4);

  for r in
    with x as (
      select s.id, s.team, s.rating, e.steam_id, e.elo, e.peak_elo, e.mu, e.sigma,
             mm_elo_abandoned(p_match, e.steam_id) aband,
             case when mm_elo_abandoned(p_match, e.steam_id) then 1 else elo_weight(s.rounds, total, cfg.min_pct, cfg.full_pct) end wt
        from match_player_stats s join player_elo e on e.steam_id = elo_key(s.steam_id)
       where s.match_id = p_match and elo_key(s.steam_id) = any(ids)
    ), y as (
      select x.*,
             case when x.aband then 0 when x.team = 1 then res1 else 1 - res1 end res,
             round((case when x.team = 1 then p1 else 1 - p1 end)::numeric, 4)::double precision pt
        from x
    ), z as (
      select y.*,
             (case when y.res = 1 then least(cfg.mult_win_max, greatest(cfg.mult_win_min, coalesce(y.rating, 1)))
                   when y.res = 0 then least(cfg.mult_loss_max, greatest(cfg.mult_loss_min, 2 - coalesce(y.rating, 1)))
                   else 1 end)::numeric(4, 2) mult
        from y
    ), d as (
      select z.*, round(2 * cfg.base * (z.res - z.pt) * z.mult::double precision * z.wt)::int d0 from z
    ), d1 as (
      select d.*, coalesce(mm_elo_delta(p_match, d.steam_id, d.team, d.res, d.pt, d.d0), d.d0) dd from d
    )
    select d1.*,
           case when not d1.aband and max(abs(d1.dd)) filter (where not d1.aband) over (partition by d1.team) > cfg.team_cap
                then round(cfg.team_cap::numeric / max(abs(d1.dd)) filter (where not d1.aband) over (partition by d1.team), 4)
                else 1 end::numeric(6, 4) scale
      from d1
  loop
    delta := case when r.aband then r.dd else round(r.dd * r.scale)::int end;
    if r.res = 1 then delta := greatest(delta, greatest(round(v_min * r.wt)::int, 1));
    elsif r.res = 0 then delta := least(delta, -greatest(round(v_min * r.wt)::int, 1)); end if;
    new_elo := greatest(cfg.elo_floor, r.elo + delta);

    s2     := r.sigma * r.sigma + c_tau * c_tau;
    new_mu := r.mu;
    if r.res = 1 then new_mu := r.mu + r.wt * s2 / c * coalesce(v, 0);
    elsif r.res = 0 then new_mu := r.mu - r.wt * s2 / c * coalesce(v, 0); end if;
    if r.res <> 0.5 then s2 := s2 * greatest(1 - r.wt * r.wt * s2 / (c * c) * coalesce(w, 0), 0.0001); end if;

    update player_elo
       set elo = new_elo, peak_elo = greatest(r.peak_elo, new_elo), mu = new_mu, sigma = sqrt(s2),
           matches = matches + 1, updated_at = now()
     where steam_id = r.steam_id;
    update match_player_stats
       set elo_before = r.elo, elo_after = new_elo, elo_delta = new_elo - r.elo, win_prob = r.pt,
           elo_mult = r.mult, elo_scale = r.scale
     where id = r.id;
  end loop;
end $$;

---------------------------------------------------------------------------------------------------- elo_recompute_player
create or replace function public.elo_recompute_player(p_key text, p_from text[] default '{}'::text[]) returns integer
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
  v_min  integer;
  v_ab   boolean;
  v_wt   double precision;
  v_mult numeric;
begin
  if p_key is null then return 0; end if;
  p_key := elo_key(p_key);
  lock table player_elo in exclusive mode;   -- como elo_recompute_all
  perform set_config('v34.elo_recompute', 'on', true);
  select c.base, c.bonus_max, c.bonus_factor, c.elo_floor, c.start_elo, c.min_pct, c.full_pct,
         c.mult_win_min, c.mult_win_max, c.mult_loss_min, c.mult_loss_max, c.formula_from
    into cfg from elo_config c where c.id = 1;
  if not found then
    select 30 as base, 5 as bonus_max, 10::numeric as bonus_factor, 100 as elo_floor, 1000 as start_elo, 35 as min_pct, 90 as full_pct,
           0.75::numeric as mult_win_min, 1.5::numeric as mult_win_max, 0.5::numeric as mult_loss_min, 1.25::numeric as mult_loss_max,
           null::timestamptz as formula_from into cfg;
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
      select s.id, s.team, s.rounds, s.rating, s.win_prob, s.elo_scale, m.winner_side, m.score1, m.score2, m.played_at, m.starts_at into r
        from match_player_stats s join matches m on m.id = s.match_id
       where s.match_id = ev.mid and s.steam_id = any(ids) and s.win_prob is not null
       order by s.rounds desc, s.id limit 1;
      select greatest(coalesce(r.score1, 0) + coalesce(r.score2, 0), coalesce(max(rounds), 0)) into total
        from match_player_stats where match_id = ev.mid and team in (1, 2);
      wt := elo_weight(r.rounds, total, cfg.min_pct, cfg.full_pct);
      v_ab := mm_elo_abandoned(ev.mid, p_key);
      continue when wt <= 0 and not v_ab;

      res   := case when v_ab then 0 else case r.winner_side when r.team then 1 when 3 - r.team then 0 else 0.5 end end;
      v_min := elo_min_for(ev.mid);
      if cfg.formula_from is not null and coalesce(r.played_at, r.starts_at) >= cfg.formula_from then
        -- (replanteo 100) la misma cuenta que elo_apply_match, con la probabilidad y el tope guardados.
        v_wt   := case when v_ab then 1 else wt end;
        v_mult := (case when res = 1 then least(cfg.mult_win_max, greatest(cfg.mult_win_min, coalesce(r.rating, 1)))
                        when res = 0 then least(cfg.mult_loss_max, greatest(cfg.mult_loss_min, 2 - coalesce(r.rating, 1)))
                        else 1 end)::numeric(4, 2);
        delta := round(2 * cfg.base * (res - r.win_prob::double precision) * v_mult::double precision * v_wt)::int;
        delta := coalesce(mm_elo_delta(ev.mid, p_key, r.team, res, r.win_prob::double precision, delta), delta);
        if not v_ab then delta := round(delta * coalesce(r.elo_scale, 1))::int; end if;
        if res = 1 then delta := greatest(delta, greatest(round(v_min * v_wt)::int, 1));
        elsif res = 0 then delta := least(delta, -greatest(round(v_min * v_wt)::int, 1)); end if;
      else
        -- La misma cuenta que elo_apply_match (fórmula anterior), con la probabilidad guardada.
        base  := round(2 * cfg.base * (res - r.win_prob::double precision));
        if v_min > 0 and res = 1 then base := greatest(base, v_min); elsif v_min > 0 and res = 0 then base := least(base, -v_min); end if;
        bonus := greatest(-cfg.bonus_max, least(cfg.bonus_max, round((coalesce(r.rating, 1) - 1) * cfg.bonus_factor)::integer));
        delta := round((base + bonus) * wt);
        if res = 1 then delta := greatest(delta, 1); elsif res = 0 then delta := least(delta, -1); end if;
        delta := coalesce(mm_elo_delta(ev.mid, p_key, r.team, res, r.win_prob::double precision, delta), delta);
        if v_min > 0 and res = 1 then delta := greatest(delta, round(v_min * case when v_ab then 1 else wt end)::int);
        elsif v_min > 0 and res = 0 then delta := least(delta, -round(v_min * case when v_ab then 1 else wt end)::int); end if;
      end if;

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

---------------------------------------------------------------------------------------------------- mm_elo_stake
create or replace function public.mm_elo_stake(p_lobby uuid, p_viewer uuid) returns jsonb
  language plpgsql stable set search_path = public as $$
declare
  c_sig0 constant double precision := 25.0 / 3;
  c_beta constant double precision := 25.0 / 6;
  c_tau constant double precision := 25.0 / 300;
  v_team smallint;
  mu1 double precision; mu2 double precision; s2 double precision;
  e1 double precision; e2 double precision;
  p double precision;
  cfg record;
  v_min integer;
begin
  select team into v_team from mm_lobby_players where lobby_id = p_lobby and user_id = p_viewer;
  if v_team is null or not (select affects_elo from mm_lobbies where id = p_lobby) then return null; end if;
  select coalesce(c.base, 30) base, coalesce(c.start_elo, 1000) start_elo, coalesce(c.team_cap, 30) team_cap, c.formula_from,
         coalesce(case when c.min_delta_from is null or c.min_delta_from <= now() then c.min_delta end, 0) min_delta
    into cfg from elo_config c where c.id = 1;
  if cfg.formula_from is not null and cfg.formula_from <= now() then
    -- (replanteo 100) por ELO visible, con el multiplicador en 1 (rating 1.00), entre el mínimo y el tope.
    select avg(coalesce(e.elo, cfg.start_elo)) filter (where lp.team = 1), avg(coalesce(e.elo, cfg.start_elo)) filter (where lp.team = 2)
      into e1, e2
      from mm_lobby_players lp join players pl on pl.id = lp.player_id left join player_elo e on e.steam_id = elo_key(pl.steam_id)
     where lp.lobby_id = p_lobby;
    p := 1 / (1 + power(10::double precision, ((case when v_team = 1 then e2 - e1 else e1 - e2 end) / 400)));
    v_min := greatest(cfg.min_delta, 1);
    return jsonb_build_object('win',  least(cfg.team_cap, greatest(round(2 * cfg.base * (1 - p))::int, v_min)),
                              'loss', least(cfg.team_cap, greatest(round(2 * cfg.base * p)::int, v_min)));
  end if;
  -- Fórmula anterior (TrueSkill), replanteo 98.
  select coalesce(sum(coalesce(e.mu, 25)) filter (where lp.team = 1), 0), coalesce(sum(coalesce(e.mu, 25)) filter (where lp.team = 2), 0),
         sum(coalesce(e.sigma, c_sig0) ^ 2 + c_tau * c_tau + c_beta * c_beta)
    into mu1, mu2, s2
    from mm_lobby_players lp join players pl on pl.id = lp.player_id left join player_elo e on e.steam_id = elo_key(pl.steam_id)
   where lp.lobby_id = p_lobby;
  p := csstv_ncdf((case when v_team = 1 then mu1 - mu2 else mu2 - mu1 end) / sqrt(s2));
  return jsonb_build_object('win', greatest(round(2 * cfg.base * (1 - p))::int, cfg.min_delta, 1), 'loss', greatest(round(2 * cfg.base * p)::int, cfg.min_delta, 1));
end $$;

---------------------------------------------------------------------------------------------------- elo_set_config
drop function public.elo_set_config(integer, integer, numeric, integer, integer, boolean, integer, integer);
create function public.elo_set_config(
  p_base integer, p_bonus_max integer, p_bonus_factor numeric, p_floor integer, p_start_elo integer,
  p_recompute boolean default false, p_min_pct integer default null, p_full_pct integer default null,
  -- (replanteo 100) null = deja el valor actual
  p_mult_win_min numeric default null, p_mult_win_max numeric default null,
  p_mult_loss_min numeric default null, p_mult_loss_max numeric default null,
  p_team_cap integer default null, p_min_delta integer default null)
returns integer language plpgsql security definer set search_path = public as $$
declare
  v_min  integer;
  v_full integer;
  c      elo_config%rowtype;
begin
  if auth.uid() is not null and not is_admin() then
    raise exception 'Solo un admin puede cambiar la configuración del ELO' using errcode = '42501';
  end if;
  -- (replanteo 25) recalcular ya no está en la web
  if p_recompute and auth.uid() is not null then
    raise exception 'Recalcular el ELO ya no está disponible desde la web';
  end if;
  if p_base is null or p_base not between 5 and 100 then
    raise exception 'La base tiene que estar entre 5 y 100' using errcode = '22023'; end if;
  if p_bonus_max is null or p_bonus_max not between 0 and 20 then
    raise exception 'El bonus máximo tiene que estar entre 0 y 20' using errcode = '22023'; end if;
  if p_bonus_factor is null or p_bonus_factor not between 0 and 50 then
    raise exception 'El factor del bonus tiene que estar entre 0 y 50' using errcode = '22023'; end if;
  if p_floor is null or p_floor not between 0 and 1000 then
    raise exception 'El ELO mínimo tiene que estar entre 0 y 1000' using errcode = '22023'; end if;
  if p_start_elo is null or p_start_elo not between 100 and 5000 or p_start_elo < p_floor then
    raise exception 'El ELO inicial tiene que estar entre 100 y 5000 y no ser menor que el mínimo' using errcode = '22023'; end if;

  select * into c from elo_config where id = 1;
  v_min  := coalesce(p_min_pct, c.min_pct, 35);
  v_full := coalesce(p_full_pct, c.full_pct, 90);
  if v_min not between 1 and 100 then
    raise exception 'El mínimo de rondas jugadas tiene que estar entre 1%% y 100%%' using errcode = '22023'; end if;
  if v_full not between v_min and 100 then
    raise exception 'El porcentaje para contar completo tiene que estar entre el mínimo y 100%%' using errcode = '22023'; end if;

  c.mult_win_min  := coalesce(p_mult_win_min, c.mult_win_min, 0.75);
  c.mult_win_max  := coalesce(p_mult_win_max, c.mult_win_max, 1.5);
  c.mult_loss_min := coalesce(p_mult_loss_min, c.mult_loss_min, 0.5);
  c.mult_loss_max := coalesce(p_mult_loss_max, c.mult_loss_max, 1.25);
  c.team_cap      := coalesce(p_team_cap, c.team_cap, 30);
  c.min_delta     := coalesce(p_min_delta, c.min_delta, 10);
  if c.mult_win_min not between 0.1 and 1 or c.mult_loss_min not between 0.1 and 1 then
    raise exception 'Los multiplicadores mínimos tienen que estar entre 0,1 y 1' using errcode = '22023'; end if;
  if c.mult_win_max not between 1 and 3 or c.mult_loss_max not between 1 and 3 then
    raise exception 'Los multiplicadores máximos tienen que estar entre 1 y 3' using errcode = '22023'; end if;
  if c.team_cap not between 5 and 200 then
    raise exception 'El tope por equipo tiene que estar entre 5 y 200' using errcode = '22023'; end if;
  if c.min_delta not between 0 and 100 or c.min_delta > c.team_cap then
    raise exception 'El mínimo por partida tiene que estar entre 0 y 100 y no pasar el tope por equipo' using errcode = '22023'; end if;

  insert into elo_config(id, base, bonus_max, bonus_factor, elo_floor, start_elo, min_pct, full_pct,
                         mult_win_min, mult_win_max, mult_loss_min, mult_loss_max, team_cap, min_delta, updated_at, updated_by)
  values (1, p_base, p_bonus_max, p_bonus_factor, p_floor, p_start_elo, v_min, v_full,
          c.mult_win_min, c.mult_win_max, c.mult_loss_min, c.mult_loss_max, c.team_cap, c.min_delta, now(), auth.uid())
  on conflict (id) do update
    set base = excluded.base, bonus_max = excluded.bonus_max, bonus_factor = excluded.bonus_factor,
        elo_floor = excluded.elo_floor, start_elo = excluded.start_elo,
        min_pct = excluded.min_pct, full_pct = excluded.full_pct,
        mult_win_min = excluded.mult_win_min, mult_win_max = excluded.mult_win_max,
        mult_loss_min = excluded.mult_loss_min, mult_loss_max = excluded.mult_loss_max,
        team_cap = excluded.team_cap, min_delta = excluded.min_delta,
        updated_at = excluded.updated_at, updated_by = excluded.updated_by;

  if p_recompute then
    return elo_recompute_all();
  end if;
  return 0;
end $$;
-- Los mismos permisos que la anterior (la protege is_admin() por dentro).
revoke all on function public.elo_set_config(integer, integer, numeric, integer, integer, boolean, integer, integer, numeric, numeric, numeric, numeric, integer, integer) from public;
grant execute on function public.elo_set_config(integer, integer, numeric, integer, integer, boolean, integer, integer, numeric, numeric, numeric, numeric, integer, integer) to anon, authenticated, service_role;

commit;
