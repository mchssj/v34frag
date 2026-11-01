-- Pruebas de supabase/replanteo/20_servidores_modo_region.sql (correr con la migración aplicada). Todo con rollback.
begin;

create function pg_temp.ok(c boolean, msg text) returns void language plpgsql as $$
begin
  if not coalesce(c, false) then raise exception 'FALLA: %', msg; end if;
  raise notice 'OK: %', msg;
end $$;
grant execute on function pg_temp.ok(boolean, text) to anon, authenticated;

insert into public.game_servers(id, name, token_hash, mode, region) values
  ('aaaaaaaa-2000-4000-8000-000000000001', 'Servidor 20 A', 'hash-20-a', 'mix', 'Argentina'),
  ('aaaaaaaa-2000-4000-8000-000000000002', 'Servidor 20 B', 'hash-20-b', null, null);

do $$ begin
  begin
    update public.game_servers set mode = 'surf' where id = 'aaaaaaaa-2000-4000-8000-000000000002';
    raise exception 'FALLA: aceptó un modo fuera de la lista';
  exception when check_violation then raise notice 'OK: rechaza un modo fuera de la lista';
  end;
  begin
    update public.game_servers set region = 'A' where id = 'aaaaaaaa-2000-4000-8000-000000000002';
    raise exception 'FALLA: aceptó una región de 1 carácter';
  exception when check_violation then raise notice 'OK: rechaza una región de 1 carácter';
  end;
  begin
    update public.game_servers set region = ' Chile' where id = 'aaaaaaaa-2000-4000-8000-000000000002';
    raise exception 'FALLA: aceptó una región con espacios a los lados';
  exception when check_violation then raise notice 'OK: rechaza una región con espacios a los lados';
  end;
end $$;

set local role anon;
select set_config('request.jwt.claims', '{"role":"anon"}', true);
do $$ begin
  perform pg_temp.ok((select mode = 'mix' and region = 'Argentina' from public.game_servers_public where id = 'aaaaaaaa-2000-4000-8000-000000000001'),
                     'game_servers_public trae modo y región');
  perform pg_temp.ok((select mode is null and region is null from public.game_servers_public where id = 'aaaaaaaa-2000-4000-8000-000000000002'),
                     'sin cargar quedan en null');
end $$;
reset role;

-- La búsqueda del admin incluye la región (la vista es security_invoker: se prueba como dueño).
do $$ begin
  perform pg_temp.ok((select count(*) from public.admin_server_list where search like '%' || search_norm('argentina') || '%'
                        and id = 'aaaaaaaa-2000-4000-8000-000000000001') = 1, 'admin_server_list busca por región');
  perform pg_temp.ok((select mode from public.admin_server_list where id = 'aaaaaaaa-2000-4000-8000-000000000001') = 'mix', 'admin_server_list trae el modo');
end $$;

rollback;
