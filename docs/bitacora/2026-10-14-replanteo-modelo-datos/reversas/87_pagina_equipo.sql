-- Inversa del replanteo 87 (la página del Equipo): borra las funciones y la preferencia de ocultarse de la lista de VIP.
begin;

drop function public.vip_list_hidden_set(boolean);
drop function public.vip_list_me();
drop function public.staff_public();
update user_preferences set preferences = preferences - 'vip_list_hidden' where preferences ? 'vip_list_hidden';

notify pgrst, 'reload schema';

commit;
