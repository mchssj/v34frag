-- Pruebas del replanteo 84. Las arma probar_84.sh: van entre el replanteo y su inversa, dentro de una transacción que
-- se deshace al final (no dejan nada en la base). Cada bloque corre con el rol que dice, con la RLS de verdad.

create table public.t84 (k text primary key, id uuid);
grant select, insert on public.t84 to anon, authenticated;
create function public.t84(p text) returns uuid language sql stable as $$ select id from public.t84 where k = p $$;
create function public.t84_como(p text) returns void language sql as $$
  select set_config('request.jwt.claims', case when p is null then '' else
         json_build_object('sub', public.t84(p), 'role', 'authenticated')::text end, true) $$;
grant execute on function public.t84(text), public.t84_como(text) to anon, authenticated;

do $$
declare k text; v uuid;
begin
  foreach k in array array['admin', 'mod', 'mod2', 'org', 'user'] loop
    v := gen_random_uuid();
    insert into auth.users (id, email, email_confirmed_at, created_at, aud, role)
      values (v, k || '-' || substr(v::text, 1, 6) || '@prueba84.local', now(), now(), 'authenticated', 'authenticated');
    update profiles set role = case k when 'admin' then 'admin' when 'mod' then 'moderator' when 'mod2' then 'moderator'
                                      when 'org' then 'organizer' else 'user' end where id = v;
    insert into t84 values (k, v);
  end loop;
  raise notice 'ok: datos de prueba';
end $$;

-- ===== 1. El moderador crea normales e históricos, pendientes de un admin =====
select t84_como('mod'); set local role authenticated;
do $$
declare v uuid;
begin
  insert into events (name, starts_on) values ('T84 normal del moderador', current_date + 7) returning id into v;
  insert into t84 values ('evMod', v);
  assert (select approval from events where id = v) = 'pending', 'el torneo de un moderador nace pendiente';
  assert (select admin_review from events where id = v), 'el torneo de un moderador lo aprueba un admin';
  insert into events (name, historic, starts_on, ends_on) values ('T84 histórico del moderador', true, '2025-07-12', '2025-07-20')
    returning id into v;
  insert into t84 values ('evModHist', v);
  assert (select approval = 'pending' and admin_review from events where id = v), 'el histórico de un moderador también';
  insert into events (name, testing) values ('T84 testing del moderador', true) returning id into v;
  insert into t84 values ('evModTest', v);
  assert (select approval = 'pending' and testing from events where id = v), 'en testing y pendiente a la vez';
  begin
    update events set admin_review = false where id = (select t84('evMod'));
    raise exception 'FALLA: el moderador cambió quién aprueba';
  exception when raise_exception then if sqlerrm like 'FALLA%' then raise; end if;
  end;
  begin
    perform event_review(t84('evMod'), true);
    raise exception 'FALLA: el moderador se aprobó solo';
  exception when insufficient_privilege then null;
  end;
  raise notice 'ok: moderador (crea normales, históricos y en testing, pendientes de un admin)';
end $$;
reset role;

-- ===== 2. Otro moderador no lo aprueba; lo de un organizador, sí =====
select t84_como('org'); set local role authenticated;
do $$
declare v uuid;
begin
  insert into events (name) values ('T84 del organizador') returning id into v;
  insert into t84 values ('evOrg', v);
  assert (select approval = 'pending' and not admin_review from events where id = v), 'el del organizador lo aprueba el staff';
  raise notice 'ok: organizador';
end $$;
reset role;

select t84_como('mod2'); set local role authenticated;
do $$
begin
  begin
    perform event_review(t84('evMod'), false, 'no');
    raise exception 'FALLA: otro moderador rechazó lo de un moderador';
  exception when insufficient_privilege then null;
  end;
  perform event_review(t84('evOrg'), true);
  assert (select approval from events where id = t84('evOrg')) = 'approved', 'el moderador aprueba lo de un organizador';
  raise notice 'ok: otro moderador (no aprueba lo de un moderador, sí lo de un organizador)';
end $$;
reset role;

-- ===== 3. El admin rechaza y aprueba; el moderador lo vuelve a enviar, también en testing =====
select t84_como('admin'); set local role authenticated;
do $$
declare v uuid;
begin
  perform event_review(t84('evMod'), false, 'Falta el reglamento');
  perform event_review(t84('evModTest'), false, 'Falta el premio');
  insert into events (name) values ('T84 del admin') returning id into v;
  assert (select approval = 'approved' and not admin_review from events where id = v), 'lo del admin nace aprobado';
  raise notice 'ok: admin (rechaza lo de un moderador y lo suyo nace aprobado)';
end $$;
reset role;

select t84_como('mod'); set local role authenticated;
do $$
begin
  perform event_resubmit(t84('evMod'));
  perform event_resubmit(t84('evModTest'));
  assert (select count(*) from events where id in (t84('evMod'), t84('evModTest')) and approval = 'pending') = 2, 'los volvió a enviar';
  raise notice 'ok: el moderador vuelve a enviar lo suyo (también en testing)';
