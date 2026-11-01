-- Pruebas de supabase/replanteo/38_ips_jugadores.sql (correr con la migración aplicada). Todo con rollback.
begin;

create function pg_temp.ok(c boolean, msg text) returns void language plpgsql as $$
begin
  if not coalesce(c, false) then raise exception 'FALLA: %', msg; end if;
  raise notice 'OK: %', msg;
end $$;
create function pg_temp.como(u text) returns void language sql as $$
  select set_config('request.jwt.claims', format('{"sub":"%s","role":"authenticated"}', u), true) $$;
create function pg_temp.s(n int) returns text language sql immutable as $$ select '7656119838' || lpad(n::text, 7, '0') $$;
grant execute on function pg_temp.ok(boolean, text), pg_temp.como(text), pg_temp.s(int) to authenticated;

insert into auth.users (id, email, raw_user_meta_data, encrypted_password) values
  ('aaaaaaaa-3800-4000-8000-0000000000ad', 'admin38@test.local', '{"tag":"Admin38"}', 'x'),
  ('aaaaaaaa-3800-4000-8000-000000000001', 'u1-38@test.local', '{"tag":"Uno38"}', 'x');
update public.profiles set role = 'admin' where id = 'aaaaaaaa-3800-4000-8000-0000000000ad';
-- Ficha 1 con dos SteamID (1 y 2), ficha 2 con el 3. El 4 no tiene ficha.
insert into public.players(id, nick, steam_id) values
  ('dddddddd-3800-4000-8000-000000000001', 'Alfa38', pg_temp.s(1)),
  ('dddddddd-3800-4000-8000-000000000002', 'Beta38', pg_temp.s(3));
insert into public.player_extra_steam_ids(steam_id, player_id) values (pg_temp.s(2), 'dddddddd-3800-4000-8000-000000000001');
insert into public.player_ips(steam_id, ip, first_seen_at, last_seen_at, times, last_nick) values
  (pg_temp.s(1), '190.1.1.1', now() - interval '3 days', now() - interval '1 day', 4, 'alfa'),
  (pg_temp.s(2), '190.2.2.2', now() - interval '2 days', now(), 1, 'alfa2'),
  (pg_temp.s(3), '190.1.1.1', now() - interval '5 days', now() - interval '5 days', 1, 'beta'),
  (pg_temp.s(4), '190.1.1.1', now(), now(), 1, 'sinficha'),
  (pg_temp.s(4), '190.9.9.9', now(), now(), 1, 'sinficha');

set local role authenticated;
select pg_temp.como('aaaaaaaa-3800-4000-8000-000000000001');
do $$ begin
  perform public.admin_player_ips('dddddddd-3800-4000-8000-000000000001');
  raise exception 'FALLA: un usuario común vio las IPs';
exception when insufficient_privilege then raise notice 'OK: un usuario común no ve las IPs';
end $$;

select pg_temp.como('aaaaaaaa-3800-4000-8000-0000000000ad');
create temp table r as select * from public.admin_player_ips('dddddddd-3800-4000-8000-000000000001');
select pg_temp.ok((select count(*) = 2 from r), 'las IPs de todos los SteamID de la ficha (principal y adicional)');
select pg_temp.ok((select ip from r limit 1) = '190.2.2.2', 'la más reciente primero, sin máscara');
select pg_temp.ok((select others = '[{"id": "dddddddd-3800-4000-8000-000000000002", "alias": "Beta38"}]'::jsonb and others_unlinked = 1 and times = 4
                     from r where ip = '190.1.1.1'),
  'la IP compartida muestra la otra ficha y un SteamID sin ficha');
select pg_temp.ok((select others = '[]'::jsonb and others_unlinked = 0 from r where ip = '190.2.2.2'), 'IP sin compartir');
select pg_temp.ok((select count(*) = 0 from public.admin_player_ips('dddddddd-3800-4000-8000-000000000099')), 'ficha sin IPs: vacío');
reset role;

rollback;
