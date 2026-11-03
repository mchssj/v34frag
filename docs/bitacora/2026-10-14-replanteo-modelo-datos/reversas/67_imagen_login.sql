-- Inversa del replanteo 67: borra la imagen del inicio de sesión. El archivo queda en el bucket photos (carpeta site/):
-- borrarlo a mano si ya no se usa. La web sin la ruta deja el panel gris.
begin;
drop function if exists public.site_admin_set_auth_image(text);
drop function if exists public.site_auth_image();
drop table if exists public.site_config;
notify pgrst, 'reload schema';
commit;
