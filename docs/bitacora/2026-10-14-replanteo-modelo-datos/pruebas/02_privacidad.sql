-- Pruebas de supabase/replanteo/02_privacidad.sql (correr con la migración aplicada).
-- Simula usuarios con request.jwt.claims (lo que lee auth.uid()) y el rol authenticated/anon. Todo se
-- deshace al final (rollback).
begin;

-- Dos cuentas: la del dueño (con jugador) y otra cualquiera. El trigger crea profiles y profile_details.
insert into auth.users (id, email) values
  ('aaaaaaaa-0000-4000-8000-000000000001', 'dueno@test.local'),
  ('aaaaaaaa-0000-4000-8000-000000000002', 'otro@test.local');
insert into public.players (id, nick, user_id, privacy)
  values ('bbbbbbbb-0000-4000-8000-000000000001', 'JugadorPrueba', 'aaaaaaaa-0000-4000-8000-000000000001', 'public');
update public.profile_details set real_name = 'Nombre Real' where user_id = 'aaaaaaaa-0000-4000-8000-000000000001';

do $$
begin
  begin
    update public.players set privacy = 'members' where id = 'bbbbbbbb-0000-4000-8000-000000000001';
    assert false, 'se aceptó privacy = members';
  exception when check_violation then null;
  end;
end $$;

-- Perfil público: otro usuario y un anónimo ven los detalles.
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"aaaaaaaa-0000-4000-8000-000000000002","role":"authenticated"}', true);
do $$ begin
  assert (select count(*) from public.profile_details where user_id = 'aaaaaaaa-0000-4000-8000-000000000001') = 1,
    'público: otro usuario no ve los detalles';
end $$;
set local role anon;
select set_config('request.jwt.claims', '{"role":"anon"}', true);
do $$ begin
  assert (select count(*) from public.profile_details where user_id = 'aaaaaaaa-0000-4000-8000-000000000001') = 1,
    'público: un anónimo no ve los detalles';
end $$;

-- Perfil privado: otro usuario y un anónimo NO ven los detalles; el dueño sí; la ficha del jugador sigue pública.
reset role;
update public.players set privacy = 'private' where id = 'bbbbbbbb-0000-4000-8000-000000000001';
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"aaaaaaaa-0000-4000-8000-000000000002","role":"authenticated"}', true);
do $$ begin
  assert (select count(*) from public.profile_details where user_id = 'aaaaaaaa-0000-4000-8000-000000000001') = 0,
    'privado: otro usuario ve los detalles';
  assert (select count(*) from public.players where id = 'bbbbbbbb-0000-4000-8000-000000000001') = 1,
    'privado: la ficha del jugador dejó de ser pública';
end $$;
select set_config('request.jwt.claims', '{"sub":"aaaaaaaa-0000-4000-8000-000000000001","role":"authenticated"}', true);
do $$ begin
  assert (select real_name from public.profile_details where user_id = 'aaaaaaaa-0000-4000-8000-000000000001') = 'Nombre Real',
    'privado: el dueño no ve sus detalles';
end $$;
set local role anon;
select set_config('request.jwt.claims', '{"role":"anon"}', true);
do $$ begin
  assert (select count(*) from public.profile_details where user_id = 'aaaaaaaa-0000-4000-8000-000000000001') = 0,
    'privado: un anónimo ve los detalles';
  raise notice 'replanteo 02: ok';
end $$;

rollback;
