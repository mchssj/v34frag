-- Prueba de la 120 en una transacción que se deshace (base local con la 119).
-- Uso: probar_120.sh (le pasa las rutas de la 120 y de su inversa).
\set ON_ERROR_STOP 1
begin;

create function pg_temp.estructura() returns table (k text, h text) language sql as $$
  select p.proname || '(' || pg_get_function_identity_arguments(p.oid) || ')', md5(pg_get_functiondef(p.oid))
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.prokind = 'f'
  union all
  select conrelid::regclass::text || ':' || conname, pg_get_constraintdef(oid)
    from pg_constraint where connamespace = 'public'::regnamespace $$;
create temp table huella as select * from pg_temp.estructura();

\i :r120

-- Cuentas: J (jugador con ficha y portada), S (soporte), M (moderador), O (otro jugador, sin permisos).
insert into auth.users (id, email, raw_user_meta_data) values
  ('22222222-2222-4222-8222-0000000120a0', 'p120j@example.com', '{"tag":"p120j"}'),
  ('22222222-2222-4222-8222-0000000120b0', 'p120s@example.com', '{"tag":"p120s"}'),
  ('22222222-2222-4222-8222-0000000120c0', 'p120m@example.com', '{"tag":"p120m"}'),
  ('22222222-2222-4222-8222-0000000120d0', 'p120o@example.com', '{"tag":"p120o"}');
update profiles set role = 'support' where id = '22222222-2222-4222-8222-0000000120b0';
update profiles set role = 'moderator' where id = '22222222-2222-4222-8222-0000000120c0';
insert into players (id, nick, steam_id, user_id) values
  ('11111111-1111-4111-8111-0000000120a0', 'p120j', '76561190000012001', '22222222-2222-4222-8222-0000000120a0'),
  ('11111111-1111-4111-8111-0000000120f0', 'p120f', '76561190000012002', null);
insert into profile_details (user_id, cover_url) values ('22222222-2222-4222-8222-0000000120a0', 'https://x/c1.jpg')
  on conflict (user_id) do update set cover_url = excluded.cover_url;
-- Una denuncia abierta de esa portada (la manda O).
insert into profile_media_reports (target, kind, url, reporter, reason)
values ('22222222-2222-4222-8222-0000000120a0', 'cover', 'https://x/c1.jpg', '22222222-2222-4222-8222-0000000120d0', 'offensive');

set local role authenticated;
-- O: sin permisos.
do $$ begin perform set_config('request.jwt.claims', '{"sub":"22222222-2222-4222-8222-0000000120d0","role":"authenticated"}', true); end $$;
do $$ begin
  begin perform staff_remove_cover('11111111-1111-4111-8111-0000000120a0', 'no corresponde'); raise exception 'falla 1';
  exception when insufficient_privilege then null; end;
  raise notice 'ok 1: un jugador no quita portadas';
end $$;

-- S: motivo corto, ficha sin cuenta, y la quita con aviso, registro y la denuncia cerrada.
do $$ begin perform set_config('request.jwt.claims', '{"sub":"22222222-2222-4222-8222-0000000120b0","role":"authenticated"}', true); end $$;
do $$
declare v text;
begin
  begin perform staff_remove_cover('11111111-1111-4111-8111-0000000120a0', 'no'); raise exception 'falla 2a';
  exception when raise_exception then if sqlerrm <> 'El motivo tiene que tener entre 3 y 300 caracteres' then raise; end if; end;
  begin perform staff_remove_cover('11111111-1111-4111-8111-0000000120f0', 'ofensiva'); raise exception 'falla 2b';
  exception when raise_exception then if sqlerrm <> 'No tiene portada' then raise; end if; end;
  begin perform staff_remove_cover('11111111-1111-4111-8111-000000012099', 'ofensiva'); raise exception 'falla 2c';
  exception when no_data_found then null; end;
  v := staff_remove_cover('11111111-1111-4111-8111-0000000120a0', 'Imagen ofensiva');
  if v <> 'https://x/c1.jpg' then raise exception 'falla 2d: %', v; end if;
  begin perform staff_remove_cover('11111111-1111-4111-8111-0000000120a0', 'otra vez'); raise exception 'falla 2e';
  exception when raise_exception then if sqlerrm <> 'No tiene portada' then raise; end if; end;
  raise notice 'ok 2: el soporte la quita con motivo; sin portada o sin ficha, no';
end $$;
reset role;
do $$ begin
  if (select cover_url from profile_details where user_id = '22222222-2222-4222-8222-0000000120a0') is not null then raise exception 'falla 3a'; end if;
  if not exists (select 1 from notifications where user_id = '22222222-2222-4222-8222-0000000120a0' and type = 'cover_removed'
                   and data ->> 'reason' = 'Imagen ofensiva' and category = 'account') then raise exception 'falla 3b: sin aviso'; end if;
  if not exists (select 1 from support_actions where actor_id = '22222222-2222-4222-8222-0000000120b0' and action = 'cover_remove'
                   and target ->> 'cover_url' = 'https://x/c1.jpg' and reason = 'Imagen ofensiva') then raise exception 'falla 3c: sin registro'; end if;
  if (select status from profile_media_reports where url = 'https://x/c1.jpg') <> 'removed' then raise exception 'falla 3d: la denuncia sigue abierta'; end if;
  raise notice 'ok 3: aviso cover_removed, actividad del soporte y la denuncia cerrada';
end $$;

-- M: también la quita; no queda en la actividad del soporte (es moderador).
update profile_details set cover_url = 'https://x/c2.jpg' where user_id = '22222222-2222-4222-8222-0000000120a0';
set local role authenticated;
do $$ begin perform set_config('request.jwt.claims', '{"sub":"22222222-2222-4222-8222-0000000120c0","role":"authenticated"}', true); end $$;
do $$ begin
  if staff_remove_cover('11111111-1111-4111-8111-0000000120a0', 'No respeta las reglas') <> 'https://x/c2.jpg' then raise exception 'falla 4a'; end if;
end $$;
reset role;
do $$ begin
  if exists (select 1 from support_actions where target ->> 'cover_url' = 'https://x/c2.jpg') then raise exception 'falla 4b'; end if;
  raise notice 'ok 4: el moderador la quita, sin registro de soporte';
end $$;

-- La inversa deja la estructura igual.
delete from support_actions where action = 'cover_remove';
\i :rev120
do $$
declare d text;
begin
  select string_agg(x.k, ', ') into d from (
    (select * from huella except select * from pg_temp.estructura())
    union (select * from pg_temp.estructura() except select * from huella)) x;
  if d is not null then raise exception 'falla 5: la estructura no quedó igual: %', d; end if;
  raise notice 'ok 5: la inversa deja la estructura idéntica';
end $$;

rollback;
