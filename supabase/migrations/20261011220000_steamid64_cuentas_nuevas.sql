-- =============================================================================
-- SteamID64 de cuentas nuevas (765612...)
--
-- Las cuentas de Steam con número de cuenta mayor a ~1.020 millones tienen un
-- SteamID64 que empieza con 765612 en vez de 7656119. Se rechazaban:
--   - elo_apply_match no les daba ELO (se contaban como "sin SteamID");
--   - csstv_steam64 no aceptaba su SteamID64 ni el link de su perfil.
-- Ahora se acepta todo el rango: 7656119 + 10 dígitos o 765612 + 11 dígitos.
--
-- Requiere 20261011200000_elo_jugadores_sin_steamid.sql.
-- Bitácora: docs/bitacora/2026-10-11-elo-jugadores/
-- Cómo aplicarla: Supabase > SQL Editor > pegar todo el archivo > Run.
-- Después: select elo_recompute_all();
-- =============================================================================

begin;

-- Convierte STEAM_X:Y:Z, [U:1:N], SteamID64 o el link de perfil a SteamID64.
create or replace function public.csstv_steam64(p text)
returns text language plpgsql immutable as $$
declare m text[];
begin
  if p is null then return null; end if;
  p := trim(p);
  if p ~ '^(7656119[0-9]{10}|765612[0-9]{11})$' then return p; end if;
  m := regexp_match(p, '^STEAM_[0-5]:([01]):([0-9]+)$', 'i');
  if m is not null then return (76561197960265728 + m[2]::bigint * 2 + m[1]::bigint)::text; end if;
  m := regexp_match(p, '^\[?U:1:([0-9]+)\]?$', 'i');
  if m is not null then return (76561197960265728 + m[1]::bigint)::text; end if;
  m := regexp_match(p, 'steamcommunity\.com/profiles/(7656119[0-9]{10}|765612[0-9]{11})', 'i');
  if m is not null then return m[1]; end if;
  return null;
end $$;

create or replace function public.elo_apply_match(p_match uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  c_mu0   constant double precision := 25;          -- jugador nuevo / sin SteamID
  c_sig0  constant double precision := 25.0 / 3;
  c_beta  constant double precision := 25.0 / 6;    -- σ₀ / 2
  c_tau   constant double precision := 25.0 / 300;  -- σ₀ / 100
  c_base  constant integer := 60;                   -- 60 × (resultado − prob.): ±30 con equipos parejos
  c_bonus constant integer := 5;
  c_floor constant integer := 100;
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
  if not found or m.kind <> 'mix' or m.status <> 'finished' then return; end if;
  if exists (select 1 from match_player_stats where match_id = p_match and elo_after is not null) then return; end if;

  -- Solo los SteamID64 reciben ELO.
  select array_agg(steam_id order by steam_id) into ids
    from match_player_stats
   where match_id = p_match and steam_id ~ '^(7656119[0-9]{10}|765612[0-9]{11})$' and rounds > 0 and team in (1, 2);
  if ids is null then return; end if;

  insert into player_elo(steam_id) select unnest(ids) on conflict (steam_id) do nothing;
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

    base  := round(c_base * (res - p_team));
    bonus := greatest(-c_bonus, least(c_bonus, round((coalesce(r.rating, 1) - 1) * 10)::integer));
    delta := base + bonus;
    if res = 1 then delta := greatest(delta, 1); elsif res = 0 then delta := least(delta, -1); end if;
    new_elo := greatest(c_floor, r.elo + delta);

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

commit;

notify pgrst, 'reload schema';