end $$;
reset role;

select t84_como('admin'); set local role authenticated;
do $$
begin
  perform event_review(t84('evMod'), true);
  assert (select approval from events where id = t84('evMod')) = 'approved', 'el admin aprueba lo de un moderador';
  raise notice 'ok: el admin lo aprueba';
end $$;
reset role;

-- ===== 4. Avisos de revisión: lo de un moderador, solo a los admins =====
do $$
declare v_ev uuid := t84('evModHist'); v_org uuid := t84('evOrg');
begin
  assert exists (select 1 from notifications where user_id = t84('admin') and type = 'admin_event_review' and data->'event'->>'id' = v_ev::text),
    'al admin le llega el aviso del torneo del moderador';
  assert not exists (select 1 from notifications where user_id = t84('mod2') and type = 'admin_event_review' and data->'event'->>'id' = v_ev::text),
    'a otro moderador no';
  assert exists (select 1 from notifications where user_id = t84('mod2') and type = 'admin_event_review' and data->'event'->>'id' = v_org::text),
    'lo de un organizador le sigue llegando al moderador';
  assert exists (select 1 from notifications where user_id = t84('admin') and type = 'admin_event_review'
                  and data->'event'->>'id' = t84('evModTest')::text and data->>'resubmitted' = 'true'),
    'al volver a enviarlo, el aviso le llega al admin';
  assert not exists (select 1 from notifications where user_id = t84('mod2') and type = 'admin_event_review'
                      and data->'event'->>'id' = t84('evModTest')::text),
    'y no al otro moderador';
  raise notice 'ok: avisos de revisión';
end $$;

-- ===== 5. Dueño de lo suyo (borrar), sin tocar lo ajeno =====
select t84_como('mod'); set local role authenticated;
do $$
declare n int;
begin
  delete from events where id = t84('evModHist');
  get diagnostics n = row_count;
  assert n = 1, 'el moderador borra un torneo que creó';
  raise notice 'ok: el moderador es dueño de lo que creó';
end $$;
reset role;

select t84_como('mod2'); set local role authenticated;
do $$
declare n int;
begin
  delete from events where id = t84('evMod');
  get diagnostics n = row_count;
  assert n = 0, 'otro moderador no borra lo ajeno';
  raise notice 'ok: otro moderador no borra lo ajeno';
end $$;
reset role;

-- ===== 6. Premio con monto y divisa =====
select t84_como('admin'); set local role authenticated;
do $$
declare v uuid;
begin
  insert into events (name, prize, prize_amount, prize_currency) values ('T84 premio ARS', 'rol en Discord', 50000, 'ARS') returning id into v;
  assert (select prize_currency from event_list where id = v) = 'ARS', 'event_list trae la divisa';
  insert into events (name, prize_amount, prize_currency, prize_currency_other) values ('T84 premio BRL', 200, 'other', 'BRL');
  insert into events (name, prize) values ('T84 premio solo texto', 'Medalla');
  begin
    insert into events (name, prize_amount) values ('T84 monto sin divisa', 10);
    raise exception 'FALLA: monto sin divisa';
  exception when check_violation then null;
  end;
  begin
    insert into events (name, prize_currency) values ('T84 divisa sin monto', 'USD');
    raise exception 'FALLA: divisa sin monto';
  exception when check_violation then null;
  end;
  begin
    insert into events (name, prize_amount, prize_currency) values ('T84 otra sin nombre', 10, 'other');
    raise exception 'FALLA: otra sin nombre';
  exception when check_violation then null;
  end;
  begin
    insert into events (name, prize_currency_other) values ('T84 nombre sin divisa', 'BRL');
    raise exception 'FALLA: nombre de divisa sin divisa';
  exception when check_violation then null;
  end;
  begin
    insert into events (name, prize_amount, prize_currency, prize_currency_other) values ('T84 USD con nombre', 10, 'USD', 'BRL');
    raise exception 'FALLA: USD con nombre de otra';
  exception when check_violation then null;
  end;
  begin
    insert into events (name, prize_amount, prize_currency) values ('T84 monto cero', 0, 'USD');
    raise exception 'FALLA: monto cero';
  exception when check_violation then null;
  end;
  raise notice 'ok: premio con monto y divisa';
end $$;
reset role;

-- ===== 7. Un jugador sigue sin crear =====
select t84_como('user'); set local role authenticated;
do $$
begin
  begin
    insert into events (name) values ('T84 del jugador');
    raise exception 'FALLA: un jugador creó un torneo';
  exception when insufficient_privilege then null;
  end;
  raise notice 'ok: jugador';
end $$;
reset role;

do $$ begin raise notice 'ok: todas las pruebas del replanteo 84'; end $$;
drop function public.t84_como(text);
drop function public.t84(text);
drop table public.t84;
