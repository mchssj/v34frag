-- =============================================================================
-- ELO proporcional a las rondas jugadas
--
-- Participación = rondas del jugador / rondas del mix (la mayor entre score1 + score2
-- y las rondas del que más jugó). Peso:
--   - menos de elo_config.min_pct (35%): 0, no cuenta para la fuerza del equipo y su ELO no cambia
--   - entre min_pct y full_pct (90%): la participación
--   - desde full_pct: 1
-- El cambio de ELO (base + bonus) se multiplica por el peso, con el mínimo de +1 al ganar
-- y −1 al perder. TrueSkill con juego parcial: el equipo suma peso × μ y peso² × varianza,
-- y μ / σ de cada jugador se mueven en proporción a su peso. Con peso 1 para todos, el
-- cálculo es igual que antes.
--
-- elo_apply_match es la de 20261011230000_elo_config.sql con esos cambios.
-- No recalcula los mixes anteriores.
-- Bitácora: docs/bitacora/2026-10-14-elo-participacion-y-sourcetv/
-- Cómo aplicarla: Supabase > SQL Editor > pegar todo el archivo > Run. Re-ejecutable.
-- =============================================================================

begin;

alter table public.elo_config add column if not exists min_pct  integer not null default 35;
alter table public.elo_config add column if not exists full_pct integer not null default 90;
alter table public.elo_config drop constraint if exists elo_config_min_pct;
alter table public.elo_config add constraint elo_config_min_pct check (min_pct between 1 and 100);
alter table public.elo_config drop constraint if exists elo_config_full_pct;
alter table public.elo_config add constraint elo_config_full_pct check (full_pct between min_pct and 100);

-- Peso de un jugador según sus rondas (en enteros, para que 27 de 30 sea exactamente 90%).
create or replace function public.elo_weight(p_rounds integer, p_total integer, p_min_pct integer, p_full_pct integer)
returns double precision language sql immutable as $$
  select case
    when coalesce(p_rounds, 0) <= 0 or coalesce(p_total, 0) <= 0 then 0
    when p_rounds * 100 < p_min_pct * p_total then 0
    when p_rounds * 100 >= p_full_pct * p_total then 1
    else p_rounds::double precision / p_total
  end
$$;

-- Los parámetros nuevos vacíos conservan lo guardado (la web anterior no los manda).
drop function if exists public.elo_set_config(integer, integer, numeric, integer, integer, boolean);
create or replace function public.elo_set_config(p_base integer, p_bonus_max integer, p_bonus_factor numeric,
                                                 p_floor integer, p_start_elo integer, p_recompute boolean default false,
                                                 p_min_pct integer default null, p_full_pct integer default null)
returns integer language plpgsql security definer set search_path = public as $$
declare
  v_min  integer;
  v_full integer;
begin
  if auth.uid() is not null and not is_admin() then
    raise exception 'Solo un admin puede cambiar la configuración del ELO' using errcode = '42501';
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

  select coalesce(p_min_pct, c.min_pct), coalesce(p_full_pct, c.full_pct) into v_min, v_full from elo_config c where c.id = 1;
  v_min  := coalesce(v_min, p_min_pct, 35);
  v_full := coalesce(v_full, p_full_pct, 90);
  if v_min not between 1 and 100 then
    raise exception 'El mínimo de rondas jugadas tiene que estar entre 1%% y 100%%' using errcode = '22023'; end if;
  if v_full not between v_min and 100 then
    raise exception 'El porcentaje para contar completo tiene que estar entre el mínimo y 100%%' using errcode = '22023'; end if;

  insert into elo_config(id, base, bonus_max, bonus_factor, elo_floor, start_elo, min_pct, full_pct, updated_at, updated_by)
  values (1, p_base, p_bonus_max, p_bonus_factor, p_floor, p_start_elo, v_min, v_full, now(), auth.uid())
  on conflict (id) do update
    set base = excluded.base, bonus_max = excluded.bonus_max, bonus_factor = excluded.bonus_factor,
        elo_floor = excluded.elo_floor, start_elo = excluded.start_elo,
        min_pct = excluded.min_pct, full_pct = excluded.full_pct,
        updated_at = excluded.updated_at, updated_by = excluded.updated_by;

  if p_recompute then
    return elo_recompute_all();
  end if;
  return 0;
end $$;

