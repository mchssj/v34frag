-- Prueba de la 121 en una transacción que se deshace (base local o producción).
-- Uso: probar_121.sh (le pasa las rutas de la 121 y de su inversa).
\set ON_ERROR_STOP 1
begin;

-- Las funciones antes de la 121, para comparar con la inversa al final.
-- Sin los \r: la 117 se aplicó en producción desde un archivo con CRLF.
create temp table antes as
select p.oid::regprocedure::text as fn, md5(replace(pg_get_functiondef(p.oid), chr(13), '')) as h
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
 where n.nspname = 'public' and p.proname in ('ban_support_count', 'ban_support_quota', 'ban_create', 'ban_update');

\i :r121

-- Cuentas: admin, moderador, soporte, un usuario y dos jugadores a banear (todos con ficha).
insert into auth.users (id, email) values
  ('22222222-2222-4222-8222-000000121001', 'p121admin@example.com'),
  ('22222222-2222-4222-8222-000000121002', 'p121mod@example.com'),
  ('22222222-2222-4222-8222-000000121003', 'p121sop@example.com'),
  ('22222222-2222-4222-8222-000000121005', 'p121user@example.com'),
  ('22222222-2222-4222-8222-000000121006', 'p121t1@example.com'),
  ('22222222-2222-4222-8222-000000121007', 'p121t2@example.com');
insert into players (id, nick, steam_id, user_id) values
  ('11111111-1111-4111-8111-000000121001', 'p121admin', '76561190000121001', '22222222-2222-4222-8222-000000121001'),
  ('11111111-1111-4111-8111-000000121002', 'p121mod',   '76561190000121002', '22222222-2222-4222-8222-000000121002'),
  ('11111111-1111-4111-8111-000000121003', 'p121sop',   '76561190000121003', '22222222-2222-4222-8222-000000121003'),
  ('11111111-1111-4111-8111-000000121005', 'p121user',  '76561190000121005', '22222222-2222-4222-8222-000000121005'),
  ('11111111-1111-4111-8111-000000121006', 'p121t1',    '76561190000121006', '22222222-2222-4222-8222-000000121006'),
  ('11111111-1111-4111-8111-000000121007', 'p121t2',    '76561190000121007', '22222222-2222-4222-8222-000000121007');
update profiles set role = 'admin' where id = '22222222-2222-4222-8222-000000121001';
update profiles set role = 'moderator' where id = '22222222-2222-4222-8222-000000121002';
update profiles set role = 'support' where id = '22222222-2222-4222-8222-000000121003';

create function pg_temp.ban(p uuid) returns bans language sql security definer as $$ select * from public.bans where id = p $$;
-- Corre la fecha de los baneos de un jugador hacia atrás (para probar la ventana de días).
create function pg_temp.atrasar(p_player uuid, p_dias int) returns void language sql security definer as $$
  update public.bans set created_at = created_at - make_interval(days => p_dias) where player_id = p_player $$;
grant execute on function pg_temp.ban(uuid), pg_temp.atrasar(uuid, int) to authenticated;

create temp table ids (k text primary key, v uuid);
grant select, insert, update on ids to authenticated;

create function pg_temp.como(p_user text) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', '22222222-2222-4222-8222-000000121' || p_user, 'role', 'authenticated')::text, true)
$$;
grant execute on function pg_temp.como(text) to authenticated;

set local role authenticated;

-- 1. Los valores de hoy, por defecto.
select pg_temp.como('003');
do $$
declare l jsonb := site_ban_limits(); q jsonb := ban_support_quota('11111111-1111-4111-8111-000000121006', null);
begin
  if (l->>'max_minutes')::int <> 120 or (l->>'max_bans')::int <> 3 or (l->>'window_days')::int <> 7 then raise exception 'falla 1: %', l; end if;
  if (q->>'max')::int <> 3 or (q->>'max_minutes')::int <> 120 or (q->>'window_days')::int <> 7 or (q->>'remaining')::int <> 3 then
    raise exception 'falla 1: cupo %', q;
  end if;
  q := ban_support_quota(null, '76561190000999999');
  if (q->>'used')::int <> 0 or (q->>'max_minutes')::int <> 120 then raise exception 'falla 1: cupo de un SteamID suelto %', q; end if;
  raise notice 'ok 1: por defecto 120 minutos, 3 baneos y 7 días (y el cupo los trae)';
end $$;

