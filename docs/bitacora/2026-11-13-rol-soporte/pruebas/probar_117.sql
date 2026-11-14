-- Prueba de la 117 en una transacción que se deshace (base local o producción).
-- Uso: probar_117.sh (le pasa las rutas de la 117 y de su inversa).
\set ON_ERROR_STOP 1
begin;

-- Las funciones antes de la 117, para comparar con la inversa al final.
create temp table antes as
select p.oid::regprocedure::text as fn, md5(pg_get_functiondef(p.oid)) as h
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
 where n.nspname = 'public' and p.proname in ('set_user_role', 'ban_create', 'ban_update', 'ban_lift', 'mm_admin_lift_penalty',
       'mm_admin_lists', 'profile_comment_delete', 'profile_comment_reports_admin', 'profile_comment_report_resolve',
       'team_staff_remove_logo', 'staff_public', 'clip_reprocess', 'clip_review_ok', 'clip_reject', 'notification_category');
grant select on antes to authenticated;

\i :r117

-- Cuentas: admin, moderador, dos de soporte, un usuario y dos jugadores a sancionar (todos con ficha).
insert into auth.users (id, email) values
  ('22222222-2222-4222-8222-000000117001', 'p117admin@example.com'),
  ('22222222-2222-4222-8222-000000117002', 'p117mod@example.com'),
  ('22222222-2222-4222-8222-000000117003', 'p117sop1@example.com'),
  ('22222222-2222-4222-8222-000000117004', 'p117sop2@example.com'),
  ('22222222-2222-4222-8222-000000117005', 'p117user@example.com'),
  ('22222222-2222-4222-8222-000000117006', 'p117t1@example.com'),
  ('22222222-2222-4222-8222-000000117007', 'p117t2@example.com');
insert into players (id, nick, steam_id, user_id) values
  ('11111111-1111-4111-8111-000000117001', 'p117admin', '76561190000117001', '22222222-2222-4222-8222-000000117001'),
  ('11111111-1111-4111-8111-000000117002', 'p117mod',   '76561190000117002', '22222222-2222-4222-8222-000000117002'),
  ('11111111-1111-4111-8111-000000117003', 'p117sop1',  '76561190000117003', '22222222-2222-4222-8222-000000117003'),
  ('11111111-1111-4111-8111-000000117004', 'p117sop2',  '76561190000117004', '22222222-2222-4222-8222-000000117004'),
  ('11111111-1111-4111-8111-000000117005', 'p117user',  '76561190000117005', '22222222-2222-4222-8222-000000117005'),
  ('11111111-1111-4111-8111-000000117006', 'p117t1',    '76561190000117006', '22222222-2222-4222-8222-000000117006'),
  ('11111111-1111-4111-8111-000000117007', 'p117t2',    '76561190000117007', '22222222-2222-4222-8222-000000117007');
update profiles set role = 'admin' where id = '22222222-2222-4222-8222-000000117001';
update profiles set role = 'moderator' where id = '22222222-2222-4222-8222-000000117002';

-- Lecturas para las comprobaciones con la sesión simulada (la RLS no deja ver las filas).
create function pg_temp.ban(p uuid) returns bans language sql security definer as $$ select * from public.bans where id = p $$;
create function pg_temp.sancionado(p uuid) returns boolean language sql security definer as $$
  select until > now() from public.mm_penalties where user_id = p $$;
create function pg_temp.un_clip() returns uuid language sql security definer as $$
  select l.id from public.match_clip_list l join public.match_clips mc on mc.id = l.id join public.matches m on m.id = mc.match_id
   where m.demo_status = 'uploaded' and mc.video_status is not null and mc.video_status <> 'processing' limit 1 $$;
create function pg_temp.reprocesado_por(p uuid) returns uuid language sql security definer as $$
  select video_reprocessed_by from public.match_clips where id = p $$;
grant execute on function pg_temp.ban(uuid), pg_temp.sancionado(uuid), pg_temp.un_clip(), pg_temp.reprocesado_por(uuid) to authenticated;

create temp table ids (k text primary key, v uuid);
grant select, insert, update on ids to authenticated;

