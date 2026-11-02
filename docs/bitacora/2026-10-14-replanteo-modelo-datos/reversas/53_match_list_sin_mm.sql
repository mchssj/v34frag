-- Inversa del replanteo 53: match_list vuelve a incluir la serie del matchmaking (kind = 'mm').
begin;

do $$
declare
  d text := rtrim(pg_get_viewdef('public.match_list'::regclass), E'; \n');
  opciones text := (select array_to_string(reloptions, ', ') from pg_class where oid = 'public.match_list'::regclass);
  sin text;
begin
  sin := regexp_replace(d, E'\\s*WHERE \\(m\\.kind <> ''mm''::text\\)$', '');
  if sin = d then raise exception 'inversa 53: match_list no tiene el filtro de la 53'; end if;
  execute format('create or replace view public.match_list%s as %s',
    case when opciones is not null then ' with (' || opciones || ')' else '' end, sin);
end $$;

notify pgrst, 'reload schema';

commit;
