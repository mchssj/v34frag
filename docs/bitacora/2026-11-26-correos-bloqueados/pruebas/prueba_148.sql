-- Prueba del replanteo 148, después de aplicarlo en la misma transacción (termina en rollback). Como supabase_admin:
--   (echo "begin;"; sed '/^begin;$/d; /^commit;$/d' supabase/replanteo/148_correos_bloqueados.sql; cat prueba_148.sql) | psql -U supabase_admin
do $$
declare v_admin uuid; v_user uuid; v_ok boolean; r jsonb; n int;
begin
  -- 1. Dominio, subdominio, mayúsculas y otros
  assert email_domain_blocked('x@anonmart.com'), '1a anonmart';
  assert email_domain_blocked('X@AnonMart.COM'), '1b mayúsculas';
  assert email_domain_blocked('x@mail.anonmart.com'), '1c subdominio';
  assert not email_domain_blocked('x@gmail.com'), '1d gmail';
  assert not email_domain_blocked('sin-arroba'), '1e sin @';
  assert not email_domain_blocked(null), '1f null';
  assert not email_domain_blocked('x@notanonmart.com'), '1g parecido';
  raise notice '1 ok: dominio, subdominio, mayúsculas';

  -- 2. Excepción de la lista: la más específica manda
  insert into email_domain_blocks (domain, source) values ('tempmail-prueba.com', 'lista');
  insert into email_domain_blocks (domain, source, blocked) values ('ok.tempmail-prueba.com', 'lista', false);
  assert email_domain_blocked('a@tempmail-prueba.com'), '2a lista';
  assert not email_domain_blocked('a@ok.tempmail-prueba.com'), '2b excepción del subdominio';
  raise notice '2 ok: excepción';

  -- 3. Trigger: alta bloqueada, alta normal, cambio de correo bloqueado y email_change bloqueado
  begin
    insert into auth.users (id, email) values (gen_random_uuid(), 'cheater@anonmart.com');
    raise exception '3a: tendría que haber fallado';
  exception when sqlstate 'P0001' then
    if sqlerrm not like 'No aceptamos correos temporales%' then raise; end if;
  end;
  v_user := gen_random_uuid();
  insert into auth.users (id, email) values (v_user, 'prueba148@gmail.com');
  begin
    update auth.users set email = 'otro@afronewz.com' where id = v_user;
    raise exception '3c: tendría que haber fallado';
  exception when sqlstate 'P0001' then null;
  end;
  begin
    update auth.users set email_change = 'otro@sub.anonmart.com' where id = v_user;
    raise exception '3d: tendría que haber fallado';
  exception when sqlstate 'P0001' then null;
  end;
  update auth.users set raw_user_meta_data = '{}'::jsonb where id = v_user;   -- otro cambio no lo frena
  raise notice '3 ok: trigger';

  -- 4. Admin (con el JWT de un admin)
  select id into v_admin from profiles where role = 'admin' limit 1;
  perform set_config('request.jwt.claims', json_build_object('sub', v_admin, 'role', 'authenticated')::text, true);
  assert is_admin(), '4a is_admin';
  perform admin_email_domain_block('@MiDominio-Prueba.com.', 'prueba');
  assert email_domain_blocked('a@midominio-prueba.com'), '4b bloqueado por admin';
  r := admin_email_domain_unblock('midominio-prueba.com');
  assert (r->>'removed')::boolean, '4c el de admin se borra';
  assert not exists (select 1 from email_domain_blocks where domain = 'midominio-prueba.com'), '4d borrado';
  r := admin_email_domain_unblock('tempmail-prueba.com');
  assert not (r->>'removed')::boolean, '4e el de la lista queda como excepción';
  assert not email_domain_blocked('a@tempmail-prueba.com'), '4f excepción';
  perform admin_email_domain_block('tempmail-prueba.com');
  assert email_domain_blocked('a@tempmail-prueba.com'), '4g se vuelve a bloquear';
  begin
    perform admin_email_domain_block('no es un dominio');
    raise exception '4h: tendría que haber fallado';
  exception when sqlstate 'P0001' then null;
  end;
  select count(*) into n from admin_email_domain_accounts();
  raise notice '4 ok: admin (cuentas con dominio bloqueado hoy: %)', n;

  -- 5. Un usuario que no es admin
  select id into v_user from profiles where role = 'user' limit 1;
  perform set_config('request.jwt.claims', json_build_object('sub', v_user, 'role', 'authenticated')::text, true);
  begin
    perform admin_email_domain_block('x.com');
    raise exception '5a: tendría que haber fallado';
  exception when sqlstate '42501' then null;
  end;
  raise notice '5 ok: no admin rechazado';

  -- 6. Permisos
  assert has_function_privilege('anon', 'public.email_domain_blocked(text)', 'execute'), '6a anon consulta';
  assert not has_function_privilege('anon', 'public.admin_email_domain_block(text,text)', 'execute'), '6b anon no bloquea';
  assert not has_function_privilege('anon', 'public.admin_email_domain_accounts()', 'execute'), '6c anon no ve cuentas';
  assert not has_table_privilege('anon', 'public.email_domain_blocks', 'select'), '6d anon no lee la tabla';
  assert not has_table_privilege('authenticated', 'public.email_domain_blocks', 'insert'), '6e nadie inserta directo';
  assert not has_function_privilege('authenticated', 'public.auth_users_email_domain_check()', 'execute'), '6f trigger';
  raise notice '6 ok: permisos';
end $$;
rollback;
