-- Inversa de supabase/replanteo/38_ips_jugadores.sql. Las tablas de la migración 20261029180000 quedan.
begin;

do $$
begin
  if to_regprocedure('public.admin_player_ips(uuid)') is null then
    raise exception 'inversa 38: no existe admin_player_ips (¿no se aplicó la 38?)';
  end if;
end $$;

drop function public.admin_player_ips(uuid);

notify pgrst, 'reload schema';

commit;
