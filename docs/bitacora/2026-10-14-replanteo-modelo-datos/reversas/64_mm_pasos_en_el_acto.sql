-- Inversa del replanteo 64: vuelve mm_try_build, mm_join, mm_accept y mm_ban_map como en la 63 y borra las funciones
-- nuevas. Todo vuelve a pasar en el tick.
begin;

create or replace function pg_temp.reemplazar(fn regprocedure, cambios text[][]) returns void language plpgsql as $$
declare d text := pg_get_functiondef(fn); i int; a text; b text;
begin
  for i in 1 .. array_length(cambios, 1) loop
    a := replace(cambios[i][1], E'\r', ''); b := replace(cambios[i][2], E'\r', '');
    if position(a in d) = 0 then
      raise exception 'inversa 64: en % no se encontró: %', fn, left(a, 80);
    end if;
    d := replace(d, a, b);
  end loop;
  execute d;
end $$;

select pg_temp.reemplazar('public.mm_try_build(text)', array[
  ['    -- (replanteo 64) Las filas de todos, bloqueadas: si alguien canceló mientras tanto, esta combinación no va.' || E'\n' ||
   '    if (select count(*) from (select 1 from mm_queue where user_id = any(v_users) for update) x) <> cardinality(v_users) then continue; end if;' || E'\n', '']
]);
select pg_temp.reemplazar('public.mm_join(text, text)', array[
  ['  -- (replanteo 64) Si con este completa una sala, se arma ahora y no en el próximo tick.' || E'\n' ||
   '  perform mm_try_build_now(p_mode);' || E'\n', '']
]);
select pg_temp.reemplazar('public.mm_accept()', array[
  [E'\n' || '  -- (replanteo 64) El último en aceptar arranca el veto (la sala está bloqueada: el tick espera y la ve en veto).' || E'\n' ||
   '  if not exists (select 1 from mm_lobby_players where lobby_id = v_lobby and accepted_at is null) then perform mm_start_veto(v_lobby); end if;', '']
]);
select pg_temp.reemplazar('public.mm_ban_map(uuid, text, uuid)', array[
  [E'\n' || '  -- (replanteo 64) Con el último mapa, el servidor en el acto y no en el próximo tick.' || E'\n' ||
   '  if v_count = 1 then perform mm_assign_server(p_lobby); end if;', '']
]);

drop function public.mm_assign_server(uuid), public.mm_try_build_now(text);

notify pgrst, 'reload schema';

commit;
