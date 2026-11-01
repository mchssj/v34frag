-- Inversa de supabase/replanteo/12_servidores.sql.
begin;

create function pg_temp.reemplazar(fn regprocedure, cambios text[][]) returns void language plpgsql as $$
declare d text := pg_get_functiondef(fn); i int;
begin
  for i in 1 .. array_length(cambios, 1) loop
    if position(cambios[i][1] in d) = 0 then
      raise exception 'inversa 12: en % no se encontró: %', fn, left(cambios[i][1], 80);
    end if;
    d := replace(d, cambios[i][1], cambios[i][2]);
  end loop;
  execute d;
end $$;

select pg_temp.reemplazar('public.match_schedule(uuid, timestamptz, uuid)', array[
  ['select 1 from game_servers where id = p_server and active' || E'\n' ||
   '      and (license_expires_at is null or license_expires_at > now())) then -- (replanteo 12) licencia vigente' || E'\n' ||
   '    raise exception ''Ese servidor no existe, no está activo o tiene la licencia vencida'';' || E'\n' ||
   '  end if;',
   'select 1 from game_servers where id = p_server and active) then raise exception ''Ese servidor no existe o no está activo''; end if;']
]);

create or replace view public.game_servers_public as
select id, name, connect_address from game_servers where active;

drop view public.admin_server_list;
drop trigger game_servers_no_borrar_con_partidas on public.game_servers;
drop function public.game_servers_no_borrar_con_partidas();
drop function public.admin_create_server(text, text, text, timestamptz, text);
alter table public.game_servers drop constraint game_servers_allowed_ip_format;
alter table public.game_servers drop constraint game_servers_name_len;
drop index public.game_servers_name_key;
drop function public.is_ip(text);
commit;
