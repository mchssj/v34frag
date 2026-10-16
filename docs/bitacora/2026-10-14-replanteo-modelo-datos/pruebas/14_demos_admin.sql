-- Pruebas de supabase/replanteo/14_demos_admin.sql (correr con la migración aplicada). Todo con rollback.
begin;

create function pg_temp.como(u text) returns void language sql as $$
  select set_config('request.jwt.claims', case when u is null then '{"role":"anon"}'
         else format('{"sub":"%s","role":"authenticated"}', u) end, true) $$;
grant execute on function pg_temp.como(text) to anon, authenticated;
create table pg_temp.t(k text primary key, v text);
grant all on pg_temp.t to anon, authenticated;

insert into auth.users (id, email, raw_user_meta_data) values
  ('aaaaaaaa-1400-4000-8000-0000000000ad', 'admin14@test.local', '{"tag":"Admin14"}'),
  ('aaaaaaaa-1400-4000-8000-000000000001', 'u14@test.local', '{"tag":"Usuario14"}');
update public.profiles set role = 'admin' where id = 'aaaaaaaa-1400-4000-8000-0000000000ad';

-- Un servidor con id del panel y otro sin; una partida por estado de demo.
insert into public.game_servers(id, name, token_hash, panel_server_id) values
  ('bbbbbbbb-1400-4000-8000-000000000001', 'Panel 14', 'hash-14-a', 'abcd1400'),
  ('bbbbbbbb-1400-4000-8000-000000000002', 'Sin panel 14', 'hash-14-b', null);
insert into public.matches(id, kind, status, map, played_at, external_id, server_id, demo_status, demo_size, demo_attempts, demo_uploaded_at, side1_name, side2_name) values
  ('cccccccc-1400-4000-8000-000000000001', 'mix', 'finished', 'de_dust2', now() - interval '2 days', 'd14-pending', 'bbbbbbbb-1400-4000-8000-000000000001', 'pending', null, 2, null, 'Alfa14', 'Beta14'),
  ('cccccccc-1400-4000-8000-000000000002', 'mix', 'finished', 'de_inferno', now() - interval '1 day', 'd14-uploaded', 'bbbbbbbb-1400-4000-8000-000000000001', 'uploaded', 1048576, 1, now() - interval '1 day', 'Alfa14', 'Gama14'),
  ('cccccccc-1400-4000-8000-000000000003', 'mix', 'finished', 'de_nuke', now() - interval '3 days', 'd14-missing', 'bbbbbbbb-1400-4000-8000-000000000001', 'missing', null, 6, null, 'Alfa14', 'Delta14'),
  ('cccccccc-1400-4000-8000-000000000004', 'mix', 'finished', 'de_cache', now() - interval '3 days', 'd14-sinpanel', 'bbbbbbbb-1400-4000-8000-000000000002', 'missing', null, 6, null, 'Alfa14', 'Eps14'),
  ('cccccccc-1400-4000-8000-000000000005', 'mix', 'finished', 'de_cbble', now() - interval '100 days', 'd14-expired', 'bbbbbbbb-1400-4000-8000-000000000001', 'expired', 2048, 1, now() - interval '95 days', 'Alfa14', 'Zeta14');

-- Un usuario común no ve nada ni llama a las funciones.
set local role authenticated;
select pg_temp.como('aaaaaaaa-1400-4000-8000-000000000001');
do $$
begin
  assert (select count(*) from public.admin_demo_list) = 0, 'un usuario común ve demos';
  assert (select count(*) from public.admin_demo_worker_list) = 0, 'un usuario común ve Workers';
  assert (select count(*) from public.admin_demo_summary) = 0, 'un usuario común ve el resumen';
  begin
    perform public.admin_demo_retry('cccccccc-1400-4000-8000-000000000003');
    raise exception 'un usuario común reintentó';
  exception when insufficient_privilege then null;
  end;
  begin
    perform public.admin_create_demo_worker('No 14');
    raise exception 'un usuario común creó un Worker';
  exception when insufficient_privilege then null;
  end;
end $$;

