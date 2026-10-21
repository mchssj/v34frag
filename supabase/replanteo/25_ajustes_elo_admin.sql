-- Replanteo 25: ajustes manuales de ELO desde el admin y sin "Recalcular ELO" (plan docs/bitacora/2026-10-21-ajustes-elo-admin).
--   - elo_adjust_players: el admin suma, resta o fija el ELO de hasta 10 fichas, con motivo. Cuenta desde ahora.
--   - Un ajuste "fijar" guarda el valor (set_elo): un recálculo lo vuelve a fijar en su fecha.
--   - Deshacer un ajuste resta su cambio; si eso no da lo mismo que un recálculo (un "fijar", uno anterior a una
--     temporada o con un "fijar" posterior de la misma ficha), recalcula.
--   - Desde la web ya no se recalcula ni se simula: elo_recompute_all y elo_simulate quedan solo para la base
--     (los recálculos automáticos) y el SQL Editor.
-- Necesita la 24 (temporadas).
-- NO aplicar en producción antes del corte (ver README.md).
begin;

do $$
begin
  if to_regclass('public.seasons') is null then
    raise exception 'replanteo 25: falta seasons (aplicar antes 24_temporadas.sql)';
  end if;
  if exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'elo_adjustments' and column_name = 'set_elo') then
    raise exception 'replanteo 25: elo_adjustments ya tiene set_elo (¿ya se aplicó?)';
  end if;
end $$;

alter table public.elo_adjustments add column set_elo integer check (set_elo between 0 and 10000);
comment on column public.elo_adjustments.set_elo is 'Ajuste "fijar": el ELO que queda (delta es el cambio que hubo al hacerlo). null = sumar o restar delta';

-- Fija el ELO de una ficha (la crea con start_elo si no tiene), con el piso. Como elo_apply_adjustment.
create function public.elo_apply_set(p_steam_id text, p_elo integer) returns void
  language plpgsql security definer set search_path = public as $$
declare cfg record;
begin
  p_steam_id := elo_key(p_steam_id);
  select c.elo_floor, c.start_elo into cfg from elo_config c where c.id = 1;
  insert into player_elo(steam_id, elo, peak_elo) values (p_steam_id, cfg.start_elo, cfg.start_elo)
  on conflict (steam_id) do nothing;
  update player_elo
     set elo = greatest(cfg.elo_floor, p_elo),
         peak_elo = greatest(peak_elo, greatest(cfg.elo_floor, p_elo)),
         updated_at = now()
   where steam_id = p_steam_id;
end $$;

-- Aplica un ajuste guardado: suma su delta o fija su valor.
create function public.elo_apply_adjustment_row(p_id bigint) returns void
  language plpgsql security definer set search_path = public as $$
declare a elo_adjustments%rowtype;
begin
  select * into a from elo_adjustments where id = p_id;
  if a.set_elo is not null then
    perform elo_apply_set(a.steam_id, a.set_elo);
  else
    perform elo_apply_adjustment(a.steam_id, a.delta);
  end if;
end $$;
revoke all on function public.elo_apply_set(text, integer), public.elo_apply_adjustment_row(bigint) from public, anon, authenticated;

create function pg_temp.reemplazar(fn regprocedure, cambios text[][]) returns void language plpgsql as $$
declare d text := pg_get_functiondef(fn); i int;
begin
  for i in 1 .. array_length(cambios, 1) loop
    if position(cambios[i][1] in d) = 0 then
      raise exception 'replanteo 25: en % no se encontró: %', fn, left(cambios[i][1], 80);
    end if;
    d := replace(d, cambios[i][1], cambios[i][2]);
  end loop;
  execute d;
end $$;

-- El recálculo aplica cada ajuste con su tipo.
select pg_temp.reemplazar('public.elo_recompute_all()', array[
  [E'      perform elo_apply_adjustment(ev.steam_id, ev.delta);\n',
   E'      perform elo_apply_adjustment_row(ev.aid); -- (replanteo 25) suma o fija\n']
]);

-- Desde la web no se recalcula al guardar la configuración (solo desde el SQL Editor).
select pg_temp.reemplazar('public.elo_set_config(integer, integer, numeric, integer, integer, boolean, integer, integer)', array[
  [E'    raise exception ''Solo un admin puede cambiar la configuración del ELO'' using errcode = ''42501'';\n  end if;\n',
   E'    raise exception ''Solo un admin puede cambiar la configuración del ELO'' using errcode = ''42501'';\n  end if;\n' ||
   E'  -- (replanteo 25) recalcular ya no está en la web\n' ||
   E'  if p_recompute and auth.uid() is not null then\n' ||
   E'    raise exception ''Recalcular el ELO ya no está disponible desde la web'';\n' ||
   E'  end if;\n']
]);

revoke execute on function public.elo_recompute_all() from authenticated;
revoke execute on function public.elo_simulate(integer, integer, numeric, integer, integer, integer, integer) from authenticated;

-- Admin: suma o resta p_delta, o fija p_set_elo (uno de los dos), a hasta 10 fichas con SteamID. Cuenta desde ahora.
-- Las fichas que con "fijar" ya tienen ese ELO no se ajustan (adjustment_id null).
create function public.elo_adjust_players(p_players uuid[], p_delta integer, p_set_elo integer, p_reason text)
  returns table(adjustment_id bigint, player_id uuid, nick text, elo_before integer, elo_after integer)
  language plpgsql security definer set search_path = public as $$
declare
  cfg    record;
  p      record;
  v_n    integer;
  v_bef  integer;
  v_aft  integer;
  v_id   bigint;
