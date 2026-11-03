-- Replanteo 67: imagen del panel de Iniciar sesión, Registro y Bienvenida (bitácora docs/bitacora/2026-11-03-imagen-login).
-- Una sola imagen 4:5, la sube un admin en Administración › Usuarios › Inicio de sesión (bucket photos, carpeta site/).
-- Sin imagen, el panel queda gris.
--   - site_config: configuración del sitio fuera de un módulo, una sola fila (id = 1). RLS sin políticas: solo por funciones.
--   - site_auth_image(): la URL, para cualquiera (anon incluido: el login se ve sin sesión).
--   - site_admin_set_auth_image(url): la guarda (null o vacío = quitar) y devuelve la anterior, para borrarla del bucket.
-- Los UPDATE llevan where id = 1 por pg_safeupdate (ver el replanteo 62). Va después de la 66.
begin;

create table public.site_config (
  id int primary key default 1 check (id = 1),
  auth_image_url text
);
comment on table public.site_config is 'Configuración del sitio fuera de un módulo, una sola fila (replanteo 67)';
comment on column public.site_config.auth_image_url is 'Imagen del panel de Iniciar sesión, Registro y Bienvenida (bucket photos, carpeta site/); null = panel gris';
insert into public.site_config (id) values (1);
alter table public.site_config enable row level security;
revoke all on table public.site_config from public, anon, authenticated;

create function public.site_auth_image() returns text
  language sql stable security definer set search_path = public as $$ select auth_image_url from site_config where id = 1 $$;

create function public.site_admin_set_auth_image(p_url text) returns text
  language plpgsql security definer set search_path = public as $$
declare v_old text;
begin
  if not is_admin() then raise exception 'Solo admins' using errcode = '42501'; end if;
  select auth_image_url into v_old from site_config where id = 1 for update;
  update site_config set auth_image_url = nullif(trim(p_url), '') where id = 1;
  return v_old;
end $$;

revoke all on function public.site_auth_image(), public.site_admin_set_auth_image(text) from public, anon, authenticated;
grant execute on function public.site_auth_image() to anon, authenticated, service_role;
grant execute on function public.site_admin_set_auth_image(text) to authenticated, service_role;

notify pgrst, 'reload schema';

commit;
