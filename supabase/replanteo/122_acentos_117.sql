-- 122: los acentos rotos de la 117 en producción (bitácora docs/bitacora/2026-11-15-acentos-117, pedido por Daniel el
-- 2026-11-15).
--
-- La 117 se aplicó en producción leyendo el archivo como WIN1252 y no como UTF-8: quedaron textos como "acciÃ³n" en
-- vez de "acción" (y con \r\n). La 121 reescribió bien ban_create, ban_update y ban_support_quota. Esta arregla lo
-- demás: ban_lift, clip_reject, clip_reprocess, clip_review_ok, mm_admin_lists, profile_comment_delete,
-- team_staff_remove_logo y los comentarios de public que quedaron rotos (en producción, los de support_actions,
-- match_clips.video_reprocessed_by y support_actions_list).
--
-- Toma cada definición de la base y reemplaza solo las secuencias rotas (algunas de esas funciones mezclan texto roto
-- con texto que ya estaba bien), y quita los \r de los finales de línea. Donde no hay nada roto, no cambia nada.
-- create or replace conserva el dueño y los permisos. No tiene inversa: volver a romper los acentos no sirve.
-- Se aplica después de la 121. Pruebas: docs/bitacora/2026-11-15-acentos-117/pruebas/probar_122.sql (con rollback).
begin;

-- Cada carácter con su versión rota (sus bytes UTF-8 leídos como WIN1252). Se arma acá, con chr(), para no escribir
-- texto roto ni depender de la codificación con la que se lea este archivo: á é í ó ú Á É Ó Ú ñ Ñ ü Ü ¿ ¡ « » ° º ª
-- – — ‘ ’ “ ” … • › ‹ €. Á, Í y los que tienen un byte que WIN1252 no define no pudieron quedar rotos así.
create function pg_temp.acentos(t text) returns text language plpgsql immutable as $$
declare n int; roto text;
begin
  if t is null then return null; end if;
  foreach n in array array[225, 233, 237, 243, 250, 193, 201, 211, 218, 241, 209, 252, 220, 191, 161, 171, 187, 176, 186, 170,
                           8211, 8212, 8216, 8217, 8220, 8221, 8230, 8226, 8250, 8249, 8364] loop
    begin
      roto := convert_from(convert_to(chr(n), 'UTF8'), 'WIN1252');
    exception when others then
      continue;
    end;
    t := replace(t, roto, chr(n));
  end loop;
  return t;
end $$;

-- Lo mismo, y los finales de línea \r\n pasan a \n.
create function pg_temp.arreglar(t text) returns text language sql immutable as $$
  select replace(pg_temp.acentos(t), chr(13) || chr(10), chr(10))
$$;

do $$
declare fn regprocedure; d text; nuevo text; arregladas text[] := '{}';
begin
  foreach fn in array array[
    to_regprocedure('public.ban_lift(uuid, text)'),
    to_regprocedure('public.clip_reject(uuid, text)'),
    to_regprocedure('public.clip_reprocess(uuid)'),
    to_regprocedure('public.clip_review_ok(uuid)'),
    to_regprocedure('public.mm_admin_lists(text, text)'),
    to_regprocedure('public.profile_comment_delete(uuid)'),
    to_regprocedure('public.team_staff_remove_logo(uuid, text)')] loop
    continue when fn is null;
    d := pg_get_functiondef(fn);
    nuevo := pg_temp.arreglar(d);
    if nuevo is distinct from d then
      execute nuevo;
      arregladas := arregladas || fn::text;
    end if;
  end loop;
  raise notice '122: funciones arregladas: %', coalesce(nullif(array_to_string(arregladas, ', '), ''), 'ninguna');
end $$;

-- Los comentarios rotos de public (tablas, columnas y funciones): se reescriben con comment on.
do $$
declare o record; tipo text;
begin
  for o in
    select d.description, i.type, i.identity
      from pg_description d, lateral pg_identify_object(d.classoid, d.objoid, d.objsubid) i
     where i.schema = 'public' and d.description <> pg_temp.acentos(d.description)
  loop
    tipo := case o.type when 'table column' then 'column' when 'view column' then 'column' else o.type end;
    execute format('comment on %s %s is %L', tipo, o.identity, pg_temp.acentos(o.description));
    raise notice '122: comentario arreglado: % %', tipo, o.identity;
  end loop;
end $$;

-- No queda nada roto en public (ninguna función ni comentario).
do $$
declare quedan text;
begin
  select string_agg(x, ', ') into quedan from (
    select p.oid::regprocedure::text as x from pg_proc p join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public' and p.prosrc <> pg_temp.acentos(p.prosrc)
    union all
    select d.classoid::regclass::text || ' ' || d.objoid || '.' || d.objsubid from pg_description d
     where d.description <> pg_temp.acentos(d.description)
  ) s;
  if quedan is not null then raise exception '122: siguen con acentos rotos: %', quedan; end if;
end $$;

notify pgrst, 'reload schema';

commit;
