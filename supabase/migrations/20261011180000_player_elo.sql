-- =============================================================================
-- ELO de jugadores (mixes)
-- TrueSkill (μ/σ por jugador) calcula la probabilidad de victoria de cada equipo
-- y el ELO visible cambia con base ±30 más un bonus de ±5 por el rating HLTV.
-- Todos empiezan en 1000. El ELO se guarda por SteamID64. Bitácora: docs/bitacora/2026-10-11-elo-jugadores/
--
-- Requiere 20261011120000_csstv_match_reporter.sql.
-- Cómo aplicarla: Supabase > SQL Editor > pegar todo el archivo > Run.
-- Es re-ejecutable: usa IF NOT EXISTS / CREATE OR REPLACE.
-- Después de aplicarla por primera vez: select elo_recompute_all();
-- =============================================================================

begin;

-- -----------------------------------------------------------------------------
-- 1. Tablas y columnas
-- -----------------------------------------------------------------------------
create table if not exists public.player_elo (
  steam_id   text primary key,
  elo        integer not null default 1000 check (elo >= 100),
  peak_elo   integer not null default 1000,
  mu         double precision not null default 25,
  sigma      double precision not null default 25.0 / 3,
  matches    integer not null default 0,
  updated_at timestamptz not null default now()
);
alter table public.player_elo enable row level security;
drop policy if exists "elo: todos ven" on public.player_elo;
create policy "elo: todos ven" on public.player_elo for select using (true);
-- Sin políticas de escritura: solo lo modifican las funciones de abajo.

alter table public.match_player_stats
  add column if not exists elo_before integer,
  add column if not exists elo_after  integer,
  add column if not exists elo_delta  integer,
  add column if not exists win_prob   numeric;

create index if not exists matches_mix_played_idx on public.matches(played_at) where kind = 'mix';

-- -----------------------------------------------------------------------------
-- 2. Distribución normal
-- -----------------------------------------------------------------------------

-- Densidad de la normal estándar.
create or replace function public.csstv_npdf(x double precision)
returns double precision language sql immutable as $$
  select exp(-x * x / 2) / sqrt(2 * pi())
$$;

-- Normal acumulada. Postgres no trae erf: aproximación de Abramowitz-Stegun 7.1.26 (error < 1.5e-7).
create or replace function public.csstv_ncdf(x double precision)
returns double precision language plpgsql immutable as $$
declare
  z double precision := abs(x) / sqrt(2);
  t double precision := 1 / (1 + 0.3275911 * z);
  y double precision;
