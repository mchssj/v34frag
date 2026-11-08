-- Pruebas del replanteo 85. Las arma probar_85.sh: van entre el replanteo y su inversa, dentro de una transacción que
-- se deshace al final (no dejan nada en la base). Cada bloque corre como el usuario que dice.

create table public.t85 (k text primary key, u uuid, p uuid);
grant select on public.t85 to anon, authenticated;
create function public.t85u(k text) returns uuid language sql stable as $$ select u from public.t85 where t85.k = $1 $$;
create function public.t85p(k text) returns uuid language sql stable as $$ select p from public.t85 where t85.k = $1 $$;
create function public.t85_como(k text) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', public.t85u(k), 'role', 'authenticated')::text, true) $$;
grant execute on function public.t85u(text), public.t85p(text), public.t85_como(text) to anon, authenticated;

-- Los datos de antes: ninguna marca quedó de un solo lado.
do $$
begin
  assert not exists (select 1 from mm_friends f join players p on p.id = f.player_id
                      where not exists (select 1 from mm_friends o join players yo on yo.user_id = f.user_id
                                         where o.user_id = p.user_id and o.player_id = yo.id)),
    'después de la 85 toda amistad tiene sus dos filas';
  assert (select count(*) from replanteo85_marcas) >= (select count(*) from mm_friends), 'las marcas de antes quedaron respaldadas';
  assert not exists (select 1 from notifications where type = 'friend_request' and read_at is null),
    'las solicitudes que vienen de marcas viejas no suben el número de la campana';
  raise notice 'ok: datos de antes (% solicitudes pendientes, % filas de amistad)',
    (select count(*) from mm_friend_requests), (select count(*) from mm_friends);
end $$;

do $$
declare k text; v uuid; pl uuid; i int;
begin
  update mm_config set blocks_vip_only = false;
  foreach k in array array['a', 'b', 'c', 'e', 'sinficha'] || array(select 'x' || g from generate_series(1, 21) g) loop
    v := gen_random_uuid();
    insert into auth.users (id, email, email_confirmed_at, created_at, aud, role)
      values (v, k || '-' || substr(v::text, 1, 6) || '@prueba85.local', now(), now(), 'authenticated', 'authenticated');
    pl := null;
    if k <> 'sinficha' then
      insert into players (nick, user_id) values ('t85' || k || substr(v::text, 1, 4), v) returning id into pl;
    end if;
    insert into t85 values (k, v, pl);
  end loop;
  insert into players (nick) values ('t85ficha' || substr(gen_random_uuid()::text, 1, 4)) returning id into pl;
  insert into t85 values ('ficha', null, pl);
  raise notice 'ok: datos de prueba';
end $$;

-- ===== 1. Enviar: pendiente, con su notificación =====
select t85_como('a'); set local role authenticated;
do $$
begin
  perform mm_add_friend(t85p('b'));
  assert mm_friendship(t85p('b')) = 'sent', 'a ve "enviada"';
  perform mm_add_friend(t85p('b'));
  raise notice 'ok: enviar';
end $$;
reset role;
do $$
begin
  assert (select count(*) from mm_friend_requests where from_user = t85u('a')) = 1, 'enviar dos veces no duplica';
  assert exists (select 1 from notifications where user_id = t85u('b') and type = 'friend_request' and actionable
                  and resolution is null and read_at is null and category = 'friends' and (data->'player'->>'id')::uuid = t85p('a')),
    'a b le llega la solicitud con Aceptar / Rechazar';
end $$;
select t85_como('b'); set local role authenticated;
do $$
declare j jsonb := mm_my_profile();
begin
  assert mm_friendship(t85p('a')) = 'received', 'b ve "te envió"';
  assert j->'friend_requests'->'received'->0->>'player_id' = t85p('a')::text, 'b la ve en el panel';
  assert jsonb_array_length(j->'friends') = 0, 'todavía no son amigos';
  -- ===== 2. Rechazar: en silencio =====
  perform mm_friend_answer(t85p('a'), false);
  assert mm_friendship(t85p('a')) = 'none', 'rechazada: nada pendiente';
  raise notice 'ok: recibir y rechazar';