create function pg_temp.como(p_user text) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', '22222222-2222-4222-8222-000000117' || p_user, 'role', 'authenticated')::text, true)
$$;
grant execute on function pg_temp.como(text) to authenticated;

set local role authenticated;

-- 1. El rol: solo un admin lo da.
select pg_temp.como('005');
do $$ begin
  perform set_user_role('22222222-2222-4222-8222-000000117003', 'support');
  raise exception 'falla 1: un usuario dio el rol';
exception when insufficient_privilege then raise notice 'ok 1a: un usuario no da roles';
end $$;
select pg_temp.como('001');
do $$ begin
  perform set_user_role('22222222-2222-4222-8222-000000117003', 'support');
  perform set_user_role('22222222-2222-4222-8222-000000117004', 'support');
  raise notice 'ok 1b: el admin da el rol support';
end $$;

-- 2. is_support e is_moderator.
select pg_temp.como('003');
do $$ begin
  if not is_support() then raise exception 'falla 2: el soporte no es is_support'; end if;
  if is_moderator() then raise exception 'falla 2: el soporte es is_moderator'; end if;
  perform pg_temp.como('002');
  if not is_support() then raise exception 'falla 2: el moderador no es is_support'; end if;
  perform pg_temp.como('005');
  if is_support() then raise exception 'falla 2: el usuario es is_support'; end if;
  raise notice 'ok 2: is_support para soporte y moderador, no para el usuario; is_moderator no incluye al soporte';
end $$;

-- 3. Baneo de soporte: hasta 120 minutos, nunca permanente.
select pg_temp.como('003');
do $$ begin
  perform ban_create('11111111-1111-4111-8111-000000117006', null, 'tóxico', now() + interval '150 minutes');
  raise exception 'falla 3: el soporte baneó 150 minutos';
exception when insufficient_privilege then raise notice 'ok 3a: 150 minutos, rechazado';
end $$;
do $$ begin
  perform ban_create('11111111-1111-4111-8111-000000117006', null, 'tóxico', null);
  raise exception 'falla 3: el soporte baneó permanente';
exception when insufficient_privilege then raise notice 'ok 3b: permanente, rechazado';
end $$;
do $$
declare v uuid; b bans;
begin
  -- 120 minutos y 30 segundos: entra por el margen, pero queda en 120.
  v := ban_create('11111111-1111-4111-8111-000000117006', null, 'tóxico', now() + interval '120 minutes 30 seconds');
  b := pg_temp.ban(v);
  if b.created_by_role is distinct from 'support' then raise exception 'falla 3c: created_by_role %', b.created_by_role; end if;
  if b.expires_at > now() + interval '120 minutes' then raise exception 'falla 3c: pasó de 120 minutos'; end if;
  insert into ids values ('ban1', v);
  raise notice 'ok 3c: baneo de soporte de 120 minutos, con created_by_role support';
end $$;

-- 4. No a quien ya está baneado.
do $$ begin
  perform ban_create('11111111-1111-4111-8111-000000117006', null, 'otra vez', now() + interval '10 minutes');
  raise exception 'falla 4: baneó a uno ya baneado';
exception when raise_exception then
  if sqlerrm not like 'Ya está baneado hasta el %' then raise; end if;
  raise notice 'ok 4: ya baneado (%)', sqlerrm;
end $$;

-- 5. Cambiar: solo hasta 120 minutos desde que lo puso; solo el motivo deja el vencimiento.
do $$
declare v uuid := (select v from ids where k = 'ban1'); e timestamptz;
begin
  begin
    perform ban_update(v, null, (pg_temp.ban(v)).created_at + interval '200 minutes');
    raise exception 'falla 5: estiró a 200 minutos';
  exception when insufficient_privilege then null;
  end;
  perform ban_update(v, null, now() + interval '60 minutes');
  e := (pg_temp.ban(v)).expires_at;
  perform ban_update(v, 'tóxico en el chat', null);
  if (pg_temp.ban(v)).expires_at <> e then raise exception 'falla 5: cambiar el motivo movió el vencimiento'; end if;
  raise notice 'ok 5: no pasa de 120 minutos y el motivo solo no mueve el vencimiento';
end $$;

