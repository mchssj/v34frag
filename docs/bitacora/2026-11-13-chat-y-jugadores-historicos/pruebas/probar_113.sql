-- Prueba de la 113 en una transacción que se deshace (base local o producción).
-- Uso: probar_113.sh (le pasa las rutas de la 113 y de su inversa).
\set ON_ERROR_STOP 1
begin;

\i :r113

-- Un moderador, un usuario común, un torneo histórico y uno normal, un equipo de la plataforma y dos fichas.
insert into auth.users (id, email) values
  ('22222222-2222-4222-8222-000000001131', 'prueba113a@example.com'),
  ('22222222-2222-4222-8222-000000001132', 'prueba113b@example.com');
update profiles set role = 'moderator' where id = '22222222-2222-4222-8222-000000001131';
insert into events (id, name, historic, starts_on, ends_on) values
  ('33333333-3333-4333-8333-000000001131', 'Prueba 113 histórico', true, '2020-01-01', '2020-01-02');
insert into events (id, name) values ('33333333-3333-4333-8333-000000001132', 'Prueba 113 normal');
insert into teams (id, name, tag, kind) values ('44444444-4444-4444-8444-000000001131', 'Prueba 113', 'P113', 'official');
insert into players (id, nick) values
  ('11111111-1111-4111-8111-000000001131', 'prueba113a'),
  ('11111111-1111-4111-8111-000000001132', 'prueba113b');

set local role authenticated;

-- 1. Un usuario común no carga.
do $$ begin perform set_config('request.jwt.claims', '{"sub":"22222222-2222-4222-8222-000000001132","role":"authenticated"}', true); end $$;
do $$ begin
  perform event_register_historic('33333333-3333-4333-8333-000000001131', '44444444-4444-4444-8444-000000001131', '{}', array['Uno']);
  raise exception 'falla 1: cargó sin gestionar el torneo';
exception when insufficient_privilege then raise notice 'ok 1: sin gestionar el torneo, 42501';
end $$;

do $$ begin perform set_config('request.jwt.claims', '{"sub":"22222222-2222-4222-8222-000000001131","role":"authenticated"}', true); end $$;

-- 2. Fichas y nombres juntos, con los espacios limpios.
do $$
declare g text[]; n int;
begin
  perform event_register_historic('33333333-3333-4333-8333-000000001131', '44444444-4444-4444-8444-000000001131',
    array['11111111-1111-4111-8111-000000001131']::uuid[], array['  Juan   Pérez ', 'xX_Old_Xx']);
  select guest_names into g from tournament_registrations
   where event_id = '33333333-3333-4333-8333-000000001131' and team_id = '44444444-4444-4444-8444-000000001131';
  select count(*) into n from tournament_registration_players
   where event_id = '33333333-3333-4333-8333-000000001131' and team_id = '44444444-4444-4444-8444-000000001131';
  if g <> array['Juan Pérez', 'xX_Old_Xx'] or n <> 1 then raise exception 'falla 2: % y % fichas', g, n; end if;
  raise notice 'ok 2: 1 ficha y 2 nombres';
end $$;

-- 3. Repetidos (sin distinguir mayúsculas), cortos, largos y más de 10 en total.
do $$
declare caso text[]; casos text[][] := array[
  array['juan pérez', 'JUAN PÉREZ'], array['J', 'ok'], array[repeat('x', 25), 'ok']];
begin
  foreach caso slice 1 in array casos loop
    begin
      perform event_register_historic('33333333-3333-4333-8333-000000001131', '44444444-4444-4444-8444-000000001131', '{}', caso);
      raise exception 'falla 3: aceptó %', caso;
    exception when raise_exception then
      if sqlerrm like 'falla%' then raise; end if;
    end;
  end loop;
  begin
    perform event_register_historic('33333333-3333-4333-8333-000000001131', '44444444-4444-4444-8444-000000001131',
      array['11111111-1111-4111-8111-000000001131', '11111111-1111-4111-8111-000000001132']::uuid[],
      array['n1', 'n2', 'n3', 'n4', 'n5', 'n6', 'n7', 'n8', 'n9']);
    raise exception 'falla 3: aceptó 11 jugadores';
  exception when raise_exception then
    if sqlerrm not like 'Hasta 10%' then raise; end if;
  end;
  raise notice 'ok 3: repetidos, largos y más de 10, rechazados';
end $$;

-- 4. Lo rechazado no tocó lo guardado; vaciar los nombres los borra.
do $$
declare g text[];
begin
  select guest_names into g from tournament_registrations
   where event_id = '33333333-3333-4333-8333-000000001131' and team_id = '44444444-4444-4444-8444-000000001131';
  if g <> array['Juan Pérez', 'xX_Old_Xx'] then raise exception 'falla 4: cambió con un rechazo (%)', g; end if;
  perform event_register_historic('33333333-3333-4333-8333-000000001131', '44444444-4444-4444-8444-000000001131',
    array['11111111-1111-4111-8111-000000001131']::uuid[], '{}');
  select guest_names into g from tournament_registrations
   where event_id = '33333333-3333-4333-8333-000000001131' and team_id = '44444444-4444-4444-8444-000000001131';
  if g <> '{}' then raise exception 'falla 4: no se vaciaron (%)', g; end if;
  raise notice 'ok 4: lo rechazado no cambió nada y la lista vacía borra los nombres';
end $$;

-- 5. En un torneo normal, no.
do $$ begin
  perform event_register_historic('33333333-3333-4333-8333-000000001132', '44444444-4444-4444-8444-000000001131', '{}', array['Uno']);
  raise exception 'falla 5: cargó nombres en un torneo normal';
exception when raise_exception then
  if sqlerrm not like '%solo en un torneo histórico%' then raise; end if;
  raise notice 'ok 5: en un torneo normal, rechazado';
end $$;

-- 6. Anónimo no puede llamar a la función.
reset role;
set local role anon;
do $$ begin
  perform event_register_historic('33333333-3333-4333-8333-000000001131', '44444444-4444-4444-8444-000000001131', '{}', array['Uno']);
  raise exception 'falla 6: anon cargó';
exception when insufficient_privilege then raise notice 'ok 6: anon no puede';
end $$;
reset role;

-- 7. La inversa se aplica.
\i :rev113
do $$ begin
  if to_regprocedure('public.event_register_historic(uuid,uuid,uuid[],text[],integer)') is not null then
    raise exception 'falla 7: la inversa no borró la función';
  end if;
  raise notice 'ok 7: inversa';
end $$;

rollback;