end $$;
reset role;
do $$
begin
  assert (select resolution from notifications where user_id = t85u('b') and type = 'friend_request') = 'rejected', 'la notificación queda rechazada';
  assert not exists (select 1 from notifications where user_id = t85u('a') and type like 'friend%'), 'a no se entera del rechazo';
end $$;
select t85_como('a'); set local role authenticated;
do $$
begin
  assert mm_friendship(t85p('b')) = 'none', 'a ya no la ve enviada';
  begin
    perform mm_add_friend(t85p('b'));
    raise exception 'FALLA: volvió a enviar antes de los 7 días';
  exception when raise_exception then
    if sqlerrm like 'FALLA%' or sqlerrm like '%rechaz%' then raise; end if;
  end;
  raise notice 'ok: tras un rechazo, 7 días sin volver a enviar (sin decir que fue un rechazo)';
end $$;
reset role;

-- ===== 3. Cruzadas: amigos al instante =====
select t85_como('a'); set local role authenticated;
select mm_add_friend(t85p('c'));
reset role;
select t85_como('c'); set local role authenticated;
do $$
begin
  perform mm_add_friend(t85p('a'));
  assert mm_friendship(t85p('a')) = 'friends', 'se enviaron los dos: amigos';
  raise notice 'ok: solicitudes cruzadas';
end $$;
reset role;
do $$
begin
  assert (select count(*) from mm_friends where (user_id = t85u('a') and player_id = t85p('c')) or (user_id = t85u('c') and player_id = t85p('a'))) = 2,
    'la amistad tiene las dos filas';
  assert exists (select 1 from notifications where user_id = t85u('a') and type = 'friend_accepted'), 'a se entera de que son amigos';
  assert (select count(*) from mm_friend_requests where status = 'pending' and t85u('c') in (from_user, to_user)) = 0, 'sin pendientes';
  assert (select resolution from notifications where user_id = t85u('c') and type = 'friend_request') = 'accepted', 'su solicitud queda aceptada';
end $$;

-- ===== 4. Eliminar: para los dos =====
select t85_como('c'); set local role authenticated;
select mm_remove_friend(t85p('a'));
do $$ begin assert mm_friendship(t85p('a')) = 'none', 'eliminado'; end $$;
reset role;
do $$ begin assert not exists (select 1 from mm_friends where user_id in (t85u('a'), t85u('c'))), 'sin filas para ninguno'; raise notice 'ok: eliminar'; end $$;

-- ===== 5. Aceptar desde la notificación y ver el estado =====
select t85_como('a'); set local role authenticated;
select mm_add_friend(t85p('c'));
reset role;
select t85_como('c'); set local role authenticated;
do $$
declare j jsonb;
begin
  perform mm_friend_answer(t85p('a'), true);
  j := mm_my_profile();
  assert j->'friends'->0->>'player_id' = t85p('a')::text and j->'friends'->0->>'status' is not null, 'amigos y con el estado visible';
  begin
    perform mm_friend_answer(t85p('a'), true);
    raise exception 'FALLA: aceptó dos veces';
  exception when no_data_found then null;
  end;
  raise notice 'ok: aceptar';
end $$;
reset role;

-- ===== 6. Bloquear corta la amistad y no deja enviar =====
select t85_como('c'); set local role authenticated;
select mm_block(t85p('a'));
do $$ begin assert mm_friendship(t85p('a')) = 'unavailable', 'bloqueado: no disponible'; end $$;
reset role;
select t85_como('a'); set local role authenticated;
do $$
begin
  assert mm_friendship(t85p('c')) = 'unavailable', 'el bloqueado tampoco ve el botón';
  begin
    perform mm_add_friend(t85p('c'));
    raise exception 'FALLA: le envió a quien lo bloqueó';
  exception when raise_exception then if sqlerrm like 'FALLA%' then raise; end if;
  end;
  raise notice 'ok: bloquear';