-- El admin.
select pg_temp.como('aaaaaaaa-1400-4000-8000-0000000000ad');
insert into pg_temp.t select 'w', row_to_json(s)::text from public.admin_create_demo_worker('Worker 14') s;
do $$
declare r record; w jsonb := (select v::jsonb from pg_temp.t where k = 'w');
begin
  -- Listado: vencimiento solo de las subidas, servidor y búsqueda.
  select * into r from public.admin_demo_list where id = 'cccccccc-1400-4000-8000-000000000002';
  assert r.expires_at = r.demo_uploaded_at + interval '90 days' and r.server_name = 'Panel 14' and r.server_has_panel, format('subida: %s', row_to_json(r));
  assert (select expires_at is null from public.admin_demo_list where id = 'cccccccc-1400-4000-8000-000000000001'), 'vencimiento de una pendiente';
  assert (select count(*) from public.admin_demo_list where search like '%alfa14%') = 5, 'búsqueda';
  assert not (select server_has_panel from public.admin_demo_list where id = 'cccccccc-1400-4000-8000-000000000004'), 'servidor sin panel';

  -- Resumen.
  select * into r from public.admin_demo_summary;
  assert r.pending >= 1 and r.uploaded >= 1 and r.missing >= 2 and r.expired >= 1 and r.uploaded_bytes >= 1048576, format('resumen: %s', row_to_json(r));
  assert r.oldest_pending_at <= now() - interval '2 days', 'pendiente más vieja';

  -- Reintentar: solo una perdida de un servidor con panel.
  perform public.admin_demo_retry('cccccccc-1400-4000-8000-000000000003');
  assert (select (demo_status, demo_attempts) = ('pending'::text, 0) from public.matches where id = 'cccccccc-1400-4000-8000-000000000003'), 'reintentar';
  for r in select * from (values
      ('cccccccc-1400-4000-8000-000000000001'::uuid, 'La demo ya está en la cola del Worker'),
      ('cccccccc-1400-4000-8000-000000000002'::uuid, 'La demo ya está subida'),
      ('cccccccc-1400-4000-8000-000000000005'::uuid, 'La demo venció: ya no está en R2 ni en el servidor'),
      ('cccccccc-1400-4000-8000-000000000004'::uuid, 'El servidor de esta partida no tiene id del panel: el Worker no puede bajar la demo'),
      ('cccccccc-1400-4000-8000-0000000000ff'::uuid, 'No existe esa partida')) x(id, msg) loop
    begin
      perform public.admin_demo_retry(r.id);
      raise exception 'reintentó %', r.id;
    exception when raise_exception then
      assert sqlerrm = r.msg, format('%s: %s', r.id, sqlerrm);
    end;
  end loop;

  -- Workers: formato del token, nombre repetido y lista sin el hash.
  assert w->>'token' like 'demow\_%' and length(w->>'token') = 70, 'formato del token';
  begin
    perform public.admin_create_demo_worker('  WORKER 14 ');
    raise exception 'se repitió el nombre';
  exception when unique_violation then
    assert sqlerrm = 'Ya hay un Worker con ese nombre', sqlerrm;
  end;
  assert (select not online and active from public.admin_demo_worker_list where id = (w->>'id')::uuid), 'Worker nuevo';
  assert not exists (select 1 from information_schema.columns where table_name = 'admin_demo_worker_list' and column_name = 'token_hash'), 'la vista muestra el hash';
end $$;

-- El token del Worker sirve para demo_pending (sin sesión, como el Worker) y lo deja en línea.
reset role;
set local role anon;
select pg_temp.como(null);
do $$
declare w jsonb := (select v::jsonb from pg_temp.t where k = 'w');
begin
  assert exists (select 1 from public.demo_pending(w->>'token', 50) where external_id = 'd14-missing'), 'la reintentada vuelve a la cola';
end $$;
reset role;
set local role authenticated;
select pg_temp.como('aaaaaaaa-1400-4000-8000-0000000000ad');
do $$
declare w jsonb := (select v::jsonb from pg_temp.t where k = 'w'); nuevo text;
begin
  assert (select online from public.admin_demo_worker_list where id = (w->>'id')::uuid), 'en línea después de usar el token';
  assert (select worker_online from public.admin_demo_summary), 'resumen: Worker en línea';
  update public.demo_workers set active = false where id = (w->>'id')::uuid;
  nuevo := public.rotate_demo_worker_token((w->>'id')::uuid);
  assert nuevo <> w->>'token' and (select active from public.demo_workers where id = (w->>'id')::uuid), 'token nuevo y reactivado';
  insert into pg_temp.t values ('nuevo', nuevo);
  begin
    perform public.rotate_demo_worker_token('cccccccc-1400-4000-8000-0000000000ff');
    raise exception 'rotó un Worker que no existe';
  exception when raise_exception then
    assert sqlerrm = 'No existe ese Worker', sqlerrm;
  end;
end $$;
reset role;
set local role anon;
do $$
declare w jsonb := (select v::jsonb from pg_temp.t where k = 'w');
begin
  begin
    perform public.demo_pending(w->>'token', 1);
    raise exception 'el token viejo sigue sirviendo';
  exception when sqlstate 'PT401' then null;
  end;
  perform public.demo_pending((select v from pg_temp.t where k = 'nuevo'), 1);
  raise notice '14: demos desde el admin OK';
end $$;
reset role;

rollback;
