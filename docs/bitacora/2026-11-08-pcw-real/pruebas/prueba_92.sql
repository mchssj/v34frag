-- Pruebas del replanteo 92. Las arma probar_92.sh: van entre el replanteo y su inversa, dentro de una transacción que
-- se deshace al final (no dejan nada en la base). Cada bloque corre como el usuario que dice (t89_como).

create table public.t89 (k text primary key, u uuid, p uuid);
grant select on public.t89 to anon, authenticated;
create function public.t89u(k text) returns uuid language sql stable as $$ select u from public.t89 where t89.k = $1 $$;
create function public.t89p(k text) returns uuid language sql stable as $$ select p from public.t89 where t89.k = $1 $$;
create function public.t89_como(k text) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', public.t89u(k), 'role', 'authenticated')::text, true) $$;
create function public.t89_roster(k text) returns uuid[] language sql stable as $$
  select array[public.t89p(k), public.t89p(k || '2'), public.t89p(k || '3'), public.t89p(k || '4')] $$;
grant execute on function public.t89u(text), public.t89p(text), public.t89_como(text), public.t89_roster(text) to anon, authenticated;
create temp table t89_ids (k text primary key, id uuid);

do $$
declare k text; v uuid; pl uuid;
begin
  foreach k in array array['a', 'a2', 'a3', 'a4', 'b', 'b2', 'b3', 'b4', 'c', 'c2', 'c3', 'c4', 'n', 'n2', 'n3', 'n4'] loop
    v := gen_random_uuid();
    insert into auth.users (id, email, email_confirmed_at, created_at, aud, role)
      values (v, k || '-' || substr(v::text, 1, 6) || '@prueba89.local', now(), now(), 'authenticated', 'authenticated');
    insert into players (nick, user_id) values ('t89' || k || substr(v::text, 1, 4), v) returning id into pl;
    insert into t89 values (k, v, pl);
  end loop;
  insert into vip_memberships (user_id, source) values (t89u('a'), 'manual');
  raise notice 'ok: datos de prueba';
end $$;

-- ===== 1. Sin VIP no se publica =====
do $$
begin
  perform t89_como('n');
  begin
    perform create_pcw_post('', 3, '', null, '', t89_roster('n'), '{}', null, null);
    raise exception '1: publicó sin VIP';
  exception when sqlstate 'V8901' then null;
  end;
  raise notice 'ok 1: publicar una PCW pide VIP';
end $$;

-- ===== 2. Con VIP se publica, con tres mapas fijos en un orden propio =====
do $$
declare pid uuid;
begin
  perform t89_como('a');
  pid := create_pcw_post('Equipo A', 3, '', now() + interval '2 hours', 'nota', t89_roster('a'), '{}', null,
                         array['de_tuscan', 'de_cache', 'de_inferno']);
  insert into t89_ids values ('post', pid);
  raise notice 'ok 2: el VIP publica';
end $$;

-- ===== 3. Ofertas: la propia no, una por anuncio, con su aviso =====
do $$
declare pid uuid := (select id from t89_ids where k = 'post'); o uuid;
begin
  perform t89_como('a');
  begin
    perform pcw_offer_send(pid, '', t89_roster('n'), '{}', null, null);
    raise exception '3: ofertó a su propio anuncio';
  exception when raise_exception then
    if sqlerrm not like 'No podés mandarle una oferta%' then raise; end if;
  end;
  perform t89_como('b');
  o := pcw_offer_send(pid, 'Equipo B', t89_roster('b'), '{}', null, now() + interval '3 hours');
  insert into t89_ids values ('ob', o);
  begin
    perform pcw_offer_send(pid, 'Otra', t89_roster('n'), '{}', null, null);
    raise exception '3: mandó dos ofertas al mismo anuncio';
  exception when raise_exception then
    if sqlerrm not like 'Ya le mandaste%' then raise; end if;
  end;
  assert exists (select 1 from notifications where user_id = t89u('a') and type = 'pcw_offer' and ref = 'pcw_offer:' || o),
    '3: al que publicó le llega pcw_offer';
  assert (select category from notifications where ref = 'pcw_offer:' || o) = 'pcw', '3: el aviso es de la categoría pcw';
  raise notice 'ok 3: mandar una oferta';
end $$;

