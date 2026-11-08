-- 88: las PCW no dan ELO (bitácora docs/bitacora/2026-11-08-pcw-demo, Kyan 2026-11-08).
--
-- Cada mapa de una PCW se guarda como un mix vinculado con !match (matches.parent_match_id). Hasta ahora recibía ELO
-- como cualquier mix. Desde esta, ningún mapa vinculado a una partida kind = 'pcw' suma ni resta ELO, nunca: ni como
-- equipo ni como mix de amigos. Las stats del mapa, la demo y los puntos del ranking de equipos no cambian. Los mapas
-- del matchmaking y de los torneos siguen dando ELO.
--
--   1. elo_apply_match no hace nada con un mapa de una PCW. Cubre la ingesta (vincula antes de aplicar el ELO), el cierre
--      de un mix en vivo, el mix interrumpido que aprueba un admin y los recálculos (elo_recompute_all y temporadas).
--   2. Trigger matches_elo_pcw_link: si un mapa que ya tenía ELO pasa a una PCW (vínculo hecho después, a mano o al
--      aprobarlo), o un mapa sale de una PCW, se recalcula todo el ELO. elo_recompute_all lo permite aunque lo haga un
--      moderador (solo desde este trigger).
--   3. Al aplicarse, si alguna PCW ya jugada tiene ELO, recalcula todo una vez: el ELO de todos queda como si las PCW
--      nunca hubieran contado.
-- Necesita la 07 (parent_match_id) y la 24 (temporadas). Inversa: docs/bitacora/2026-10-14-replanteo-modelo-datos/reversas/88_pcw_sin_elo.sql.
begin;

do $$
begin
  if not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'matches' and column_name = 'parent_match_id') then
    raise exception 'replanteo 88: falta la 07 (matches.parent_match_id)';
  end if;
  if to_regclass('public.seasons') is null then
    raise exception 'replanteo 88: falta la 24 (seasons)';
  end if;
  if to_regprocedure('public.elo_pcw_link()') is not null then
    raise exception 'replanteo 88: ya se aplicó (elo_pcw_link existe)';
  end if;
end $$;

create function pg_temp.reemplazar(fn regprocedure, cambios text[][]) returns void language plpgsql as $$
declare d text := pg_get_functiondef(fn); i int;
begin
  for i in 1 .. array_length(cambios, 1) loop
    if position(cambios[i][1] in d) = 0 then
      raise exception 'replanteo 88: en % no se encontró: %', fn, left(cambios[i][1], 80);
    end if;
    d := replace(d, cambios[i][1], cambios[i][2]);
  end loop;
  execute d;
end $$;

-- 1. Un mapa de una PCW no da ELO. Va antes del chequeo de temporadas, para que un mapa de PCW que llega tarde no recalcule.
select pg_temp.reemplazar('public.elo_apply_match(uuid)', array[
  [E'  if exists (select 1 from match_player_stats where match_id = p_match and elo_after is not null) then return; end if;\n',
   E'  -- (replanteo 88) los mapas de una PCW no dan ELO\n' ||
   E'  if exists (select 1 from matches g join matches p on p.id = g.parent_match_id where g.id = p_match and p.kind = ''pcw'') then return; end if;\n' ||
   E'  if exists (select 1 from match_player_stats where match_id = p_match and elo_after is not null) then return; end if;\n']
]);

-- 2. El recálculo que dispara el trigger de abajo lo puede causar un moderador (vincular o desvincular un mapa).
select pg_temp.reemplazar('public.elo_recompute_all()', array[
  ['if auth.uid() is not null and not is_admin() then',
   'if auth.uid() is not null and not is_admin() and current_setting(''v34.elo_pcw_link'', true) is distinct from ''on'' then -- (replanteo 88)']
]);

create function public.elo_pcw_link() returns trigger
  language plpgsql security definer set search_path = public as $$
declare
  antes   boolean := exists (select 1 from matches where id = old.parent_match_id and kind = 'pcw');
  despues boolean := exists (select 1 from matches where id = new.parent_match_id and kind = 'pcw');
begin
  if antes = despues or new.status <> 'finished' or current_setting('v34.elo_recompute', true) = 'on' then
    return null;
  end if;
  -- Entra a una PCW sin ELO aplicado (la ingesta vincula antes de aplicarlo): no hay nada que deshacer.
  if despues and not exists (select 1 from match_player_stats where match_id = new.id and elo_after is not null) then
    return null;
  end if;
  perform set_config('v34.elo_pcw_link', 'on', true);
  perform elo_recompute_all();
  perform set_config('v34.elo_pcw_link', 'off', true);
  return null;
end $$;
revoke all on function public.elo_pcw_link() from public, anon, authenticated;
comment on function public.elo_pcw_link() is 'Recalcula el ELO cuando un mapa con ELO entra a una PCW o un mapa sale de una PCW (las PCW no dan ELO)';

create trigger matches_elo_pcw_link after update of parent_match_id on public.matches
  for each row when (old.kind = 'mix' and old.parent_match_id is distinct from new.parent_match_id)
  execute function public.elo_pcw_link();

-- 3. Las PCW ya jugadas que tienen ELO: un recálculo deja el ELO de todos como si nunca hubieran contado.
do $$
declare n int;
begin
  if exists (select 1 from matches g join matches p on p.id = g.parent_match_id
               join match_player_stats s on s.match_id = g.id
              where p.kind = 'pcw' and s.elo_after is not null) then
    n := elo_recompute_all();
    raise notice 'replanteo 88: ELO recalculado sin las PCW (% mixes)', n;
  end if;
end $$;

commit;
