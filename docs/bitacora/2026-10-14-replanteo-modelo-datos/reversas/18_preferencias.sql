-- Inversa de supabase/replanteo/18_preferencias.sql: deja la estructura como estaba después de la 17.
-- Se pierden las preferencias guardadas (el frontend sigue con las del navegador).
begin;

do $$
begin
  if to_regclass('public.user_preferences') is null then
    raise exception 'inversa 18: user_preferences no existe (¿no se aplicó la 18?)';
  end if;
end $$;

drop function public.set_my_preferences(jsonb);
drop table public.user_preferences;

commit;