-- 6. Otro soporte no cambia ni levanta el baneo ajeno; el que lo puso sí.
select pg_temp.como('004');
do $$
declare v uuid := (select v from ids where k = 'ban1');
begin
  begin perform ban_lift(v, 'no'); raise exception 'falla 6: levantó uno ajeno';
  exception when insufficient_privilege then null; end;
  begin perform ban_update(v, 'otro', null); raise exception 'falla 6: cambió uno ajeno';
  exception when insufficient_privilege then null; end;
  perform pg_temp.como('003');
  perform ban_lift(v, 'ya se calmó');
  raise notice 'ok 6: solo el que lo puso lo cambia y lo levanta';
end $$;

-- 7. Hasta 3 baneos de soporte por jugador en 7 días, sumando a todos los soportes (los levantados cuentan).
do $$
declare v uuid;
begin
  v := ban_create('11111111-1111-4111-8111-000000117006', null, 'dos', now() + interval '5 minutes');
  perform ban_lift(v, 'error');
  perform pg_temp.como('004');
  v := ban_create('11111111-1111-4111-8111-000000117006', null, 'tres', now() + interval '5 minutes');
  perform ban_lift(v, 'error');
  begin
    perform ban_create('11111111-1111-4111-8111-000000117006', null, 'cuatro', now() + interval '5 minutes');
    raise exception 'falla 7: cuarto baneo de soporte';
  exception when raise_exception then
    if sqlerrm not like 'Ya tiene 3 baneos de soporte%' then raise; end if;
  end;
  -- Otro jugador no se ve afectado.
  v := ban_create('11111111-1111-4111-8111-000000117007', null, 'spam', now() + interval '30 minutes');
  insert into ids values ('ban_t2', v);
  raise notice 'ok 7: el cuarto se rechaza y otro jugador no se ve afectado';
end $$;

-- 8. El moderador no tiene esos topes, y el soporte no toca su baneo.
select pg_temp.como('002');
do $$
declare v uuid; q jsonb;
begin
  v := ban_create('11111111-1111-4111-8111-000000117006', null, 'reincidente', now() + interval '3 days');
  insert into ids values ('ban_mod', v);
  if (pg_temp.ban(v)).created_by_role <> 'moderator' then raise exception 'falla 8: created_by_role del moderador'; end if;
  perform pg_temp.como('003');
  q := ban_support_quota('11111111-1111-4111-8111-000000117006', null);
  if (q->>'used')::int <> 3 or (q->>'remaining')::int <> 0 or not (q->>'banned')::boolean then raise exception 'falla 8: cupo %', q; end if;
  begin perform ban_lift(v, 'no'); raise exception 'falla 8: el soporte levantó el del moderador';
  exception when insufficient_privilege then null; end;
  q := ban_support_quota(null, '76561190000117005');
  if (q->>'used')::int <> 0 or (q->>'banned')::boolean then raise exception 'falla 8: cupo de otro %', q; end if;
  raise notice 'ok 8: el moderador banea 3 días; el cupo da 3 de 3 y baneado; el soporte no levanta lo del moderador';
end $$;

-- 9. El usuario común no banea ni ve el cupo.
select pg_temp.como('005');
do $$ begin
  begin perform ban_create(null, '76561190000117004', 'x', now() + interval '5 minutes'); raise exception 'falla 9';
  exception when insufficient_privilege then null; end;
  begin perform ban_support_quota(null, '76561190000117004'); raise exception 'falla 9';
  exception when insufficient_privilege then null; end;
  raise notice 'ok 9: el usuario no banea ni ve el cupo';
end $$;