-- ===== 4. Nadie en los dos rosters =====
do $$
declare pid uuid := (select id from t89_ids where k = 'post');
begin
  perform t89_como('n');
  begin
    perform pcw_offer_send(pid, '', array[t89p('n'), t89p('n2'), t89p('n3'), t89p('a2')], '{}', null, null);
    raise exception '4: aceptó un jugador en los dos rosters';
  exception when raise_exception then
    if sqlerrm not like 'Hay jugadores que están en los dos rosters%' then raise; end if;
  end;
  raise notice 'ok 4: nadie juega para los dos';
end $$;

-- ===== 5. Retirar y volver a mandar =====
do $$
declare pid uuid := (select id from t89_ids where k = 'post'); o uuid;
begin
  perform t89_como('c');
  o := pcw_offer_send(pid, 'Equipo C', t89_roster('c'), '{}', null, null);
  perform pcw_offer_withdraw(o);
  assert (select status from pcw_offers where id = o) = 'withdrawn', '5: la oferta quedó retirada';
  o := pcw_offer_send(pid, 'Equipo C', t89_roster('c'), '{}', null, null);
  insert into t89_ids values ('oc', o);
  perform t89_como('b');
  begin
    perform pcw_offer_withdraw(o);
    raise exception '5: retiró una oferta ajena';
  exception when raise_exception then
    if sqlerrm not like 'Esa oferta no es tuya%' then raise; end if;
  end;
  raise notice 'ok 5: retirar y volver a mandar';
end $$;

-- ===== 6. pcw_cleanup no borra los bandos con una oferta abierta =====
do $$
begin
  perform pcw_cleanup();
  assert (select count(*) from pcw_offers o join teams t on t.id = o.team_id
           where o.id in (select id from t89_ids where k in ('ob', 'oc'))) = 2, '6: los bandos de las ofertas siguen';
  raise notice 'ok 6: la limpieza respeta las ofertas abiertas';
end $$;

-- ===== 7. Solo el que publicó elige; al elegir se crea la partida y las demás quedan rechazadas =====
do $$
declare ob uuid := (select id from t89_ids where k = 'ob'); oc uuid := (select id from t89_ids where k = 'oc'); mid uuid;
        o pcw_offers%rowtype;
begin
  perform t89_como('b');
  begin
    perform pcw_offer_choose(ob);
    raise exception '7: eligió alguien que no publicó';
  exception when raise_exception then
    if sqlerrm not like 'Solo el que publicó%' then raise; end if;
  end;
  perform t89_como('a');
  mid := pcw_offer_choose(ob);
  insert into t89_ids values ('match', mid);
  select * into o from pcw_offers where id = ob;
  assert o.status = 'chosen', '7: la elegida queda chosen';
  assert (select status from pcw_offers where id = oc) = 'rejected', '7: la otra queda rejected';
  assert (select status from pcw_posts where id = o.post_id) = 'matched', '7: el anuncio queda matched';
  assert (select team2 from matches where id = mid) = o.team_id, '7: el bando de la oferta es el equipo 2';
  assert (select starts_at from matches where id = mid) = o.starts_at, '7: la partida toma la hora que propuso la oferta';
  assert exists (select 1 from notifications where user_id = t89u('b') and type = 'pcw_offer_chosen'), '7: al elegido le llega pcw_offer_chosen';
  assert exists (select 1 from notifications where user_id = t89u('b2') and type = 'pcw_offer_chosen'), '7: también a su roster';
  assert exists (select 1 from notifications where user_id = t89u('c') and type = 'pcw_offer_rejected'), '7: al rechazado le llega pcw_offer_rejected';
  assert (select resolution from notifications where ref = 'pcw_offer:' || ob) = 'accepted', '7: el aviso de la oferta queda resuelto';
  begin
    perform pcw_offer_choose(oc);
    raise exception '7: eligió dos veces';
  exception when raise_exception then
    if sqlerrm not like 'Este anuncio ya no está disponible%' then raise; end if;
  end;
  raise notice 'ok 7: elegir una oferta';
end $$;

