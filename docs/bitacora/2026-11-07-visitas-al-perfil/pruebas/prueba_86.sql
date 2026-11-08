-- Pruebas del replanteo 86. Las arma probar_86.sh: van entre el replanteo y su inversa, dentro de una transacción que
-- se deshace al final (no dejan nada en la base).

create table public.t86 (k text primary key, u uuid, p uuid);
grant select on public.t86 to anon, authenticated;
create function public.t86u(k text) returns uuid language sql stable as $$ select u from public.t86 where t86.k = $1 $$;
create function public.t86p(k text) returns uuid language sql stable as $$ select p from public.t86 where t86.k = $1 $$;
create function public.t86_como(k text) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', public.t86u(k), 'role', 'authenticated')::text, true) $$;
grant execute on function public.t86u(text), public.t86p(text), public.t86_como(text) to anon, authenticated;

do $$
declare k text; v uuid; pl uuid;
begin
  -- dueño (sin VIP), dueño VIP, visitantes, un VIP que visita oculto y una cuenta sin ficha.
  foreach k in array array['dueno', 'duenovip', 'a', 'b', 'vip', 'sinficha'] || array(select 'x' || g from generate_series(1, 16) g) loop
    v := gen_random_uuid();
    insert into auth.users (id, email, email_confirmed_at, created_at, aud, role)
      values (v, k || '-' || substr(v::text, 1, 6) || '@prueba86.local', now(), now(), 'authenticated', 'authenticated');
    pl := null;
    if k <> 'sinficha' then insert into players (nick, user_id) values ('t86' || k || substr(v::text, 1, 4), v) returning id into pl; end if;
    insert into t86 values (k, v, pl);
  end loop;
  insert into vip_memberships (user_id, source) values (t86u('duenovip'), 'manual'), (t86u('vip'), 'manual');
  insert into players (nick) values ('t86ficha' || substr(gen_random_uuid()::text, 1, 4)) returning id into pl;
  insert into t86 values ('ficha', null, pl);
  raise notice 'ok: datos de prueba';
end $$;

-- ===== 1. Se cuenta una por persona y por día; las propias no =====
select t86_como('a'); set local role authenticated;
select profile_visit(t86p('dueno')); select profile_visit(t86p('dueno')); select profile_visit(t86p('duenovip'));
select profile_visit(t86p('ficha'));
reset role;
select t86_como('b'); set local role authenticated;
select profile_visit(t86p('dueno')); select profile_visit(t86p('duenovip'));
reset role;
select t86_como('sinficha'); set local role authenticated;
select profile_visit(t86p('dueno'));
reset role;
select t86_como('dueno'); set local role authenticated;
select profile_visit(t86p('dueno'));
do $$
declare j jsonb := my_profile_visits();
begin
  assert (j->>'total')::int = 2 and (j->>'week')::int = 2, 'dos visitantes (a y b): ni repetidas, ni la propia, ni sin ficha';
  -- ===== 2. Sin VIP: el número, nada de quiénes =====
  assert not (j->>'vip')::boolean and j->'items' = 'null'::jsonb and j->'incognito' = 'null'::jsonb, 'sin VIP no sale quiénes';
  begin
    perform profile_incognito_set(true);
    raise exception 'FALLA: prendió el modo oculto sin VIP';
  exception when insufficient_privilege then null;
  end;
  raise notice 'ok: cuenta personas por día; sin VIP solo el número';
end $$;
reset role;
do $$ begin assert not exists (select 1 from profile_visits where player_id = t86p('ficha')), 'las fichas sin cuenta no guardan visitas'; end $$;

-- ===== 3. Con VIP: quiénes son =====
select t86_como('duenovip'); set local role authenticated;
do $$
declare j jsonb := my_profile_visits();
begin
  assert (j->>'vip')::boolean and jsonb_array_length(j->'items') = 2, 'el VIP ve a los dos';
  assert j->'items'->0->>'player_id' = t86p('b')::text, 'el más reciente primero';
  assert (j->'incognito'->>'limit')::int = 15 and not (j->'incognito'->>'enabled')::boolean, 'el modo oculto, apagado';
  raise notice 'ok: con VIP, quiénes';
end $$;
reset role;

-- ===== 4. Navegar sin dejar rastro: 15 perfiles por semana; el 16 se ve =====
select t86_como('vip'); set local role authenticated;
select profile_incognito_set(true);
do $$
declare i int; j jsonb;
begin
  for i in 1 .. 15 loop perform profile_visit(t86p('x' || i)); end loop;
  perform profile_visit(t86p('x1'));   -- volver a uno oculto no gasta otro
  perform profile_visit(t86p('x16'));
  j := my_profile_visits();
  assert (j->'incognito'->>'used')::int = 15 and (j->'incognito'->>'enabled')::boolean, 'usó los 15';
  raise notice 'ok: cupo de 15';
end $$;
reset role;
do $$
begin
  assert (select count(*) from profile_visits where visitor = t86u('vip') and hidden) = 15, '15 ocultas';
  assert not (select hidden from profile_visits where visitor = t86u('vip') and player_id = t86p('x16')), 'la 16 se ve';
end $$;
select t86_como('x1'); set local role authenticated;
do $$ begin assert (my_profile_visits()->>'total')::int = 0, 'la oculta no suma'; end $$;
reset role;
select t86_como('x16'); set local role authenticated;
do $$ begin assert (my_profile_visits()->>'total')::int = 1, 'la 16 sí suma'; raise notice 'ok: las ocultas no se ven ni suman'; end $$;
reset role;

-- ===== 5. Sin VIP, el interruptor no vale =====
update vip_memberships set revoked_at = now(), revoked_by = null where user_id = t86u('vip');
select t86_como('vip'); set local role authenticated;
select profile_visit(t86p('b'));
reset role;
do $$
begin
  assert not (select hidden from profile_visits where visitor = t86u('vip') and player_id = t86p('b')), 'VIP vencido: a la vista';
  raise notice 'ok: sin VIP se visita a la vista';
end $$;

-- ===== 6. Se guardan 30 días =====
update profile_visits set day = bogota_today() - 40 where player_id = t86p('dueno') and visitor = t86u('a');
select t86_como('b'); set local role authenticated;
select profile_visit(t86p('dueno'));
reset role;
do $$
begin
  assert not exists (select 1 from profile_visits where player_id = t86p('dueno') and visitor = t86u('a')), 'lo de más de 30 días se borra';
  raise notice 'ok: 30 días';
end $$;

do $$ begin raise notice 'ok: todas las pruebas del replanteo 86'; end $$;
delete from vip_memberships where user_id in (select u from t86 where u is not null);
drop function public.t86_como(text);
drop function public.t86u(text);
drop function public.t86p(text);
drop table public.t86;
