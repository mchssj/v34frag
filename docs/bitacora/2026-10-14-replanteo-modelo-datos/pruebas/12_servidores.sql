-- Pruebas de supabase/replanteo/12_servidores.sql (correr con la migración aplicada). Todo con rollback.
begin;

create function pg_temp.como(u text) returns void language sql as $$
  select set_config('request.jwt.claims', case when u is null then '{"role":"anon"}'
         else format('{"sub":"%s","role":"authenticated"}', u) end, true) $$;
grant execute on function pg_temp.como(text) to anon, authenticated;
create table pg_temp.t(k text primary key, v text);
grant all on pg_temp.t to anon, authenticated;

insert into auth.users (id, email, raw_user_meta_data) values
  ('aaaaaaaa-1200-4000-8000-0000000000ad', 'admin12@test.local', '{"tag":"Admin12"}'),
  ('aaaaaaaa-1200-4000-8000-000000000001', 'u12@test.local', '{"tag":"Usuario12"}');
update public.profiles set role = 'admin' where id = 'aaaaaaaa-1200-4000-8000-0000000000ad';

-- Un usuario común no crea ni ve servidores.
set local role authenticated;
select pg_temp.como('aaaaaaaa-1200-4000-8000-000000000001');
do $$
begin
  begin
    perform public.admin_create_server('Prueba 12');
    raise exception 'un usuario común creó un servidor';
  exception when insufficient_privilege then null;
  end;
  assert (select count(*) from public.admin_server_list) = 0, 'un usuario común ve servidores';
end $$;

-- El admin crea servidores.
select pg_temp.como('aaaaaaaa-1200-4000-8000-0000000000ad');
insert into pg_temp.t select 'a', row_to_json(s)::text from public.admin_create_server('Prueba 12', '1.2.3.4:27015', 'abcd1234') s;
insert into pg_temp.t select 'b', row_to_json(s)::text from public.admin_create_server('Vence 12', null, null, now() + interval '3 days') s;
insert into pg_temp.t select 'c', row_to_json(s)::text from public.admin_create_server('Vencido 12', null, null, now() - interval '1 day') s;
insert into pg_temp.t select 'd', row_to_json(s)::text from public.admin_create_server('Revocado 12') s;
do $$
declare a jsonb := (select v::jsonb from pg_temp.t where k = 'a'); r record;
begin
  assert a->>'token' like 'csstv\_%' and length(a->>'token') = 70, 'formato del token';
  assert (select connect_address = '1.2.3.4:27015' and panel_server_id = 'abcd1234' and has_panel from public.admin_server_list where id = (a->>'id')::uuid), 'datos del alta';
  -- Nombre repetido con otras mayúsculas.
  begin
    perform public.admin_create_server('  prueba 12 ');
    raise exception 'se repitió el nombre';
  exception when unique_violation then
    assert sqlerrm = 'Ya hay un servidor con ese nombre', 'mensaje del nombre repetido';
  end;
  begin
    update public.game_servers set name = 'PRUEBA 12' where id = (select (v::jsonb->>'id')::uuid from pg_temp.t where k = 'b');
    raise exception 'se repitió el nombre al editar';
  exception when unique_violation then null;
  end;
  begin
    perform public.admin_create_server('X');
    raise exception 'nombre corto';
  exception when raise_exception then null;
  end;
  -- IP inválida.
  begin
    perform public.admin_create_server('IP 12', null, null, null, '1.2.3.0/24');
    raise exception 'IP con máscara';
  exception when check_violation then null;
  end;
  begin
    update public.game_servers set allowed_ip = '999.1.1.1' where id = (a->>'id')::uuid;
    raise exception 'IP inválida';
  exception when check_violation then null;
  end;
  update public.game_servers set allowed_ip = '2001:db8::1' where id = (a->>'id')::uuid;
  update public.game_servers set allowed_ip = null where id = (a->>'id')::uuid;
  update public.game_servers set active = false where id = (select (v::jsonb->>'id')::uuid from pg_temp.t where k = 'd');
  -- Estados de licencia.
  for r in select name, license_state from public.admin_server_list where name like '% 12' loop
    assert r.license_state = case r.name when 'Prueba 12' then 'ok' when 'Vence 12' then 'expiring'
                                         when 'Vencido 12' then 'expired' when 'Revocado 12' then 'revoked' end,
           format('estado de %s: %s', r.name, r.license_state);
  end loop;
  -- El hash guardado no es el token.
  assert (select token_hash <> a->>'token' from public.game_servers where id = (a->>'id')::uuid), 'se guardó el token';
  assert not exists (select 1 from information_schema.columns where table_name = 'admin_server_list' and column_name = 'token_hash'), 'la vista muestra el hash';
end $$;

-- El token valida la licencia (como el plugin, sin sesión) y deja el servidor en línea.
reset role;
set local role anon;
select pg_temp.como(null);
do $$
declare a jsonb := (select v::jsonb from pg_temp.t where k = 'a'); c jsonb := (select v::jsonb from pg_temp.t where k = 'c');
begin
  assert (public.csstv_license(a->>'token', '2.0.0')->>'ok')::boolean, 'la licencia no valida';
  assert public.csstv_license(c->>'token', '2.0.0')->>'reason' = 'expired', 'vencido';
  assert (select count(*) from public.game_servers_public where name like '% 12') = 2, 'game_servers_public: solo activos con licencia vigente';
end $$;
reset role;
do $$
declare a uuid := (select (v::jsonb->>'id')::uuid from pg_temp.t where k = 'a');
begin
  assert (select online and plugin_version = '2.0.0' from public.admin_server_list where id = a), 'en línea después de validar';
  update public.game_servers set last_seen_at = now() - interval '60 minutes' where id = a;
  assert not (select online from public.admin_server_list where id = a), 'en línea hace 60 minutos';
end $$;

-- Partidas: match_schedule rechaza un servidor vencido y no se borra un servidor con partidas.
set local role authenticated;
select pg_temp.como('aaaaaaaa-1200-4000-8000-0000000000ad');
do $$
declare a uuid := (select (v::jsonb->>'id')::uuid from pg_temp.t where k = 'a');
        c uuid := (select (v::jsonb->>'id')::uuid from pg_temp.t where k = 'c');
        b uuid := (select (v::jsonb->>'id')::uuid from pg_temp.t where k = 'b');
        m uuid;
begin
  insert into public.matches(kind, status, map, played_at) values ('mix', 'finished', 'de_dust2', now()) returning id into m;
  perform public.match_schedule(m, now(), a);
  assert (select server_id = a and server_ip = '1.2.3.4:27015' from public.matches where id = m), 'match_schedule';
  begin
    perform public.match_schedule(m, now(), c);
    raise exception 'se asignó un servidor vencido';
  exception when raise_exception then
    assert sqlerrm like '%licencia vencida%', sqlerrm;
  end;
  assert (select matches = 1 and last_match_at is not null from public.admin_server_list where id = a), 'partidas del servidor';
  begin
    delete from public.game_servers where id = a;
    raise exception 'se borró un servidor con partidas';
  exception when raise_exception then
    assert sqlerrm like 'Este servidor tiene partidas%', sqlerrm;
  end;
  delete from public.game_servers where id = b;
  assert not exists (select 1 from public.game_servers where id = b), 'no se borró el servidor sin partidas';
  raise notice '12: admin de servidores OK';
end $$;
reset role;

rollback;