-- 10. Sanciones de la cola: el soporte las ve y las levanta; las exclusiones no.
reset role;
insert into mm_penalties (user_id, level, until, last_offense_at) values ('22222222-2222-4222-8222-000000117007', 2, now() + interval '1 hour', now());
insert into mm_penalty_log (user_id, reason, until) values ('22222222-2222-4222-8222-000000117007', 'abandon', now() + interval '1 hour');
set local role authenticated;
select pg_temp.como('003');
do $$
declare j jsonb;
begin
  j := mm_admin_lists('penalties');
  if not exists (select 1 from jsonb_array_elements(j) e where e->>'user_id' = '22222222-2222-4222-8222-000000117007') then
    raise exception 'falla 10: no ve la sanción';
  end if;
  begin perform mm_admin_lists('bans'); raise exception 'falla 10: ve las exclusiones';
  exception when insufficient_privilege then null; end;
  begin perform mm_admin_lists('reports'); raise exception 'falla 10: ve los reportes';
  exception when insufficient_privilege then null; end;
  perform mm_admin_lift_penalty('22222222-2222-4222-8222-000000117007', 'se le cayó el juego');
  if pg_temp.sancionado('22222222-2222-4222-8222-000000117007') then raise exception 'falla 10: sigue sancionado'; end if;
  raise notice 'ok 10: el soporte ve y levanta sanciones; no ve exclusiones ni reportes';
end $$;

-- 11. Comentarios: borrar uno ajeno y resolver una denuncia.
reset role;
insert into profile_comments (id, player_id, author, body) values
  ('33333333-3333-4333-8333-000000117001', '11111111-1111-4111-8111-000000117006', '22222222-2222-4222-8222-000000117005', 'insulto 1'),
  ('33333333-3333-4333-8333-000000117002', '11111111-1111-4111-8111-000000117006', '22222222-2222-4222-8222-000000117005', 'insulto 2');
insert into profile_comment_reports (id, comment_id, reporter, reason) values
  ('44444444-4444-4444-8444-000000117001', '33333333-3333-4333-8333-000000117002', '22222222-2222-4222-8222-000000117006', 'toxic');
set local role authenticated;
select pg_temp.como('003');
do $$
declare j jsonb;
begin
  perform profile_comment_delete('33333333-3333-4333-8333-000000117001');
  j := profile_comment_reports_admin('open');
  if not exists (select 1 from jsonb_array_elements(j->'items') e where e->>'id' = '44444444-4444-4444-8444-000000117001') then
    raise exception 'falla 11: no ve la denuncia';
  end if;
  perform profile_comment_report_resolve('44444444-4444-4444-8444-000000117001', 'delete');
  raise notice 'ok 11: el soporte borra comentarios y resuelve denuncias';
end $$;
select pg_temp.como('005');
do $$ begin
  begin perform profile_comment_reports_admin('open'); raise exception 'falla 11: el usuario ve denuncias';
  exception when insufficient_privilege then null; end;
  raise notice 'ok 11b: el usuario no ve las denuncias';
end $$;

-- 12. Logo de un equipo: con motivo; queda en team_audit como support y le avisa al capitán.
reset role;
insert into teams (id, name, tag, owner_id, captain_id, logo_url)
values ('55555555-5555-4555-8555-000000117001', 'Prueba 117', 'P117', '22222222-2222-4222-8222-000000117006',
        '22222222-2222-4222-8222-000000117006', 'https://example.com/logo117.png');
set local role authenticated;
select pg_temp.como('003');
do $$
declare u text;
begin
  begin perform team_staff_remove_logo('55555555-5555-4555-8555-000000117001', ''); raise exception 'falla 12: sin motivo';
  exception when raise_exception then if sqlerrm not like 'El motivo%' then raise; end if; end;
  u := team_staff_remove_logo('55555555-5555-4555-8555-000000117001', 'logo ofensivo');
  if u <> 'https://example.com/logo117.png' then raise exception 'falla 12: devolvió %', u; end if;
  begin perform team_staff_rename('55555555-5555-4555-8555-000000117001', 'Otro', null, 'x'); raise exception 'falla 12: renombró';
  exception when insufficient_privilege then null; end;
  raise notice 'ok 12: el soporte quita el logo con motivo y no renombra';
end $$;
reset role;
do $$ begin
  if not exists (select 1 from team_audit where team_id = '55555555-5555-4555-8555-000000117001' and actor_role = 'support') then
    raise exception 'falla 12b: team_audit sin support';
  end if;
  if not exists (select 1 from notifications where user_id = '22222222-2222-4222-8222-000000117006' and type = 'team_staff_action'
                  and data->>'by' = 'support') then
    raise exception 'falla 12b: el capitán no recibió el aviso';
  end if;
  raise notice 'ok 12b: team_audit con support y aviso al capitán';
end $$;

