-- Pruebas del replanteo 93. Las arma probar_93.sh: van entre el replanteo y su inversa, dentro de una transacción que
-- se deshace al final (no dejan nada en la base). Cada bloque corre como el usuario que dice (t90_como).

create table public.t90 (k text primary key, u uuid, p uuid);
grant select on public.t90 to anon, authenticated;
create function public.t90u(k text) returns uuid language sql stable as $$ select u from public.t90 where t90.k = $1 $$;
create function public.t90_como(k text) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', public.t90u(k), 'role', 'authenticated')::text, true) $$;
grant execute on function public.t90u(text), public.t90_como(text) to anon, authenticated;
create temp table t90_ids (k text primary key, id uuid, n bigint);

do $$
declare k text; v uuid; pl uuid; g uuid;
begin
  foreach k in array array['a', 'b', 'c', 'adm'] loop
    v := gen_random_uuid();
    insert into auth.users (id, email, email_confirmed_at, created_at, aud, role)
      values (v, k || '-' || substr(v::text, 1, 6) || '@prueba90.local', now(), now(), 'authenticated', 'authenticated');
    insert into players (nick, user_id) values ('t90' || k || substr(v::text, 1, 4), v) returning id into pl;
    insert into t90 values (k, v, pl);
  end loop;
  update profiles set role = 'admin' where id = t90u('adm');
  insert into mm_parties (leader_id) values (t90u('a')) returning id into g;
  insert into mm_party_members (party_id, user_id) values (g, t90u('a'));
  insert into t90_ids values ('party', g, null);
  raise notice 'ok: datos de prueba';
end $$;

-- ===== 1. Solo, sin compañeros, no hay chat =====
do $$
begin
  perform t90_como('a');
  begin
    perform mm_party_chat_send('hola');
    raise exception '1: escribió sin compañeros';
  exception when raise_exception then
    if sqlerrm not like 'El chat del grupo es con al menos un compañero%' then raise; end if;
  end;
  perform t90_como('c');
  begin
    perform mm_party_chat_send('hola');
    raise exception '1: escribió sin grupo';
  exception when raise_exception then
    if sqlerrm not like 'No estás en un grupo%' then raise; end if;
  end;
  raise notice 'ok 1: sin grupo de dos no hay chat';
end $$;

-- ===== 2. Con un compañero: escribir, leer y el aviso del socket =====
do $$
declare m jsonb; l jsonb;
begin
  insert into mm_party_members (party_id, user_id) values ((select id from t90_ids where k = 'party'), t90u('b'));
  perform t90_como('a');
  m := mm_party_chat_send('  ¿buscamos de nuevo?  ');
  assert m->>'message' = '¿buscamos de nuevo?', '2: el mensaje se guarda sin espacios a los costados';
  assert (m->>'is_me')::boolean, '2: el mensaje propio viene con is_me';
  assert m->>'player_id' = (select p::text from t90 where k = 'a'), '2: el mensaje trae la ficha del autor';
  insert into t90_ids values ('msg', null, (m->>'id')::bigint);
  perform t90_como('b');
  l := mm_party_chat_list();
  assert jsonb_array_length(l) = 1 and not (l->0->>'is_me')::boolean, '2: el compañero lo lee';
  perform t90_como('c');
  assert jsonb_array_length(mm_party_chat_list()) = 0, '2: alguien de afuera no lee nada';
  begin
    perform t90_como('b');
    perform mm_party_chat_send(repeat('x', 301));
    raise exception '2: aceptó 301 caracteres';
  exception when raise_exception then
    if sqlerrm not like 'El mensaje va de 1 a 300%' then raise; end if;
  end;
  raise notice 'ok 2: escribir y leer';
end $$;

-- ===== 3. RLS: la tabla solo la ven los del grupo =====
set local role authenticated;
select t90_como('b');
do $$ begin assert (select count(*) from mm_party_chat) = 1, '3: b ve el mensaje'; end $$;
select t90_como('c');
do $$ begin assert (select count(*) from mm_party_chat) = 0, '3: c no ve nada'; end $$;
reset role;
do $$ begin raise notice 'ok 3: RLS del chat del grupo'; end $$;

-- ===== 4. Escribir muy rápido =====
do $$
declare i int;
begin
  perform t90_como('b');
  for i in 1 .. 10 loop perform mm_party_chat_send('msg ' || i); end loop;
  begin
    perform mm_party_chat_send('uno más');
    raise exception '4: dejó escribir 11 mensajes en 10 segundos';
  exception when raise_exception then
    if sqlerrm not like 'Estás escribiendo muy rápido%' then raise; end if;
  end;
  raise notice 'ok 4: hasta 10 mensajes cada 10 segundos';
end $$;

-- ===== 5. Denunciar desde el chat =====
do $$
declare msg bigint := (select n from t90_ids where k = 'msg');
begin
  perform t90_como('a');
  begin
    perform mm_report_from_chat(msg, 'toxic', null);
    raise exception '5: se denunció a sí mismo';
  exception when raise_exception then
    if sqlerrm not like 'No te podés denunciar%' then raise; end if;
  end;
  perform t90_como('c');
  begin
    perform mm_report_from_chat(msg, 'toxic', null);
    raise exception '5: denunció alguien de afuera';
  exception when raise_exception then
    if sqlerrm not like 'Ese mensaje no está en el chat de tu grupo%' then raise; end if;
  end;
  perform t90_como('b');
  perform mm_report_from_chat(msg, 'toxic', 'me insultó');
  assert exists (select 1 from mm_reports where reporter_id = t90u('b') and reported_id = t90u('a') and lobby_id is null
                  and message = '¿buscamos de nuevo?' and note = 'me insultó'), '5: la denuncia guarda el mensaje';
  begin
    perform mm_report_from_chat(msg, 'other', null);
    raise exception '5: denunció dos veces el mismo día';
  exception when raise_exception then
    if sqlerrm not like 'Ya denunciaste%' then raise; end if;
  end;
  perform t90_como('adm');
  assert exists (select 1 from jsonb_array_elements(mm_admin_lists('reports')) r
                  where r->>'message' = '¿buscamos de nuevo?' and r->'lobby_id' = 'null'::jsonb), '5: el admin la ve con el mensaje';
  raise notice 'ok 5: denunciar desde el chat del grupo';
end $$;

-- ===== 6. El grupo se deshace: el chat se borra; la denuncia queda =====
do $$
begin
  delete from mm_parties where id = (select id from t90_ids where k = 'party');
  assert not exists (select 1 from mm_party_chat where user_id in (t90u('a'), t90u('b'))), '6: el chat se borró con el grupo';
  assert exists (select 1 from mm_reports where reporter_id = t90u('b') and message is not null), '6: la denuncia sigue';
  raise notice 'ok 6: el chat se va con el grupo';
end $$;

drop function public.t90u(text), public.t90_como(text);
drop table public.t90;
