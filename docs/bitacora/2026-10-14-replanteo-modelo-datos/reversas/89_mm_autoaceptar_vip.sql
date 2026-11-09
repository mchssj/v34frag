-- Inversa del replanteo 89 (autoaceptar partida para VIP): saca el trigger, las funciones, `auto_accept` del estado de
-- Jugar y la preferencia.
begin;

create or replace function pg_temp.reemplazar(fn regprocedure, cambios text[][]) returns void language plpgsql as $$
declare d text := pg_get_functiondef(fn); i int; a text; b text;
begin
  for i in 1 .. array_length(cambios, 1) loop
    a := replace(cambios[i][1], E'\r', ''); b := replace(cambios[i][2], E'\r', '');
    if position(a in d) = 0 then
      raise exception 'inversa 89: en % no se encontró: %', fn, left(a, 80);
    end if;
    d := replace(d, a, b);
  end loop;
  execute d;
end $$;

select pg_temp.reemplazar('public.mm_my_profile()', array[
  array[$a$    'auto_accept', jsonb_build_object('enabled', mm_auto_accept_on(me), 'allowed', v_vip),
    'sounds', jsonb_build_object($a$,
        $b$    'sounds', jsonb_build_object($b$]]);

drop trigger mm_lobby_players_auto_accept on public.mm_lobby_players;
drop function public.tg_mm_lobby_players_auto_accept();
drop function public.mm_set_auto_accept(boolean);
drop function public.mm_auto_accept_on(uuid);
update user_preferences set preferences = preferences - 'mm_auto_accept' where preferences ? 'mm_auto_accept';

notify pgrst, 'reload schema';

commit;