create or replace function public.elo_apply_match(p_match uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  c_mu0   constant double precision := 25;          -- jugador nuevo / sin SteamID
  c_sig0  constant double precision := 25.0 / 3;
  c_beta  constant double precision := 25.0 / 6;    -- σ₀ / 2
  c_tau   constant double precision := 25.0 / 300;  -- σ₀ / 100
  cfg     record;             -- elo_config: base, bonus_max, bonus_factor, elo_floor, start_elo, min_pct, full_pct
  m       record;
  r       record;
  ids     text[];
  total   integer;            -- rondas del mix
  n1      integer;
  n2      integer;
  mu1     double precision;
  mu2     double precision;
  s2_tot  double precision;
  c       double precision;
  p1      double precision;   -- probabilidad de que gane el equipo 1
  res1    double precision;   -- 1 gana el equipo 1, 0 pierde, 0.5 empate
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
begin
  select id, kind, status, team1, team2, winner, score1, score2 into m from matches where id = p_match for update;
  select c.base, c.bonus_max, c.bonus_factor, c.elo_floor, c.start_elo, c.min_pct, c.full_pct into cfg from elo_config c where c.id = 1;
  if not found then
    select 30 as base, 5 as bonus_max, 10::numeric as bonus_factor, 100 as elo_floor, 1000 as start_elo,
           35 as min_pct, 90 as full_pct into cfg;
  end if;
  if not found or m.kind <> 'mix' or m.status <> 'finished' then return; end if;
  if exists (select 1 from match_player_stats where match_id = p_match and elo_after is not null) then return; end if;

  -- Rondas del mix: si hubo una ronda empatada no suma al marcador, pero sí a las rondas de cada uno.
  select greatest(coalesce(m.score1, 0) + coalesce(m.score2, 0), coalesce(max(rounds), 0)) into total
    from match_player_stats where match_id = p_match and team in (1, 2);
  if total <= 0 then return; end if;

  -- Solo los SteamID64 que llegan al mínimo de rondas reciben ELO.
  select array_agg(steam_id order by steam_id) into ids
    from match_player_stats
   where match_id = p_match and steam_id ~ '^(7656119[0-9]{10}|765612[0-9]{11})$' and team in (1, 2)
     and elo_weight(rounds, total, cfg.min_pct, cfg.full_pct) > 0;
  if ids is null then return; end if;

  insert into player_elo(steam_id, elo, peak_elo) select x, cfg.start_elo, cfg.start_elo from unnest(ids) x
  on conflict (steam_id) do nothing;
  -- Bloqueo en orden fijo para que dos mixes simultáneos no se pisen ni se bloqueen entre sí.
  perform 1 from player_elo where steam_id = any(ids) order by steam_id for update;

  -- Fuerza de cada equipo (TrueSkill con juego parcial): cada jugador aporta peso × μ y
  -- peso² × (σ² + τ² + β²). Los que no llegan al mínimo tienen peso 0 y no cuentan. Los que
  -- no tienen SteamID64 no tienen fila en player_elo y cuentan como un jugador nuevo.
  select count(*) filter (where x.team = 1), count(*) filter (where x.team = 2),
         coalesce(sum(x.wt * x.mu) filter (where x.team = 1), 0),
         coalesce(sum(x.wt * x.mu) filter (where x.team = 2), 0),
         sum(x.wt * x.wt * (x.sigma ^ 2 + c_tau * c_tau + c_beta * c_beta))
    into n1, n2, mu1, mu2, s2_tot
    from (select s.team, elo_weight(s.rounds, total, cfg.min_pct, cfg.full_pct) wt,
                 coalesce(e.mu, c_mu0) mu, coalesce(e.sigma, c_sig0) sigma
            from match_player_stats s left join player_elo e on e.steam_id = s.steam_id
           where s.match_id = p_match and s.team in (1, 2)) x
   where x.wt > 0;
  if n1 = 0 or n2 = 0 then return; end if;

  c    := sqrt(s2_tot);
  p1   := csstv_ncdf((mu1 - mu2) / c);
  res1 := case when m.winner is null then 0.5 when m.winner = m.team1 then 1 else 0 end;

  -- Factores de TrueSkill para dos equipos (sin empate): v = φ(t)/Φ(t), w = v(v + t).
  if res1 <> 0.5 then
    t := case when res1 = 1 then mu1 - mu2 else mu2 - mu1 end / c;
    if t < -4 then
      v := -t - 1 / t;   -- Φ(t) es demasiado chico para dividir con precisión
    else
      v := csstv_npdf(t) / csstv_ncdf(t);
    end if;
    w := v * (v + t);
  end if;

  for r in
    select s.id, s.team, s.rating, e.steam_id, e.elo, e.peak_elo, e.mu, e.sigma,
           elo_weight(s.rounds, total, cfg.min_pct, cfg.full_pct) wt
      from match_player_stats s join player_elo e on e.steam_id = s.steam_id
     where s.match_id = p_match and s.steam_id = any(ids)
  loop
    p_team := case when r.team = 1 then p1 else 1 - p1 end;
    res    := case when r.team = 1 then res1 else 1 - res1 end;

    base  := round(2 * cfg.base * (res - p_team));   -- ±base con equipos parejos
    bonus := greatest(-cfg.bonus_max, least(cfg.bonus_max, round((coalesce(r.rating, 1) - 1) * cfg.bonus_factor)::integer));
    delta := round((base + bonus) * r.wt);
    if res = 1 then delta := greatest(delta, 1); elsif res = 0 then delta := least(delta, -1); end if;
    new_elo := greatest(cfg.elo_floor, r.elo + delta);

    s2     := r.sigma * r.sigma + c_tau * c_tau;
    new_mu := r.mu;
    if res = 1 then
      new_mu := r.mu + r.wt * s2 / c * v;
    elsif res = 0 then
      new_mu := r.mu - r.wt * s2 / c * v;
    end if;
    if res <> 0.5 then
      s2 := s2 * greatest(1 - r.wt * r.wt * s2 / (c * c) * w, 0.0001);
    end if;

    update player_elo
       set elo = new_elo, peak_elo = greatest(r.peak_elo, new_elo), mu = new_mu, sigma = sqrt(s2),
           matches = matches + 1, updated_at = now()
     where steam_id = r.steam_id;

    update match_player_stats
       set elo_before = r.elo, elo_after = new_elo, elo_delta = new_elo - r.elo, win_prob = round(p_team::numeric, 4)
     where id = r.id;
  end loop;
end $$;

revoke all on function public.elo_apply_match(uuid) from public, anon, authenticated;
revoke all on function public.elo_weight(integer, integer, integer, integer) from public, anon, authenticated;
revoke all on function public.elo_set_config(integer, integer, numeric, integer, integer, boolean, integer, integer) from public, anon;
grant execute on function public.elo_set_config(integer, integer, numeric, integer, integer, boolean, integer, integer) to authenticated;

commit;

notify pgrst, 'reload schema';
