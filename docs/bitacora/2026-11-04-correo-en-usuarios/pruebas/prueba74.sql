-- Pruebas del replanteo 74 (correr después de aplicarlo). Termina con un raise para deshacer todo y devolver el resultado
-- como mensaje. No muestra ningún correo: solo compara.
do $$
declare
  v_admin uuid; v_mod uuid; v_user uuid; r text := ''; j jsonb;
begin
  select id into v_admin from profiles where role = 'admin' order by id limit 1;
  select id into v_user from profiles where role = 'user' order by id limit 1;
  update profiles set role = 'moderator' where id = (select id from profiles where role = 'user' order by id offset 1 limit 1) returning id into v_mod;

  perform set_config('request.jwt.claims', json_build_object('sub', v_admin, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
  j := admin_account_status(v_user);
  execute 'reset role';
  r := r || 'admin: correo igual al de auth.users=' || ((j->>'email') is not distinct from (select email from auth.users where id = v_user)) || '; ';
  r := r || 'sigue con confirmed=' || (j ? 'confirmed') || ' y last_sign_in_at=' || (j ? 'last_sign_in_at') || '; ';

  perform set_config('request.jwt.claims', json_build_object('sub', v_mod, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
  begin perform admin_account_status(v_user); r := r || 'MAL moderador; ';
  exception when sqlstate '42501' then r := r || 'moderador 42501; '; end;
  execute 'reset role';

  perform set_config('request.jwt.claims', json_build_object('sub', v_user, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
  begin perform admin_account_status(v_admin); r := r || 'MAL usuario; ';
  exception when sqlstate '42501' then r := r || 'usuario 42501; '; end;
  execute 'reset role';

  raise exception 'RESULTADO: %', r;
end $$;
-- Esperado: admin: correo igual al de auth.users=true; sigue con confirmed=true y last_sign_in_at=true; moderador 42501; usuario 42501;
