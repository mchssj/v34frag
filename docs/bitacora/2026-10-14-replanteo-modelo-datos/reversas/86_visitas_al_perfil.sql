-- Inversa del replanteo 86 (visitas a tu perfil): borra las visitas, las funciones y la preferencia del modo oculto.
begin;

drop function public.profile_incognito_set(boolean);
drop function public.my_profile_visits();
drop function public.profile_visit(uuid);
drop function public.bogota_week_start();
drop function public.bogota_today();
drop table public.profile_visits;
update user_preferences set preferences = preferences - 'profile_incognito' where preferences ? 'profile_incognito';

notify pgrst, 'reload schema';

commit;
