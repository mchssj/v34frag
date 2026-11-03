-- Pruebas del replanteo 57 (aviso de la cola en Discord). Se corren con correr_local.sh, dentro de una transacción que se
-- deshace al final: no dejan nada en la base.

create or replace function pg_temp.como(u uuid) returns void language sql as $$
  select set_config('request.jwt.claims', case when u is null then '' else json_build_object('sub', u, 'role', 'authenticated')::text end, true) $$;
create or replace function pg_temp.esperar_error(q text, quiero text) returns void language plpgsql as $$
begin
  execute q;
  raise exception 'FALLA: se esperaba el error "%" y no hubo error en: %', quiero, q;
exception when others then
  if sqlerrm not like '%' || quiero || '%' and sqlstate <> quiero then
    raise exception 'FALLA: se esperaba "%" y salió "%" (%) en: %', quiero, sqlerrm, sqlstate, q;
  end if;
end $$;

do $$
declare
  u_a uuid := gen_random_uuid();
  u_b uuid := gen_random_uuid();
  u_mod uuid := gen_random_uuid();
  p_a uuid; p_b uuid;
  r jsonb;
  ok int := 0;
begin
  delete from mm_queue_pings;
  insert into auth.users (id, email, email_confirmed_at, created_at, aud, role)
    select x, x || '@prueba.local', now(), now() - interval '30 days', 'authenticated', 'authenticated' from unnest(array[u_a, u_b, u_mod]) x;
  update profiles set tag = 'avisaA' || substr(md5(random()::text), 1, 4) where id = u_a;
  update profiles set role = 'moderator' where id = u_mod;
  insert into players (nick, user_id) values ('pa' || substr(md5(random()::text), 1, 8), u_a) returning id into p_a;
  insert into players (nick, user_id) values ('pb' || substr(md5(random()::text), 1, 8), u_b) returning id into p_b;

  -- 1. Fuera de la cola no se puede.
  perform pg_temp.como(u_a);
  if (mm_queue_ping_status()->>'can_ping')::boolean then raise exception 'FALLA 1a: fuera de la cola figura que puede'; end if;
  perform pg_temp.esperar_error('select mm_queue_ping()', 'Tenés que estar buscando partida');
  ok := ok + 2;

  -- 2. En la cola sí; queda el aviso con el modo, el alias y cuántos buscan.
  insert into mm_queue (user_id, player_id, mode, elo, joined_at) values (u_a, p_a, '5v5', 1000, now()), (u_b, p_b, '5v5', 1000, now());
  if not (mm_queue_ping_status()->>'can_ping')::boolean then raise exception 'FALLA 2a: en la cola no puede'; end if;
  r := mm_queue_ping();
  if r->>'mode' <> '5v5' or (r->'queue'->>'5v5')::int <> 2 or r->>'alias' not like 'avisaA%' or (r->>'staff')::boolean then
    raise exception 'FALLA 2b: %', r;
  end if;
  ok := ok + 2;

  -- 3. Otro de la cola dentro de los 15 minutos: no (V5701, con la hora).
  perform pg_temp.como(u_b);
  if (mm_queue_ping_status()->>'can_ping')::boolean or mm_queue_ping_status()->>'next_at' is null then raise exception 'FALLA 3a: el estado no muestra la espera'; end if;
  perform pg_temp.esperar_error('select mm_queue_ping()', 'V5701');
  ok := ok + 2;

  -- 4. El staff puede siempre, aunque no esté en la cola.
  perform pg_temp.como(u_mod);
  if not (mm_queue_ping_status()->>'can_ping')::boolean then raise exception 'FALLA 4a: el moderador no puede'; end if;
  r := mm_queue_ping();
  if not (r->>'staff')::boolean or r->>'mode' is not null then raise exception 'FALLA 4b: %', r; end if;
  ok := ok + 2;

  -- 5. Cancelar: solo el propio; después del aviso del staff, con los dos borrados, se vuelve a poder.
  perform pg_temp.como(u_b);
  perform mm_queue_ping_cancel((r->>'id')::uuid);
  if not exists (select 1 from mm_queue_pings where id = (r->>'id')::uuid) then raise exception 'FALLA 5a: borró el aviso de otro'; end if;
  perform pg_temp.como(u_mod);
  perform mm_queue_ping_cancel((r->>'id')::uuid);
  if exists (select 1 from mm_queue_pings where id = (r->>'id')::uuid) then raise exception 'FALLA 5b: no borró el propio'; end if;
  update mm_queue_pings set created_at = now() - interval '16 minutes';
  perform pg_temp.como(u_b);
  if not (mm_queue_ping_status()->>'can_ping')::boolean then raise exception 'FALLA 5c: pasados los 15 minutos no puede'; end if;
  ok := ok + 3;

  -- 6. Sin sesión, nada.
  perform pg_temp.como(null);
  perform pg_temp.esperar_error('select mm_queue_ping()', '42501');
  ok := ok + 1;

  raise notice 'OK: % comprobaciones del replanteo 57', ok;
end $$;
