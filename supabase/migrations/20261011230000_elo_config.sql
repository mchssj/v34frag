-- =============================================================================
-- ELO configurable: tabla elo_config (una fila) editable por admins
--
-- Base, tope y factor del bonus, ELO mínimo y ELO inicial dejan de estar fijos
-- en elo_apply_match. Con los valores por defecto el cálculo es igual que antes.
-- Los parámetros de TrueSkill (μ, σ, β, τ) siguen fijos en la función.
--
-- Requiere 20261011220000_steamid64_cuentas_nuevas.sql.
-- Bitácora: docs/bitacora/2026-10-11-elo-configurable/
-- Cómo aplicarla: Supabase > SQL Editor > pegar todo el archivo > Run. Re-ejecutable.
-- =============================================================================

begin;

create table if not exists public.elo_config (
  id           smallint primary key default 1 check (id = 1),
  base         integer not null default 30   check (base between 5 and 100),
  bonus_max    integer not null default 5    check (bonus_max between 0 and 20),
  bonus_factor numeric not null default 10   check (bonus_factor between 0 and 50),
  elo_floor    integer not null default 100  check (elo_floor between 0 and 1000),
  start_elo    integer not null default 1000 check (start_elo between 100 and 5000),
  updated_at   timestamptz not null default now(),
  updated_by   uuid,
  constraint elo_config_start_floor check (start_elo >= elo_floor)
);
insert into public.elo_config(id) values (1) on conflict (id) do nothing;

alter table public.elo_config enable row level security;
drop policy if exists "elo config: todos ven" on public.elo_config;
create policy "elo config: todos ven" on public.elo_config for select using (true);
-- Sin políticas de escritura: se cambia con elo_set_config (o desde el SQL Editor).

-- El mínimo ahora es configurable (0 a 1000): el check fijo de 100 pasa a 0.
do $$
declare r record;
begin
  for r in select conname from pg_constraint
            where conrelid = 'public.player_elo'::regclass and contype = 'c'
              and pg_get_constraintdef(oid) ilike '%elo >= 100%'
  loop
    execute format('alter table public.player_elo drop constraint %I', r.conname);
  end loop;
  if not exists (select 1 from pg_constraint where conname = 'player_elo_elo_min') then
    alter table public.player_elo add constraint player_elo_elo_min check (elo >= 0);
  end if;
end $$;

-- Guarda la configuración (solo admin) y, si se pide, recalcula todos los mixes.
-- Devuelve la cantidad de mixes recalculados (0 si no se pidió).
create or replace function public.elo_set_config(p_base integer, p_bonus_max integer, p_bonus_factor numeric,
                                                 p_floor integer, p_start_elo integer, p_recompute boolean default false)
returns integer language plpgsql security definer set search_path = public as $$
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

  insert into elo_config(id, base, bonus_max, bonus_factor, elo_floor, start_elo, updated_at, updated_by)
  values (1, p_base, p_bonus_max, p_bonus_factor, p_floor, p_start_elo, now(), auth.uid())
  on conflict (id) do update
    set base = excluded.base, bonus_max = excluded.bonus_max, bonus_factor = excluded.bonus_factor,
        elo_floor = excluded.elo_floor, start_elo = excluded.start_elo,
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
  cfg     record;             -- elo_config: base, bonus_max, bonus_factor, elo_floor, start_elo
  m       record;
  r       record;
  ids     text[];
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
  select id, kind, status, team1, team2, winner into m from matches where id = p_match for update;
  select c.base, c.bonus_max, c.bonus_factor, c.elo_floor, c.start_elo into cfg from elo_config c where c.id = 1;
  if not found then
    select 30 as base, 5 as bonus_max, 10::numeric as bonus_factor, 100 as elo_floor, 1000 as start_elo into cfg;
  end if;
  if not found or m.kind <> 'mix' or m.status <> 'finished' then return; end if;
  if exists (select 1 from match_player_stats where match_id = p_match and elo_after is not null) then return; end if;

  -- Solo los SteamID64 reciben ELO.
  select array_agg(steam_id order by steam_id) into ids
    from match_player_stats
   where match_id = p_match and steam_id ~ '^(7656119[0-9]{10}|765612[0-9]{11})$' and rounds > 0 and team in (1, 2);
  if ids is null then return; end if;

  insert into player_elo(steam_id, elo, peak_elo) select x, cfg.start_elo, cfg.start_elo from unnest(ids) x
  on conflict (steam_id) do nothing;
  -- Bloqueo en orden fijo para que dos mixes simultáneos no se pisen ni se bloqueen entre sí.
  perform 1 from player_elo where steam_id = any(ids) order by steam_id for update;

  -- Fuerza de cada equipo: todos los que jugaron al menos una ronda. Los que no tienen
  -- SteamID64 no tienen fila en player_elo y cuentan como un jugador nuevo.
  -- σ² de cada jugador ya incluye τ² (la habilidad puede cambiar entre mixes).
  select count(*) filter (where s.team = 1), count(*) filter (where s.team = 2),
         coalesce(sum(coalesce(e.mu, c_mu0)) filter (where s.team = 1), 0),
         coalesce(sum(coalesce(e.mu, c_mu0)) filter (where s.team = 2), 0),
         sum(coalesce(e.sigma, c_sig0) ^ 2 + c_tau * c_tau)
    into n1, n2, mu1, mu2, s2_tot
    from match_player_stats s left join player_elo e on e.steam_id = s.steam_id
   where s.match_id = p_match and s.rounds > 0 and s.team in (1, 2);
  if n1 = 0 or n2 = 0 then return; end if;

  c    := sqrt((n1 + n2) * c_beta * c_beta + s2_tot);
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
    select s.id, s.team, s.rating, e.steam_id, e.elo, e.peak_elo, e.mu, e.sigma
      from match_player_stats s join player_elo e on e.steam_id = s.steam_id
     where s.match_id = p_match and s.steam_id = any(ids)
  loop
    p_team := case when r.team = 1 then p1 else 1 - p1 end;
    res    := case when r.team = 1 then res1 else 1 - res1 end;

    base  := round(2 * cfg.base * (res - p_team));   -- ±base con equipos parejos
    bonus := greatest(-cfg.bonus_max, least(cfg.bonus_max, round((coalesce(r.rating, 1) - 1) * cfg.bonus_factor)::integer));
    delta := base + bonus;
    if res = 1 then delta := greatest(delta, 1); elsif res = 0 then delta := least(delta, -1); end if;
    new_elo := greatest(cfg.elo_floor, r.elo + delta);

    s2     := r.sigma * r.sigma + c_tau * c_tau;
    new_mu := r.mu;
    if res = 1 then
      new_mu := r.mu + s2 / c * v;
    elsif res = 0 then
      new_mu := r.mu - s2 / c * v;
    end if;
    if res <> 0.5 then
      s2 := s2 * greatest(1 - s2 / (c * c) * w, 0.0001);
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
revoke all on function public.elo_set_config(integer, integer, numeric, integer, integer, boolean) from public, anon;
grant execute on function public.elo_set_config(integer, integer, numeric, integer, integer, boolean) to authenticated;
revoke insert, update, delete, truncate on public.elo_config from anon, authenticated;
grant select on public.elo_config to anon, authenticated;

commit;

notify pgrst, 'reload schema';
