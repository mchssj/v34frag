-- Pruebas del replanteo 87. Las arma probar_87.sh: van entre el replanteo y su inversa, dentro de una transacción que
-- se deshace al final (no dejan nada en la base).

create table public.t87 (k text primary key, u uuid, p uuid);
grant select on public.t87 to anon, authenticated;
create function public.t87u(k text) returns uuid language sql stable as $$ select u from public.t87 where t87.k = $1 $$;
create function public.t87p(k text) returns uuid language sql stable as $$ select p from public.t87 where t87.k = $1 $$;
create function public.t87_como(k text) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', public.t87u(k), 'role', 'authenticated')::text, true) $$;
grant execute on function public.t87u(text), public.t87p(text), public.t87_como(text) to anon, authenticated;

do $$
declare k text; v uuid; pl uuid;
begin
  foreach k in array array['admin', 'adminsinficha', 'mod', 'vip', 'vipmod', 'vipadmin', 'user'] loop
    v := gen_random_uuid();
    insert into auth.users (id, email, email_confirmed_at, created_at, aud, role)
      values (v, k || '-' || substr(v::text, 1, 6) || '@prueba87.local', now(), now(), 'authenticated', 'authenticated');
    update profiles set role = case when k like 'admin%' or k = 'vipadmin' then 'admin' when k in ('mod', 'vipmod') then 'moderator' else 'user' end
     where id = v;
    pl := null;
    if k <> 'adminsinficha' then insert into players (nick, user_id) values ('t87' || k || substr(v::text, 1, 4), v) returning id into pl; end if;
    insert into t87 values (k, v, pl);
  end loop;
  insert into vip_memberships (user_id, source, starts_at) values
    (t87u('vip'), 'manual', now() - interval '2 days'), (t87u('vipmod'), 'manual', now() - interval '5 days'),
    (t87u('vipadmin'), 'manual', now() - interval '9 days');
  raise notice 'ok: datos de prueba';
end $$;

select t87_como('user'); set local role authenticated;
do $$
declare j jsonb := staff_public();
  ids text[];
begin
  ids := array(select x->>'player_id' from jsonb_array_elements(j->'admins') x);
  assert t87p('admin')::text = any(ids) and t87p('vipadmin')::text = any(ids), 'los admins con ficha';
  assert not exists (select 1 from jsonb_array_elements(j->'admins') x where x->>'nick' like 't87adminsinficha%'), 'sin ficha no sale';
  ids := array(select x->>'player_id' from jsonb_array_elements(j->'moderators') x);
  assert t87p('mod')::text = any(ids) and t87p('vipmod')::text = any(ids), 'los moderadores';
  ids := array(select x->>'player_id' from jsonb_array_elements(j->'vips') x);
  assert t87p('vip')::text = any(ids) and t87p('vipmod')::text = any(ids), 'los VIP';
  assert not (t87p('vipadmin')::text = any(ids)), 'sin los admins';
  assert array_position(ids, t87p('vipmod')::text) < array_position(ids, t87p('vip')::text), 'por antigüedad';
  assert not (vip_list_me()->>'vip')::boolean, 'un jugador no es VIP';
  raise notice 'ok: admins, moderadores y VIP';
end $$;
reset role;

select t87_como('vip'); set local role authenticated;
do $$
begin
  assert (vip_list_me()->>'vip')::boolean and not (vip_list_me()->>'hidden')::boolean, 'VIP y a la vista';
  perform vip_list_hidden_set(true);
  assert (vip_list_me()->>'hidden')::boolean, 'oculto';
  assert not exists (select 1 from jsonb_array_elements(staff_public()->'vips') x where x->>'player_id' = t87p('vip')::text),
    'ya no sale en la lista';
  perform vip_list_hidden_set(false);
  assert exists (select 1 from jsonb_array_elements(staff_public()->'vips') x where x->>'player_id' = t87p('vip')::text), 'vuelve';
  raise notice 'ok: ocultarse de la lista';
end $$;
reset role;

set local role anon;
do $$
begin
  perform staff_public();
  raise exception 'FALLA: sin sesión';
exception when insufficient_privilege then raise notice 'ok: sin sesión, no';
end $$;
reset role;

do $$ begin raise notice 'ok: todas las pruebas del replanteo 87'; end $$;
delete from vip_memberships where user_id in (select u from t87);
drop function public.t87_como(text);
drop function public.t87u(text);
drop function public.t87p(text);
drop table public.t87;
