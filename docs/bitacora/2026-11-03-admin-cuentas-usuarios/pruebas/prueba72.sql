-- Pruebas del replanteo 72. Termina con un raise para deshacer todo y devolver el resultado como mensaje.
do $$
declare
  v_admin uuid; v_admin2 uuid; v_user uuid; v_sin uuid;
  r text := ''; j jsonb; n int;
  procedure_ok boolean;
begin
  select id into v_admin from profiles where role = 'admin' order by id limit 1;
  select id into v_user from profiles where role = 'user' order by id limit 1;
  -- Otro admin de mentira y una cuenta sin confirmar, solo dentro de esta prueba.
  update profiles set role = 'admin' where id = (select id from profiles where role = 'user' order by id offset 1 limit 1) returning id into v_admin2;
  select id into v_sin from profiles where role = 'user' order by id offset 2 limit 1;
  update auth.users set email_confirmed_at = null where id = v_sin;
  update auth.users set email_confirmed_at = coalesce(email_confirmed_at, now()) where id = v_user;
  insert into auth.sessions (id, user_id, created_at, updated_at) values (gen_random_uuid(), v_user, now(), now());

  perform set_config('request.jwt.claims', json_build_object('sub', v_admin, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';

  j := admin_account_status(v_sin);
  r := r || 'estado sin confirmar=' || (j->>'confirmed') || '; ';
  j := admin_account_action(v_sin, 'resend_confirmation');
  r := r || 'reenviar devuelve correo=' || (j->>'email' is not null) || '; ';
  begin perform admin_account_action(v_user, 'resend_confirmation'); r := r || 'MAL confirmada; ';
  exception when sqlstate '23505' then r := r || 'confirmada 23505; '; end;
  j := admin_account_action(v_user, 'password_reset_email');
  j := admin_account_action(v_user, 'random_password');
  r := r || 'aleatoria a usuario ok; ';
  begin perform admin_account_action(v_admin, 'random_password'); r := r || 'MAL propia; ';
  exception when sqlstate '42501' then r := r || 'propia 42501; '; end;
  begin perform admin_account_action(v_admin2, 'random_password'); r := r || 'MAL otro admin; ';
  exception when sqlstate '42501' then r := r || 'otro admin 42501; '; end;
  begin perform admin_account_action(gen_random_uuid(), 'random_password'); r := r || 'MAL inexistente; ';
  exception when sqlstate 'P0002' then r := r || 'inexistente P0002; '; end;
  begin perform admin_account_action(v_user, 'otra'); r := r || 'MAL accion; ';
  exception when sqlstate 'P0001' then r := r || 'accion P0001; '; end;
  select count(*) into n from account_admin_actions where admin_id = v_admin;
  r := r || 'el admin lee ' || n || ' registros; ';
  perform admin_account_close_sessions(v_user);
  execute 'reset role';
  select count(*) into n from auth.sessions where user_id = v_user;
  r := r || 'sesiones tras cerrar=' || n || '; ';

  perform set_config('request.jwt.claims', json_build_object('sub', v_sin, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
  begin perform admin_account_status(v_user); r := r || 'MAL usuario estado; ';
  exception when sqlstate '42501' then r := r || 'usuario estado 42501; '; end;
  begin perform admin_account_action(v_user, 'random_password'); r := r || 'MAL usuario accion; ';
  exception when sqlstate '42501' then r := r || 'usuario accion 42501; '; end;
  begin perform admin_account_close_sessions(v_user); r := r || 'MAL usuario cerrar; ';
  exception when sqlstate '42501' then r := r || 'usuario cerrar 42501; '; end;
  select count(*) into n from account_admin_actions;
  r := r || 'el usuario lee ' || n || ' registros; ';
  execute 'reset role';
  raise exception 'RESULTADO: %', r using errcode = 'ZZ001';
end $$;
