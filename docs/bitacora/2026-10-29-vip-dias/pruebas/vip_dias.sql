-- Pruebas de supabase/migrations/20261029120000_vip_dias.sql (active_since y days_active de vip_status). Todo con rollback.
-- Los períodos se cargan directo en la tabla para poder fecharlos en el pasado.
begin;

create function pg_temp.ok(c boolean, msg text) returns void language plpgsql as $$
begin
  if not coalesce(c, false) then raise exception 'FALLA: %', msg; end if;
  raise notice 'OK: %', msg;
end $$;
-- Medianoche de Colombia de hace n días, más h horas.
create function pg_temp.dia(n int, h int default 12) returns timestamptz language sql as $$
  select (((now() at time zone 'America/Bogota')::date - n)::timestamp + make_interval(hours => h)) at time zone 'America/Bogota' $$;

insert into auth.users (id, email, raw_user_meta_data, encrypted_password) values
  ('aaaaaaaa-3300-4000-8000-0000000000ad', 'admin33@test.local', '{"tag":"Admin33"}', 'x'),
  ('aaaaaaaa-3300-4000-8000-000000000001', 'u1-33@test.local', '{"tag":"Uno33"}', 'x'),
  ('aaaaaaaa-3300-4000-8000-000000000002', 'u2-33@test.local', '{"tag":"Dos33"}', 'x'),
  ('aaaaaaaa-3300-4000-8000-000000000003', 'u3-33@test.local', '{"tag":"Tres33"}', 'x'),
  ('aaaaaaaa-3300-4000-8000-000000000004', 'u4-33@test.local', '{"tag":"Cuatro33"}', 'x'),
  ('aaaaaaaa-3300-4000-8000-000000000005', 'u5-33@test.local', '{"tag":"Cinco33"}', 'x'),
  ('aaaaaaaa-3300-4000-8000-000000000006', 'u6-33@test.local', '{"tag":"Seis33"}', 'x');
update public.profiles set role = 'admin' where id = 'aaaaaaaa-3300-4000-8000-0000000000ad';

insert into public.vip_memberships (user_id, starts_at, ends_at, source, revoked_at) values
  -- U1: lifetime comprado hace 4 días, de noche (el ejemplo de Daniel: el 25, el 29 lleva 4)
  ('aaaaaaaa-3300-4000-8000-000000000001', pg_temp.dia(4, 23), null, 'manual', null),
  -- U2: un mes hace 40 días, extendido sin cortes donde terminaba
  ('aaaaaaaa-3300-4000-8000-000000000002', pg_temp.dia(40), pg_temp.dia(10), 'manual', null),
  ('aaaaaaaa-3300-4000-8000-000000000002', pg_temp.dia(10), pg_temp.dia(-20), 'manual', null),
  -- U3: temporal hace 30 días y lifetime encima hace 5: sigue la racha del temporal
  ('aaaaaaaa-3300-4000-8000-000000000003', pg_temp.dia(30), pg_temp.dia(-1), 'manual', null),
  ('aaaaaaaa-3300-4000-8000-000000000003', pg_temp.dia(5), null, 'manual', null),
  -- U4: VIP vencido hace 100 días y vuelto a dar hace 7 (con un hueco): cuenta desde la vuelta
  ('aaaaaaaa-3300-4000-8000-000000000004', pg_temp.dia(200), pg_temp.dia(100), 'manual', null),
  ('aaaaaaaa-3300-4000-8000-000000000004', pg_temp.dia(7), pg_temp.dia(-23), 'manual', null),
  -- U5: lifetime revocado
  ('aaaaaaaa-3300-4000-8000-000000000005', pg_temp.dia(50), null, 'manual', now()),
  -- U6: vencido
  ('aaaaaaaa-3300-4000-8000-000000000006', pg_temp.dia(90), pg_temp.dia(60), 'manual', null);
update public.vip_memberships set revoked_by = 'aaaaaaaa-3300-4000-8000-0000000000ad', revoke_reason = 'prueba'
 where user_id = 'aaaaaaaa-3300-4000-8000-000000000005';

select set_config('request.jwt.claims', '{"sub":"aaaaaaaa-3300-4000-8000-0000000000ad","role":"authenticated"}', true);
set local role authenticated;

select pg_temp.ok((select days_active = 4 and active_since = pg_temp.dia(4, 23) from public.vip_status
                    where user_id = 'aaaaaaaa-3300-4000-8000-000000000001'), 'lifetime comprado hace 4 días lleva 4');
select pg_temp.ok((select days_active = 40 from public.vip_status where user_id = 'aaaaaaaa-3300-4000-8000-000000000002'),
  'una extensión sin cortes no reinicia la cuenta');
select pg_temp.ok((select days_active = 30 and status = 'lifetime' from public.vip_status where user_id = 'aaaaaaaa-3300-4000-8000-000000000003'),
  'un lifetime dado sobre un temporal sigue la racha');
select pg_temp.ok((select days_active = 7 and since = pg_temp.dia(200) from public.vip_status where user_id = 'aaaaaaaa-3300-4000-8000-000000000004'),
  'después de un hueco cuenta desde la vuelta (since sigue siendo la primera vez)');
select pg_temp.ok((select days_active is null and active_since is null from public.vip_status where user_id = 'aaaaaaaa-3300-4000-8000-000000000005'),
  'revocado: sin días');
select pg_temp.ok((select days_active is null and active_since is null from public.vip_status where user_id = 'aaaaaaaa-3300-4000-8000-000000000006'),
  'vencido: sin días');

-- El dueño sigue viendo solo la suya
select set_config('request.jwt.claims', '{"sub":"aaaaaaaa-3300-4000-8000-000000000001","role":"authenticated"}', true);
select pg_temp.ok((select count(*) = 1 and bool_and(days_active = 4) from public.vip_status), 'el dueño ve solo la suya, con los días');

rollback;
