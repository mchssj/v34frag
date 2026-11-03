-- Corte 2026-11-03: las funciones de public cargadas desde Windows tienen CR en el cuerpo y los replanteos que
-- buscan y reemplazan texto no lo encuentran. Se vuelven a crear con la misma definición, sin CR. Los permisos
-- y el dueño se mantienen con create or replace.
begin;
do $$
declare r record; n int := 0;
begin
  for r in select p.oid from pg_proc p join pg_namespace ns on ns.oid = p.pronamespace
            where ns.nspname = 'public' and p.prokind = 'f' and position(chr(13) in p.prosrc) > 0 loop
    execute replace(pg_get_functiondef(r.oid), chr(13), '');
    n := n + 1;
  end loop;
  if exists (select 1 from pg_proc p join pg_namespace ns on ns.oid = p.pronamespace
              where ns.nspname = 'public' and position(chr(13) in p.prosrc) > 0) then
    raise exception 'corte: quedan funciones con CR';
  end if;
  raise notice 'funciones normalizadas: %', n;
end $$;
commit;
