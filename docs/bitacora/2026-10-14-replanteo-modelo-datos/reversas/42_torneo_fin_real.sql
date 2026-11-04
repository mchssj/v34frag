-- Inversa de supabase/replanteo/42_torneo_fin_real.sql: event_list sin finished_at.
-- create or replace no saca columnas: la vista se borra y se crea (no tiene vistas que dependan de ella).
begin;

do $$
declare
  d text := pg_get_viewdef('public.event_list'::regclass, true);
  n text;
begin
  if position('AS finished_at' in d) = 0 then
    raise exception 'inversa 42: event_list no tiene finished_at (¿no se aplicó la 42?)';
  end if;
  n := regexp_replace(d, ',\s*CASE\s+WHEN e\.status = ''finished''::text THEN \(.*?\)\s+ELSE NULL::timestamp with time zone\s+END AS finished_at', '', 's');
  if n = d then
    n := regexp_replace(d, ',\s*CASE\s+WHEN e\.status = ''finished''::text THEN \(.*?\)\s+END AS finished_at', '', 's');
  end if;
  if position('finished_at' in n) > 0 then raise exception 'inversa 42: no se pudo sacar finished_at de event_list'; end if;
  drop view public.event_list;
  execute format('create view public.event_list with (security_invoker = true) as %s', n);
  grant select on public.event_list to anon, authenticated, service_role;
end $$;

drop trigger if exists matches_played_at on public.matches;
drop function if exists public.matches_played_at();
comment on column public.events.ends_on is null;

commit;
