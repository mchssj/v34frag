-- Replanteo 54: imagen fija de la tarjeta del MVP (bitácora docs/bitacora/2026-11-02-ajustes-primer-mm).
-- Una sola imagen, la sube un admin en Administración › Matchmaking › General (bucket photos, carpeta mm/). Se usa en
-- la sala del matchmaking y en el detalle de un mix. Sin imagen, la tarjeta queda lisa (antes usaba la foto del mapa).
--   - mm_config.mvp_image_url (mm_admin_config la devuelve sola: es to_jsonb de la fila).
--   - mm_admin_set_mvp_image(url): la guarda (null = quitar) y devuelve la anterior, para borrarla del bucket.
--   - mm_mvp_image(): la URL, para cualquier usuario con sesión (detalle del mix).
--   - mm_lobby_json suma mvp_image_url.
-- Va después de la 52.
begin;

do $$
begin
  if to_regclass('public.mm_config') is null then
    raise exception 'replanteo 54: falta mm_config (aplicar antes 48_matchmaking.sql)';
  end if;
end $$;

alter table public.mm_config add column mvp_image_url text;
comment on column public.mm_config.mvp_image_url is 'Imagen de la tarjeta del MVP (bucket photos, carpeta mm/); null = fondo liso (replanteo 54)';

create function public.mm_admin_set_mvp_image(p_url text) returns text
  language plpgsql security definer set search_path = public as $$
declare v_old text;
begin
  perform mm_admin_guard();
  select mvp_image_url into v_old from mm_config for update;
  update mm_config set mvp_image_url = nullif(trim(p_url), '');
  return v_old;
end $$;

create function public.mm_mvp_image() returns text
  language sql stable security definer set search_path = public as $$ select mvp_image_url from mm_config $$;

revoke all on function public.mm_admin_set_mvp_image(text), public.mm_mvp_image() from public, anon, authenticated;
grant execute on function public.mm_admin_set_mvp_image(text), public.mm_mvp_image() to authenticated, service_role;

drop function if exists pg_temp.reemplazar(regprocedure, text[]);
create function pg_temp.reemplazar(fn regprocedure, cambios text[][]) returns void language plpgsql as $$
declare d text := pg_get_functiondef(fn); i int;
begin
  for i in 1 .. array_length(cambios, 1) loop
    if position(cambios[i][1] in d) = 0 then
      raise exception 'replanteo 54: en % no se encontró: %', fn, left(cambios[i][1], 80);
    end if;
    d := replace(d, cambios[i][1], cambios[i][2]);
  end loop;
  execute d;
end $$;

select pg_temp.reemplazar('public.mm_lobby_json(uuid, uuid)'::regprocedure, array[
  [$q$'end_reason', l.end_reason, 'region', srv.region,$q$,
   $q$'end_reason', l.end_reason, 'region', srv.region, 'mvp_image_url', (select mvp_image_url from mm_config),$q$]]);

notify pgrst, 'reload schema';

commit;