-- 2. Solo un admin los cambia; un usuario ni los lee.
do $$ begin
  perform site_admin_set_ban_limits(60, 3, 7); raise exception 'falla 2: el soporte los cambió';
exception when insufficient_privilege then raise notice 'ok 2a: el soporte no los cambia';
end $$;
select pg_temp.como('002');
do $$ begin
  perform site_admin_set_ban_limits(60, 3, 7); raise exception 'falla 2: el moderador los cambió';
exception when insufficient_privilege then raise notice 'ok 2b: el moderador no los cambia (pero los lee: %)', site_ban_limits()->>'max_minutes';
end $$;
select pg_temp.como('005');
do $$ begin
  perform site_ban_limits(); raise exception 'falla 2: el usuario los leyó';
exception when insufficient_privilege then raise notice 'ok 2c: un usuario no los lee';
end $$;

-- 3. Fuera de rango.
select pg_temp.como('001');
do $$
declare v int[]; malos int[][] := array[[0, 3, 7], [1441, 3, 7], [60, 0, 7], [60, 21, 7], [60, 3, 0], [60, 3, 91]];
begin
  for i in 1 .. array_length(malos, 1) loop
    begin
      perform site_admin_set_ban_limits(malos[i][1], malos[i][2], malos[i][3]);
      raise exception 'falla 3: aceptó %, %, %', malos[i][1], malos[i][2], malos[i][3];
    exception when raise_exception then
      if sqlerrm like 'falla 3%' then raise; end if;
    end;
  end loop;
  begin perform site_admin_set_ban_limits(null, 3, 7); raise exception 'falla 3: aceptó null';
  exception when raise_exception then if sqlerrm like 'falla 3%' then raise; end if; end;
  raise notice 'ok 3: rechaza valores fuera de rango';
end $$;

-- 4. El admin los cambia: 30 minutos, 2 baneos y 1 día.
do $$
declare l jsonb := site_admin_set_ban_limits(30, 2, 1);
begin
  if (l->>'max_minutes')::int <> 30 or (l->>'max_bans')::int <> 2 or (l->>'window_days')::int <> 1
     or l->>'updated_by' <> '22222222-2222-4222-8222-000000121001' or l->>'updated_by_nick' is null or l->>'updated_at' is null then
    raise exception 'falla 4: %', l;
  end if;
  raise notice 'ok 4: el admin los cambia y queda quién (%)', l->>'updated_by_nick';
end $$;

-- 5. El soporte, con el tope nuevo de minutos.
select pg_temp.como('003');
do $$
declare v uuid;
begin
  begin perform ban_create('11111111-1111-4111-8111-000000121006', null, 'tóxico', now() + interval '45 minutes');
        raise exception 'falla 5: baneó 45 minutos con tope 30';
  exception when insufficient_privilege then
    if sqlerrm <> 'El soporte banea hasta 30 minutos' then raise exception 'falla 5: mensaje %', sqlerrm; end if;
  end;
  v := ban_create('11111111-1111-4111-8111-000000121006', null, 'tóxico', now() + interval '30 minutes 30 seconds');
  if (pg_temp.ban(v)).expires_at > now() + interval '30 minutes' then raise exception 'falla 5: no recortó al tope'; end if;
  insert into ids values ('b1', v);
  raise notice 'ok 5: el tope de minutos sale de site_config (y recorta el margen)';
end $$;

-- 6. El límite de baneos: 2 en 1 día.
do $$
declare v uuid;
begin
  perform ban_lift((select ids.v from ids where ids.k = 'b1'), 'listo');
  v := ban_create('11111111-1111-4111-8111-000000121006', null, 'otra', now() + interval '10 minutes');
  perform ban_lift(v, 'listo');
  if (ban_support_quota('11111111-1111-4111-8111-000000121006', null)->>'remaining')::int <> 0 then raise exception 'falla 6: cupo'; end if;
  begin perform ban_create('11111111-1111-4111-8111-000000121006', null, 'tercera', now() + interval '10 minutes');
        raise exception 'falla 6: pasó el límite de 2';
  exception when raise_exception then
    if sqlerrm <> 'Ya tiene 2 baneos de soporte en los últimos 1 días: pásale el caso a un moderador' then raise exception 'falla 6: mensaje %', sqlerrm; end if;
  end;
  raise notice 'ok 6: el límite de baneos sale de site_config';
end $$;