end $$;
reset role;
do $$ begin assert not exists (select 1 from mm_friends where user_id in (t85u('a'), t85u('c'))), 'el bloqueo borró la amistad'; end $$;

-- ===== 7. Cancelar la enviada =====
select t85_como('a'); set local role authenticated;
select mm_add_friend(t85p('e'));
select mm_remove_friend(t85p('e'));
do $$ begin assert mm_friendship(t85p('e')) = 'none', 'cancelada'; end $$;
reset role;
do $$
begin
  assert (select resolution from notifications where user_id = t85u('e') and type = 'friend_request') = 'cancelled', 'su notificación queda cancelada';
  raise notice 'ok: cancelar';
end $$;

-- ===== 8. A quién no se le puede enviar =====
select t85_como('a'); set local role authenticated;
do $$
begin
  begin perform mm_add_friend(t85p('a')); raise exception 'FALLA: a sí mismo';
  exception when raise_exception then if sqlerrm like 'FALLA%' then raise; end if; end;
  begin perform mm_add_friend(t85p('ficha')); raise exception 'FALLA: a una ficha sin cuenta';
  exception when raise_exception then if sqlerrm like 'FALLA%' then raise; end if; end;
  assert mm_friendship(t85p('ficha')) = 'unavailable' and mm_friendship(t85p('a')) = 'self', 'estados especiales';
  raise notice 'ok: a sí mismo y a fichas sin cuenta, no';
end $$;
reset role;
select t85_como('sinficha'); set local role authenticated;
do $$
begin
  begin perform mm_add_friend(t85p('b')); raise exception 'FALLA: sin ficha';
  exception when raise_exception then if sqlerrm like 'FALLA%' then raise; end if; end;
  raise notice 'ok: sin ficha propia, no';
end $$;
reset role;

-- ===== 9. Vencen a los 30 días =====
select t85_como('b'); set local role authenticated;
select mm_add_friend(t85p('e'));
reset role;
update mm_friend_requests set created_at = now() - interval '31 days' where from_user = t85u('b') and to_user = t85u('e');
select t85_como('e'); set local role authenticated;
do $$
begin
  assert mm_friendship(t85p('b')) = 'none', 'vencida: ya no se ve';
  assert jsonb_array_length(mm_my_profile()->'friend_requests'->'received') = 0, 'ni en el panel';
  begin perform mm_friend_answer(t85p('b'), true); raise exception 'FALLA: aceptó una vencida';
  exception when no_data_found then null; end;
end $$;
-- La acción de cualquier jugador vence las de todos (el error de arriba deshizo la suya).
select mm_add_friend(t85p('x21'));
reset role;
do $$
begin
  assert (select status from mm_friend_requests where from_user = t85u('b') and to_user = t85u('e')) = 'expired', 'queda vencida';
  assert (select resolution from notifications where user_id = t85u('e') and type = 'friend_request' and data->'player'->>'id' = t85p('b')::text) = 'expired',
    'y su notificación también';
  raise notice 'ok: vencen a los 30 días';
end $$;

-- ===== 10. Tope de 20 enviadas =====
select t85_como('b'); set local role authenticated;
do $$
declare i int;
begin
  for i in 1 .. 20 loop perform mm_add_friend(t85p('x' || i)); end loop;
  begin perform mm_add_friend(t85p('x21')); raise exception 'FALLA: envió la 21';
  exception when raise_exception then if sqlerrm like 'FALLA%' then raise; end if; end;
  raise notice 'ok: tope de 20 sin responder';
end $$;
reset role;

do $$ begin raise notice 'ok: todas las pruebas del replanteo 85'; end $$;
-- Lo de prueba no se lleva a la inversa (las solicitudes de prueba no pasan a ser marcas).
delete from mm_friends where user_id in (select u from t85 where u is not null);
delete from mm_friend_requests where from_user in (select u from t85 where u is not null) or to_user in (select u from t85 where u is not null);
drop function public.t85_como(text);
drop function public.t85u(text);
drop function public.t85p(text);
drop table public.t85;