-- 13. Foto de perfil.
update players set photo_url = 'https://example.com/ficha117.png' where id = '11111111-1111-4111-8111-000000117007';
insert into profile_details (user_id, avatar_url) values ('22222222-2222-4222-8222-000000117007', 'https://db.example.com/storage/v1/object/public/avatars/117/a.png')
on conflict (user_id) do update set avatar_url = excluded.avatar_url;
-- El trigger de la 71 borra la de la ficha al subir la de la cuenta: se vuelve a poner para probar las dos.
update players set photo_url = 'https://example.com/ficha117.png' where id = '11111111-1111-4111-8111-000000117007';
set local role authenticated;
select pg_temp.como('005');
do $$ begin
  begin perform staff_remove_photo('11111111-1111-4111-8111-000000117007', 'foto ofensiva'); raise exception 'falla 13: el usuario quitó la foto';
  exception when insufficient_privilege then null; end;
end $$;
select pg_temp.como('003');
do $$
declare j jsonb;
begin
  begin perform staff_remove_photo('11111111-1111-4111-8111-000000117007', 'no'); raise exception 'falla 13: motivo corto';
  exception when raise_exception then if sqlerrm not like 'El motivo%' then raise; end if; end;
  j := staff_remove_photo('11111111-1111-4111-8111-000000117007', 'foto ofensiva');
  if j->>'photo_url' <> 'https://example.com/ficha117.png' or j->>'avatar_url' <> 'https://db.example.com/storage/v1/object/public/avatars/117/a.png' then
    raise exception 'falla 13: devolvió %', j;
  end if;
  begin perform staff_remove_photo('11111111-1111-4111-8111-000000117007', 'otra vez'); raise exception 'falla 13: sin foto';
  exception when raise_exception then if sqlerrm <> 'No tiene foto de perfil' then raise; end if; end;
  raise notice 'ok 13: el soporte quita la foto (ficha y cuenta) con motivo';
end $$;
reset role;
do $$ begin
  if (select photo_url from players where id = '11111111-1111-4111-8111-000000117007') is not null
     or (select avatar_url from profile_details where user_id = '22222222-2222-4222-8222-000000117007') is not null then
    raise exception 'falla 13b: quedó la foto';
  end if;
  if not exists (select 1 from notifications where user_id = '22222222-2222-4222-8222-000000117007' and type = 'avatar_removed'
                  and category = 'account' and data->>'reason' = 'foto ofensiva') then
    raise exception 'falla 13b: no le llegó el aviso';
  end if;
  raise notice 'ok 13b: sin foto y con el aviso avatar_removed';
end $$;

-- 14. Clips: el soporte reprocesa; el usuario no.
set local role authenticated;
select pg_temp.como('005');
do $$ begin
  begin perform clip_reprocess(gen_random_uuid()); raise exception 'falla 14: el usuario reprocesó';
  exception when insufficient_privilege then null; end;
end $$;
select pg_temp.como('003');
do $$
declare c uuid;
begin
  begin perform clip_reprocess(gen_random_uuid()); raise exception 'falla 14';
  exception when no_data_found then null; end;
  -- Uno real de la copia, si hay (todo se deshace al final).
  c := pg_temp.un_clip();
  if c is null then
    raise notice 'ok 14: el soporte pasa el permiso (no hay un clip para reprocesar en esta base)';
  else
    perform clip_reprocess(c);
    if pg_temp.reprocesado_por(c) <> '22222222-2222-4222-8222-000000117003' then
      raise exception 'falla 14: video_reprocessed_by';
    end if;
    raise notice 'ok 14: el soporte reprocesa y queda video_reprocessed_by';
  end if;
end $$;

-- 14b. Para revisar (Daniel, 2026-11-14): el soporte publica y rechaza; el usuario no.
select pg_temp.como('005');
do $$ begin
  begin perform clip_review_ok(gen_random_uuid()); raise exception 'falla 14b: el usuario publicó';
  exception when insufficient_privilege then null; end;
  begin perform clip_reject(gen_random_uuid()); raise exception 'falla 14b: el usuario rechazó';
  exception when insufficient_privilege then null; end;