begin
  if auth.uid() is not null and not is_admin() then
    raise exception 'Solo un admin puede ajustar el ELO' using errcode = '42501';
  end if;
  if (p_delta is null) = (p_set_elo is null) then
    raise exception 'Elegí sumar o restar, o fijar el ELO (uno de los dos)';
  end if;
  if p_delta is not null and (p_delta = 0 or p_delta not between -500 and 500) then
    raise exception 'El ajuste tiene que estar entre -500 y +500, sin 0';
  end if;
  if p_set_elo is not null and p_set_elo not between 0 and 10000 then
    raise exception 'El ELO fijado tiene que estar entre 0 y 10000';
  end if;
  if p_reason is null or length(btrim(p_reason)) not between 1 and 200 then
    raise exception 'El motivo es obligatorio (hasta 200 caracteres)';
  end if;
  select count(distinct x) into v_n from unnest(p_players) x where x is not null;
  if v_n = 0 or v_n > 10 or v_n <> coalesce(cardinality(p_players), 0) then
    raise exception 'Elegí de 1 a 10 jugadores, sin repetir';
  end if;
  if (select count(*) from players pl where pl.id = any(p_players) and pl.steam_id is not null) <> v_n then
    raise exception 'Algún jugador no existe o no tiene SteamID (sin SteamID no tiene ELO)';
  end if;

  select c.elo_floor, c.start_elo into cfg from elo_config c where c.id = 1;
  -- Bloquea las filas en orden (como elo_add_adjustment) y espera a un recálculo o cierre de temporada en curso.
  perform 1 from player_elo e where e.steam_id in (select pl.steam_id from players pl where pl.id = any(p_players))
   order by e.steam_id for update;

  for p in select pl.id, pl.nick, pl.steam_id from players pl where pl.id = any(p_players) order by pl.steam_id loop
    select e.elo into v_bef from player_elo e where e.steam_id = p.steam_id;
    v_bef := coalesce(v_bef, cfg.start_elo);
    v_aft := greatest(cfg.elo_floor, coalesce(p_set_elo, v_bef + p_delta));
    v_id := null;
    if p_delta is not null or v_aft <> v_bef then
      insert into elo_adjustments(steam_id, delta, set_elo, reason)
      values (p.steam_id, coalesce(p_delta, v_aft - v_bef), case when p_set_elo is not null then v_aft end, btrim(p_reason))
      returning id into v_id;
      perform elo_apply_adjustment_row(v_id);
      select e.elo into v_aft from player_elo e where e.steam_id = p.steam_id;
    end if;
    adjustment_id := v_id; player_id := p.id; nick := p.nick; elo_before := v_bef; elo_after := v_aft;
    return next;
  end loop;
end $$;
revoke all on function public.elo_adjust_players(uuid[], integer, integer, text) from public, anon;
grant execute on function public.elo_adjust_players(uuid[], integer, integer, text) to authenticated;

-- Deshace un ajuste. Restar su cambio da lo mismo que un recálculo salvo con un "fijar", con un cierre o comienzo de
-- temporada después del ajuste, o con un "fijar" posterior de la misma ficha: ahí recalcula todo.
create or replace function public.elo_remove_adjustment(p_id bigint)
returns void language plpgsql security definer set search_path = public as $$
declare
  a           elo_adjustments%rowtype;
  v_recompute boolean;
begin
  if auth.uid() is not null and not is_admin() then
    raise exception 'Solo un admin puede ajustar el ELO' using errcode = '42501';
  end if;
  select * into a from elo_adjustments where id = p_id for update;
  if a.id is null then
    raise exception 'No existe el ajuste %', p_id using errcode = 'P0002';
  end if;
  v_recompute := a.set_elo is not null
    or exists (select 1 from seasons s where coalesce(s.closed_at, s.starts_at) >= a.applied_at)
    or exists (select 1 from elo_adjustments b
                where b.id <> a.id and b.set_elo is not null and b.applied_at >= a.applied_at and elo_key(b.steam_id) = elo_key(a.steam_id));
  delete from elo_adjustments where id = p_id;
  if v_recompute then
    perform elo_recompute_all();
  else
    perform elo_apply_adjustment(a.steam_id, -a.delta);
  end if;
end $$;

-- Ajustes de un jugador (públicos, en su perfil): por sus SteamID, así siguen a la ficha.
create view public.player_elo_adjustment_list with (security_invoker = true) as
select a.id, x.player_id, a.delta, a.set_elo, a.reason, a.applied_at
  from elo_adjustments a
  join player_steam_all x on x.steam_id = a.steam_id;
comment on view public.player_elo_adjustment_list is 'Ajustes manuales de ELO de cada jugador: cambio, valor fijado, motivo y fecha';

-- Listado del admin: con la ficha, quién lo hizo y búsqueda.
create view public.admin_elo_adjustment_list with (security_invoker = true) as
select a.id, x.player_id, p.nick, a.steam_id, a.delta, a.set_elo, a.reason, a.applied_at, a.created_by,
       pr.tag as created_by_alias, search_norm(concat_ws(' ', p.nick, a.reason, a.steam_id)) as search
  from elo_adjustments a
  left join player_steam_all x on x.steam_id = a.steam_id
  left join players p on p.id = x.player_id
  left join profiles pr on pr.id = a.created_by
 where is_admin();
comment on view public.admin_elo_adjustment_list is 'Ajustes manuales de ELO para el admin';

grant select on public.player_elo_adjustment_list to anon, authenticated;
grant select on public.admin_elo_adjustment_list to authenticated;

commit;