begin
  y := 1 - ((((1.061405429 * t - 1.453152027) * t + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * exp(-z * z);
  return 0.5 * (1 + sign(x) * y);
end $$;

-- -----------------------------------------------------------------------------
-- 3. Cálculo del ELO de un mix
-- -----------------------------------------------------------------------------
-- Aplica el mix a player_elo y guarda antes/después/cambio en match_player_stats.
-- Idempotente: si el mix ya tiene ELO aplicado no hace nada.
-- Cuentan los jugadores con SteamID64 y al menos una ronda jugada.
create or replace function public.elo_apply_match(p_match uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
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

  select array_agg(steam_id order by steam_id) into ids
    from match_player_stats
   where match_id = p_match and steam_id ~ '^7656119[0-9]{10}$' and rounds > 0 and team in (1, 2);
  if ids is null then return; end if;

  insert into player_elo(steam_id) select unnest(ids) on conflict (steam_id) do nothing;
  -- Bloqueo en orden fijo para que dos mixes simultáneos no se pisen ni se bloqueen entre sí.
  perform 1 from player_elo where steam_id = any(ids) order by steam_id for update;

  -- σ² de cada jugador ya incluye τ² (la habilidad puede cambiar entre mixes).
  select count(*) filter (where s.team = 1), count(*) filter (where s.team = 2),
         coalesce(sum(e.mu) filter (where s.team = 1), 0), coalesce(sum(e.mu) filter (where s.team = 2), 0),
         sum(e.sigma * e.sigma + c_tau * c_tau)
    into n1, n2, mu1, mu2, s2_tot
    from match_player_stats s join player_elo e on e.steam_id = s.steam_id
   where s.match_id = p_match and s.steam_id = any(ids);
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

-- Reinicia el ELO y vuelve a aplicar todos los mixes en el orden en que se jugaron.
-- Para la carga inicial y para corregir después de borrar un mix. Devuelve la cantidad de mixes aplicados.
create or replace function public.elo_recompute_all()
returns integer language plpgsql security definer set search_path = public as $$
declare
  x uuid;
  n integer := 0;
begin
  -- Desde la web solo un admin; desde el SQL Editor no hay usuario.
  if auth.uid() is not null and not is_admin() then
    raise exception 'Solo un admin puede recalcular el ELO' using errcode = '42501';
  end if;
  lock table player_elo in exclusive mode;   -- espera a los envíos en curso y frena los nuevos hasta terminar

  delete from player_elo where true;
  update match_player_stats set elo_before = null, elo_after = null, elo_delta = null, win_prob = null
   where elo_after is not null or win_prob is not null;

  for x in
    select id from matches where kind = 'mix' and status = 'finished'
     order by coalesce(played_at, starts_at), id
  loop
    perform elo_apply_match(x);
    n := n + 1;
  end loop;
  return n;
end $$;

-- -----------------------------------------------------------------------------
-- 4. Aplicar el ELO al recibir cada mix
-- -----------------------------------------------------------------------------
-- Mismas funciones que en 20261011120000; solo se agrega elo_apply_match.
-- Si el match_uid ya existía, elo_apply_match no hace nada.
create or replace function public.ingest_server_chunk(p_token text, p_uid text, p_part integer, p_total integer, p_data text)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  sid       uuid;
  v_id      uuid;
  v_b64     text;
  v_payload jsonb;
begin
  sid := csstv_auth(p_token);
  if p_uid is null or p_uid !~ '^[A-Za-z0-9_-]{6,80}$' then
    raise exception 'uid inválido' using errcode = 'PT422';
  end if;

  select id into v_id from matches where external_id = p_uid;
  if v_id is not null then return v_id; end if;

  if p_total is null or p_total not between 1 and 200 or p_part is null or p_part not between 1 and p_total then
    raise exception 'Número de parte inválido' using errcode = 'PT422';
  end if;
  if p_data is null or length(p_data) > 4000 or p_data !~ '^[A-Za-z0-9+/=]*$' then
    raise exception 'Parte inválida' using errcode = 'PT422';
  end if;

  delete from ingest_chunks where created_at < now() - interval '2 days';
  insert into ingest_chunks(uid, part, total, data, server_id)
  values (p_uid, p_part, p_total, p_data, sid)
  on conflict (uid, part) do update
    set data = excluded.data, total = excluded.total, server_id = excluded.server_id, created_at = now();

  if (select count(*) from ingest_chunks where uid = p_uid and total = p_total and part <= p_total) < p_total then
    return null;   -- faltan partes
  end if;

  select string_agg(data, '' order by part) into v_b64
    from ingest_chunks where uid = p_uid and part <= p_total;
  begin
    v_payload := convert_from(decode(v_b64, 'base64'), 'UTF8')::jsonb;
  exception when others then
    raise exception 'El resultado llegó dañado' using errcode = 'PT422';
  end;
  if v_payload->>'match_uid' is distinct from p_uid then
    raise exception 'El uid no coincide con el contenido' using errcode = 'PT422';
  end if;

  v_id := csstv_ingest(sid, v_payload);
  perform elo_apply_match(v_id);
  delete from ingest_chunks where uid = p_uid;
  return v_id;
end $$;

create or replace function public.ingest_server_match(p_token text, p_payload jsonb)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_id uuid;
begin
  v_id := csstv_ingest(csstv_auth(p_token), p_payload);
  perform elo_apply_match(v_id);
  return v_id;
end $$;

-- -----------------------------------------------------------------------------
-- 5. Permisos
-- -----------------------------------------------------------------------------
revoke all on function public.elo_apply_match(uuid) from public, anon, authenticated;
revoke all on function public.elo_recompute_all()   from public, anon;
grant execute on function public.elo_recompute_all() to authenticated;

revoke insert, update, delete, truncate on public.player_elo from anon, authenticated;
grant select on public.player_elo to anon, authenticated;

commit;

-- Que PostgREST vea las funciones nuevas sin esperar.
notify pgrst, 'reload schema';
