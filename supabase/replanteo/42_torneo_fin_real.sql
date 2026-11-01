-- Replanteo 42: cuándo terminó de verdad un torneo (bitácora docs/bitacora/2026-11-01-admin-torneos, ajuste del 2026-11-01).
-- events.ends_on es una fecha tentativa que pone el organizador: el torneo puede terminar antes o después. La fecha del
-- campeón sale de la última partida terminada (event_list.finished_at). Las partidas de torneo y PCW que terminan sin fecha
-- (resultado a mano, W.O.) quedan con la del momento en que se cargó el resultado.
-- NO aplicar en producción antes del corte (ver README.md).
begin;

do $$
begin
  if to_regprocedure('public.can_own_event(uuid)') is null then
    raise exception 'replanteo 42: falta el replanteo 41 (aplicar antes 41_admin_torneos.sql)';
  end if;
  if exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'event_list' and column_name = 'finished_at') then
    raise exception 'replanteo 42: event_list ya tiene finished_at (¿ya se aplicó?)';
  end if;
end $$;

-- Suma columnas al final de una vista (como en la 33 y la 39). Busca el FROM de primer nivel.
create function pg_temp.sumar_columnas(v regclass, cols text) returns void language plpgsql as $$
declare d text := pg_get_viewdef(v, true); marca text := E'\n   FROM '; n int;
begin
  n := (length(d) - length(replace(d, marca, ''))) / length(marca);
  if n <> 1 then raise exception 'replanteo 42: la vista % tiene % FROM de primer nivel', v, n; end if;
  execute format('create or replace view %s with (security_invoker = true) as %s', v,
                 replace(d, marca, E',\n    ' || cols || marca));
end $$;

-- Terminado: cuándo se jugó (o se cargó) la última partida. null mientras no terminó.
select pg_temp.sumar_columnas('public.event_list',
  'CASE WHEN e.status = ''finished''::text THEN ( SELECT max(COALESCE(m.played_at, m.starts_at)) FROM matches m '
  || 'WHERE m.event_id = e.id AND m.status = ''finished''::text AND NOT m.bye) END AS finished_at');

-- Un resultado cargado a mano o un W.O. no traía fecha: al terminar sin played_at, queda la de ese momento
-- (los mixes la traen del servidor).
create function public.matches_played_at() returns trigger
  language plpgsql set search_path = public as $$
begin
  if new.kind <> 'mix' and new.status = 'finished' and new.played_at is null
     and (tg_op = 'INSERT' or old.status is distinct from 'finished') then
    new.played_at := now();
  end if;
  return new;
end $$;
create trigger matches_played_at before insert or update of status on public.matches
  for each row execute function public.matches_played_at();

comment on column public.events.ends_on is 'Fecha tentativa de fin que pone el organizador (puede terminar antes o después). La real: event_list.finished_at';

commit;
