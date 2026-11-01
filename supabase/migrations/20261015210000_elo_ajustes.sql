-- =============================================================================
-- Ajustes manuales de ELO
--
-- Para dar o quitar ELO sin una partida (por ejemplo, un mix que se perdió porque el
-- servidor se cayó). Cada ajuste es una fila de elo_adjustments y solo mueve elo y
-- peak_elo: no toca μ/σ ni matches.
-- elo_recompute_all() ahora recorre mixes y ajustes en orden cronológico, así que los
-- ajustes sobreviven a un recálculo.
--
-- Uso (SQL Editor o admin desde la web):
--   select elo_add_adjustment(array['7656119…', …], 20, 'motivo', '2026-10-15 21:04-05');
--   select elo_remove_adjustment(<id>);   -- deshace y borra, sin recalcular
--
-- Bitácora: docs/bitacora/2026-10-15-ajustes-elo/
-- Cómo aplicarla: Supabase > SQL Editor > pegar todo el archivo > Run. Re-ejecutable.
-- =============================================================================

begin;

create table if not exists public.elo_adjustments (
  id         bigint generated always as identity primary key,
  steam_id   text not null check (steam_id ~ '^(7656119[0-9]{10}|765612[0-9]{11})$'),
  delta      integer not null check (delta <> 0),
  reason     text not null check (length(btrim(reason)) > 0),
  applied_at timestamptz not null default now(),   -- cuándo cuenta, para ordenarlo entre los mixes
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now()
);
create index if not exists elo_adjustments_steam_id on public.elo_adjustments (steam_id);

alter table public.elo_adjustments enable row level security;
drop policy if exists "elo_adjustments: todos ven" on public.elo_adjustments;
create policy "elo_adjustments: todos ven" on public.elo_adjustments for select using (true);
revoke all on public.elo_adjustments from anon, authenticated;
grant select on public.elo_adjustments to anon, authenticated;

-- Suma un delta al ELO de un jugador (lo crea con start_elo si no tiene), con el piso de elo_config.
create or replace function public.elo_apply_adjustment(p_steam_id text, p_delta integer)
returns void language plpgsql security definer set search_path = public as $$
declare cfg record;
begin
  select c.elo_floor, c.start_elo into cfg from elo_config c where c.id = 1;
  insert into player_elo(steam_id, elo, peak_elo) values (p_steam_id, cfg.start_elo, cfg.start_elo)
  on conflict (steam_id) do nothing;
  update player_elo
     set elo = greatest(cfg.elo_floor, elo + p_delta),
         peak_elo = greatest(peak_elo, greatest(cfg.elo_floor, elo + p_delta)),
         updated_at = now()
   where steam_id = p_steam_id;
end $$;

-- Registra y aplica el mismo ajuste a varios jugadores. Devuelve cuántos se ajustaron.
create or replace function public.elo_add_adjustment(p_steam_ids text[], p_delta integer, p_reason text,
                                                     p_at timestamptz default now())
returns integer language plpgsql security definer set search_path = public as $$
declare
  ids text[];
  x   text;
begin
  -- Desde la web solo un admin; desde el SQL Editor no hay usuario.
  if auth.uid() is not null and not is_admin() then
    raise exception 'Solo un admin puede ajustar el ELO' using errcode = '42501';
  end if;
  if p_delta is null or p_delta = 0 then
    raise exception 'El ajuste no puede ser 0' using errcode = '22023';
  end if;
  if p_reason is null or length(btrim(p_reason)) = 0 then
    raise exception 'Falta el motivo del ajuste' using errcode = '22023';
  end if;
  select array_agg(distinct s order by s) into ids from unnest(p_steam_ids) s;
  if ids is null or exists (select 1 from unnest(ids) s where s is null or s !~ '^(7656119[0-9]{10}|765612[0-9]{11})$') then
    raise exception 'SteamID64 inválido o lista vacía' using errcode = '22023';
  end if;
  if coalesce(cardinality(p_steam_ids), 0) <> cardinality(ids) then
    raise exception 'Hay SteamID64 repetidos' using errcode = '22023';
  end if;

  -- Bloquea las filas en orden (como elo_apply_match) y espera a un recálculo en curso.
  perform 1 from player_elo where steam_id = any(ids) order by steam_id for update;
  foreach x in array ids loop
    insert into elo_adjustments(steam_id, delta, reason, applied_at)
    values (x, p_delta, btrim(p_reason), coalesce(p_at, now()));
    perform elo_apply_adjustment(x, p_delta);
  end loop;
  return cardinality(ids);
end $$;

-- Deshace un ajuste (resta su delta, con el piso) y lo borra. No recalcula el historial.
create or replace function public.elo_remove_adjustment(p_id bigint)
returns void language plpgsql security definer set search_path = public as $$
declare a record;
begin
  if auth.uid() is not null and not is_admin() then
    raise exception 'Solo un admin puede ajustar el ELO' using errcode = '42501';
  end if;
  delete from elo_adjustments where id = p_id returning steam_id, delta into a;
  if not found then
    raise exception 'No existe el ajuste %', p_id using errcode = 'P0002';
  end if;
  perform elo_apply_adjustment(a.steam_id, -a.delta);
end $$;

-- Igual que en 20261011180000, pero intercala los ajustes por fecha. A la misma hora va
-- primero el ajuste. Los mixes sin fecha quedan al final, como antes.
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

revoke all on function public.elo_apply_adjustment(text, integer) from public, anon, authenticated;
revoke all on function public.elo_add_adjustment(text[], integer, text, timestamptz) from public, anon;
grant execute on function public.elo_add_adjustment(text[], integer, text, timestamptz) to authenticated;
revoke all on function public.elo_remove_adjustment(bigint) from public, anon;
grant execute on function public.elo_remove_adjustment(bigint) to authenticated;
revoke all on function public.elo_recompute_all() from public, anon;
grant execute on function public.elo_recompute_all() to authenticated;

commit;