end $$;
select pg_temp.como('003');
do $$ begin
  begin perform clip_review_ok(gen_random_uuid()); raise exception 'falla 14b: publicar';
  exception when no_data_found then null; end;
  begin perform clip_reject(gen_random_uuid(), 'mal'); raise exception 'falla 14b: rechazar';
  exception when no_data_found then null; end;
  raise notice 'ok 14b: el soporte pasa el permiso de publicar y rechazar';
end $$;

-- 15. El registro: lo del soporte sí, lo del moderador no. Solo lo ven moderadores y admins.
do $$ begin
  begin perform support_actions_list(); raise exception 'falla 15: el soporte ve el registro';
  exception when insufficient_privilege then null; end;
  begin perform 1 from support_actions; raise exception 'falla 15: el soporte lee la tabla';
  exception when insufficient_privilege then null; end;
end $$;
select pg_temp.como('002');
do $$
declare j jsonb; acciones text[];
begin
  j := support_actions_list(p_limit => 100);
  select array_agg(distinct e->>'action' order by e->>'action') into acciones from jsonb_array_elements(j->'items') e
   where e->'actor'->>'id' in ('11111111-1111-4111-8111-000000117003', '11111111-1111-4111-8111-000000117004');
  if acciones is distinct from array['ban', 'ban_lift', 'ban_update', 'comment_delete', 'comment_report', 'logo_remove', 'penalty_lift', 'photo_remove']
     and acciones is distinct from array['ban', 'ban_lift', 'ban_update', 'clip_reprocess', 'comment_delete', 'comment_report', 'logo_remove', 'penalty_lift', 'photo_remove'] then
    raise exception 'falla 15: acciones %', acciones;
  end if;
  if exists (select 1 from jsonb_array_elements(j->'items') e where e->'actor'->>'id' = '11111111-1111-4111-8111-000000117002') then
    raise exception 'falla 15: anotó al moderador';
  end if;
  j := support_actions_list(p_action => 'photo_remove');
  if (j->>'total')::int <> 1 or j->'items'->0->'player'->>'id' <> '11111111-1111-4111-8111-000000117007' then raise exception 'falla 15: filtro %', j; end if;
  raise notice 'ok 15: el registro tiene lo del soporte (%), filtra y solo lo ve el moderador', acciones;
end $$;

-- 16. Quiénes somos.
do $$
declare j jsonb := staff_public();
begin
  if not exists (select 1 from jsonb_array_elements(j->'supports') e where e->>'player_id' = '11111111-1111-4111-8111-000000117003') then raise exception 'falla 16: %', j->'supports'; end if;
  if exists (select 1 from jsonb_array_elements(j->'moderators') e where e->>'player_id' = '11111111-1111-4111-8111-000000117003') then raise exception 'falla 16: soporte en moderadores'; end if;
  raise notice 'ok 16: staff_public trae supports';
end $$;

-- 17. Un usuario no puede subirse el rol por su cuenta.
select pg_temp.como('005');
do $$ begin
  update profiles set role = 'support' where id = '22222222-2222-4222-8222-000000117005';
  if (select role from profiles where id = '22222222-2222-4222-8222-000000117005') = 'support' then raise exception 'falla 17'; end if;
  raise notice 'ok 17: el usuario no se cambia el rol';
exception when insufficient_privilege or raise_exception then
  if sqlerrm = 'falla 17' then raise; end if;
  raise notice 'ok 17: el usuario no se cambia el rol (%)', sqlerrm;
end $$;

-- 18. La inversa.
reset role;
\i :rev117
do $$
declare distintas text;
begin
  select string_agg(a.fn, ', ') into distintas from antes a
   where a.h is distinct from (select md5(pg_get_functiondef(a.fn::regprocedure)));
  if distintas is not null then raise exception 'falla 18: la inversa no deja igual: %', distintas; end if;
  if to_regclass('public.support_actions') is not null or to_regprocedure('public.is_support()') is not null then
    raise exception 'falla 18: quedó la tabla o is_support';
  end if;
  if exists (select 1 from profiles where role = 'support') then raise exception 'falla 18: quedaron cuentas support'; end if;
  raise notice 'ok 18: la inversa vuelve a la 116 (funciones idénticas)';
end $$;

rollback;