-- 7. La ventana de días: los de hace 2 días no cuentan con 1 día, sí con 7.
do $$
declare q jsonb;
begin
  perform pg_temp.atrasar('11111111-1111-4111-8111-000000121006', 2);
  q := ban_support_quota('11111111-1111-4111-8111-000000121006', null);
  if (q->>'used')::int <> 0 or (q->>'window_days')::int <> 1 then raise exception 'falla 7: con 1 día %', q; end if;
  perform pg_temp.como('001');
  perform site_admin_set_ban_limits(30, 2, 7);
  perform pg_temp.como('003');
  q := ban_support_quota('11111111-1111-4111-8111-000000121006', null);
  if (q->>'used')::int <> 2 or (q->>'remaining')::int <> 0 then raise exception 'falla 7: con 7 días %', q; end if;
  raise notice 'ok 7: la ventana de días sale de site_config';
end $$;

-- 8. Bajar el tope no toca los baneos puestos; los cambios usan el tope nuevo.
select pg_temp.como('001');
select site_admin_set_ban_limits(120, 3, 7);
select pg_temp.como('003');
do $$
declare v uuid; vence timestamptz;
begin
  v := ban_create('11111111-1111-4111-8111-000000121007', null, 'spam', now() + interval '100 minutes');
  vence := (pg_temp.ban(v)).expires_at;
  perform pg_temp.como('001');
  perform site_admin_set_ban_limits(30, 3, 7);
  perform pg_temp.como('003');
  if (pg_temp.ban(v)).expires_at <> vence then raise exception 'falla 8: cambió el baneo puesto'; end if;
  begin perform ban_update(v, null, now() + interval '60 minutes'); raise exception 'falla 8: alargó con tope 30';
  exception when insufficient_privilege then
    if sqlerrm <> 'El soporte banea hasta 30 minutos desde que lo puso' then raise exception 'falla 8: mensaje %', sqlerrm; end if;
  end;
  perform ban_update(v, 'spam en el chat', null);
  if (pg_temp.ban(v)).expires_at <> vence or (pg_temp.ban(v)).reason <> 'spam en el chat' then raise exception 'falla 8: el motivo'; end if;
  perform ban_update(v, null, now() + interval '20 minutes');
  if (pg_temp.ban(v)).expires_at > now() + interval '20 minutes' then raise exception 'falla 8: acortar'; end if;
  raise notice 'ok 8: el baneo puesto queda igual y los cambios usan el tope nuevo';
end $$;

-- 9. El moderador sigue sin tope.
select pg_temp.como('002');
do $$
declare v uuid := ban_create('11111111-1111-4111-8111-000000121005', null, 'reincidente', now() + interval '3 days');
begin
  if (pg_temp.ban(v)).expires_at < now() + interval '2 days' then raise exception 'falla 9'; end if;
  raise notice 'ok 9: el moderador banea 3 días con el tope del soporte en 30 minutos';
end $$;

-- 10. La inversa.
reset role;
\i :rev121
do $$
declare distintas text;
begin
  -- Igual, o igual salvo los acentos: en producción la 117 quedó con el UTF-8 leído como WIN1252 ("ElegÃ­"); la
  -- inversa las deja con los acentos bien.
  select string_agg(a.fn, ', ') into distintas from antes a, lateral (select replace(pg_get_functiondef(a.fn::regprocedure), chr(13), '') d) f
   where a.h is distinct from md5(f.d) and a.h is distinct from md5(convert_from(convert_to(f.d, 'UTF8'), 'WIN1252'));
  if distintas is not null then raise exception 'falla 10: la inversa no deja igual: %', distintas; end if;
  select string_agg(a.fn, ', ') into distintas from antes a
   where a.h is distinct from md5(replace(pg_get_functiondef(a.fn::regprocedure), chr(13), ''));
  if distintas is not null then raise notice 'nota 10: iguales salvo los acentos rotos de antes: %', distintas; end if;
  if to_regprocedure('public.site_ban_limits()') is not null or to_regprocedure('public.site_admin_set_ban_limits(int, int, int)') is not null then
    raise exception 'falla 10: quedaron las funciones';
  end if;
  if exists (select 1 from information_schema.columns where table_name = 'site_config' and column_name like '%ban%') then
    raise exception 'falla 10: quedaron columnas';
  end if;
  raise notice 'ok 10: la inversa vuelve a la 117 (funciones idénticas)';
end $$;

rollback;