-- ===== 8. Mapas fijos: sin veto y en el orden elegido =====
do $$
declare mid uuid := (select id from t89_ids where k = 'match');
begin
  assert veto_sequence(3, 3) = '{}', '8: BO3 con 3 mapas no tiene veto';
  assert veto_sequence(1, 1) = '{}', '8: BO1 con 1 mapa no tiene veto';
  assert veto_sequence(3, 7) = array['ban', 'ban', 'pick', 'pick', 'ban', 'ban'], '8: BO3 con 7 mapas sigue igual';
  assert veto_sequence(1, 7) = array['ban', 'ban', 'ban', 'ban', 'ban', 'ban'], '8: BO1 con 7 mapas sigue igual';
  assert match_veto_done(mid), '8: el veto de la PCW con mapas fijos ya está hecho';
  assert (select array_agg(name) from match_map_pool(mid)) = array['de_tuscan', 'de_cache', 'de_inferno'],
    '8: el pool va en el orden elegido';
  assert match_series_maps(mid) = array['de_tuscan', 'de_cache', 'de_inferno'], '8: se juegan los tres en ese orden';
  raise notice 'ok 8: mapas fijos';
end $$;

-- ===== 9. RLS: cada uno ve sus ofertas; el que publicó, las de su anuncio =====
set local role authenticated;
select t89_como('c');
do $$ begin
  assert (select count(*) from pcw_offers) = 1, '9: c ve la suya rechazada (la retirada se fue con su bando en la limpieza)';
end $$;
select t89_como('a');
do $$ begin
  assert (select count(*) from pcw_offers) = 2, '9: a ve las dos ofertas que quedan de su anuncio';
end $$;
select t89_como('b');
do $$ begin
  assert (select count(*) from pcw_offers) = 1, '9: b ve solo la suya';
end $$;
select t89_como('n2');
do $$ begin
  assert (select count(*) from pcw_offers) = 0, '9: un tercero no ve ofertas';
end $$;
reset role;
do $$ begin raise notice 'ok 9: RLS de pcw_offers'; end $$;

-- ===== 10. Cancelar un anuncio rechaza sus ofertas; accept_pcw ya no existe =====
do $$
declare pid uuid; o uuid;
begin
  perform t89_como('a');
  pid := create_pcw_post('Equipo A', 1, '', null, '', t89_roster('a'), '{}', null, null);
  perform t89_como('n');
  o := pcw_offer_send(pid, 'Equipo N', t89_roster('n'), '{}', null, null);
  perform t89_como('a');
  perform cancel_pcw_post(pid);
  assert not exists (select 1 from pcw_offers where id = o), '10: la oferta de un anuncio cancelado se borra con el anuncio';
  assert exists (select 1 from notifications where user_id = t89u('n') and type = 'pcw_offer_rejected' and data->>'reason' = 'cancelled'),
    '10: al que ofertó le llega pcw_offer_rejected (cancelado)';
  assert to_regprocedure('public.accept_pcw(uuid, text, uuid[], text[], uuid)') is null, '10: accept_pcw ya no existe';
  -- La limpieza (al publicar) se lleva los bandos de las ofertas cerradas, y con ellos las ofertas.
  assert (select count(*) from pcw_offers o where o.by_user = t89u('c')) = 0, '10: las ofertas cerradas se van con su bando';
  raise notice 'ok 10: anuncio cancelado y sin aceptar directo';
end $$;


-- ===== 11. pcw_my_context: VIP, ficha y amigos =====
do $$
declare x jsonb;
begin
  insert into mm_friends (user_id, player_id) values (t89u('a'), t89p('b'));
  perform t89_como('a');
  x := pcw_my_context();
  assert (x->>'vip')::boolean, '11: a es VIP';
  assert x->'me'->>'player_id' = t89p('a')::text, '11: la ficha de a';
  assert x->'team' = 'null'::jsonb, '11: a no es capitán de un equipo oficial';
  assert jsonb_array_length(x->'friends') = 1 and x->'friends'->0->>'player_id' = t89p('b')::text, '11: sus amigos';
  perform t89_como('n');
  assert not (pcw_my_context()->>'vip')::boolean, '11: n no es VIP';
  raise notice 'ok 11: pcw_my_context';
end $$;

-- ===== 12. Servidores libres: los de PCW, cualquiera con sesión; los de torneo, no =====
do $$
begin
  perform t89_como('n');
  perform servers_free('pcw');
  begin
    perform servers_free('official');
    raise exception '12: un jugador vio los servidores de torneo';
  exception when insufficient_privilege then null;
  end;
  raise notice 'ok 12: servidores libres para PCW';
end $$;

drop function public.t89u(text), public.t89p(text), public.t89_como(text), public.t89_roster(text);
drop table public.t89;
