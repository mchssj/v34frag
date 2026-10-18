-- Pruebas de supabase/replanteo/18_preferencias.sql (correr con la migración aplicada). Todo con rollback.
begin;

create function pg_temp.ok(c boolean, msg text) returns void language plpgsql as $$
begin
  if not coalesce(c, false) then raise exception 'FALLA: %', msg; end if;
  raise notice 'OK: %', msg;
end $$;
grant execute on function pg_temp.ok(boolean, text) to anon, authenticated;
create function pg_temp.falla(q text, patron text) returns void language plpgsql as $$
begin
  execute q;
  raise exception 'NO FALLÓ: %', q;
exception when others then
  if sqlerrm like 'NO FALLÓ%' or sqlerrm not like patron then
    raise exception 'falla(%): se esperaba "%", vino "%"', q, patron, sqlerrm;
  end if;
  raise notice 'OK: falla como se espera (%)', sqlerrm;
end $$;
grant execute on function pg_temp.falla(text, text) to anon, authenticated;
create function pg_temp.como(u text) returns void language sql as $$
  select set_config('request.jwt.claims', case when u is null then '{"role":"anon"}'
         else format('{"sub":"%s","role":"authenticated"}', u) end, true) $$;
grant execute on function pg_temp.como(text) to anon, authenticated;

insert into auth.users (id, email, raw_user_meta_data) values
  ('aaaaaaaa-1800-4000-8000-000000000001', 'pref18a@test.local', '{"tag":"Pref18a"}'),
  ('aaaaaaaa-1800-4000-8000-000000000002', 'pref18b@test.local', '{"tag":"Pref18b"}');

set local role authenticated;
select pg_temp.como('aaaaaaaa-1800-4000-8000-000000000001');
do $$ begin
  perform pg_temp.ok(not exists (select 1 from public.user_preferences), 'sin preferencias guardadas al principio');
  perform pg_temp.ok(public.set_my_preferences('{"theme_fx": "silent"}') = '{"theme_fx": "silent"}', 'guarda theme_fx');
  perform pg_temp.ok(public.set_my_preferences('{"otra": 1}') = '{"otra": 1, "theme_fx": "silent"}', 'otra clave no pisa theme_fx');
  perform pg_temp.ok(public.set_my_preferences('{"theme_fx": "off"}') = '{"otra": 1, "theme_fx": "off"}', 'cambia theme_fx');
  perform pg_temp.ok(public.set_my_preferences('{"theme_fx": null}') = '{"otra": 1}', 'null borra la clave');
  perform pg_temp.ok((select preferences from public.user_preferences) = '{"otra": 1}', 'la fila propia se ve');
end $$;
select pg_temp.falla($q$select public.set_my_preferences('{"theme_fx": "fuerte"}')$q$, '%user_preferences_theme_fx%');
select pg_temp.falla($q$select public.set_my_preferences('[1]')$q$, 'Las preferencias tienen que ser un objeto');
select public.set_my_preferences('{"theme_fx": "full"}');

-- Otro usuario no ve ni cambia las ajenas.
select pg_temp.como('aaaaaaaa-1800-4000-8000-000000000002');
do $$ begin
  perform pg_temp.ok(not exists (select 1 from public.user_preferences), 'otro usuario no ve las preferencias ajenas');
  update public.user_preferences set preferences = '{}' where user_id = 'aaaaaaaa-1800-4000-8000-000000000001';
end $$;
select pg_temp.falla($q$insert into public.user_preferences(user_id) values ('aaaaaaaa-1800-4000-8000-000000000001')$q$, '%row-level security%');
reset role;
do $$ begin
  perform pg_temp.ok((select preferences->>'theme_fx' from public.user_preferences where user_id = 'aaaaaaaa-1800-4000-8000-000000000001') = 'full',
                     'el update ajeno no cambió nada');
end $$;

-- Anon no tiene permisos.
set local role anon;
select pg_temp.como(null);
select pg_temp.falla($q$select * from public.user_preferences$q$, 'permission denied%');
select pg_temp.falla($q$select public.set_my_preferences('{"theme_fx": "full"}')$q$, 'permission denied%');
reset role;

-- Borrar la cuenta borra sus preferencias.
delete from auth.users where id = 'aaaaaaaa-1800-4000-8000-000000000001';
do $$ begin
  perform pg_temp.ok(not exists (select 1 from public.user_preferences where user_id = 'aaaaaaaa-1800-4000-8000-000000000001'), 'se borran con la cuenta');
end $$;

rollback;
