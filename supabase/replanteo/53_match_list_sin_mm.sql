-- Replanteo 53: la serie del matchmaking fuera de match_list (bitácora docs/bitacora/2026-11-02-ajustes-primer-mm).
-- Cada partida del matchmaking es una fila kind = 'mm' (veto, chat y resultado) más el mapa jugado (un mix con
-- parent_match_id). La serie salía en Partidas sin etiqueta y se abría como una de torneo o PCW: queda el mix.
-- La vista se rehace desde su definición actual (pg_get_viewdef), con sus opciones (security_invoker). Va después de la 48.
begin;

do $$
declare
  d text := rtrim(pg_get_viewdef('public.match_list'::regclass), E'; \n');
  opciones text := (select array_to_string(reloptions, ', ') from pg_class where oid = 'public.match_list'::regclass);
begin
  if d ~* 'kind <> ''mm''' then raise exception 'replanteo 53: match_list ya excluye kind = mm (¿ya se aplicó?)'; end if;
  -- La consulta principal termina en sus joins, sin WHERE: el filtro va al final.
  if d !~* 'LEFT JOIN match_crashes mc ON \(\(mc\.match_id = m\.id\)\)\)$' then
    raise exception 'replanteo 53: match_list no termina como se esperaba; revisar la vista antes de aplicar';
  end if;
  execute format('create or replace view public.match_list%s as %s %s',
    case when opciones is not null then ' with (' || opciones || ')' else '' end, d, E'\n  WHERE m.kind <> ''mm''::text');
end $$;

notify pgrst, 'reload schema';

commit;
