-- 92: ofertas de PCW, publicar solo con VIP y mapas fijos sin veto (bitácora docs/bitacora/2026-11-08-pcw-real,
-- Daniel 2026-11-08, sobre el prototipo de Kyan en docs/bitacora/2026-11-08-pcw-demo).
--
--   1. pcw_offers: una oferta a un anuncio abierto (el bando se arma al ofertar, como antes al aceptar). El que publicó
--      elige una (pcw_offer_choose crea la partida) y las demás quedan rechazadas. Una oferta puede proponer otra hora.
--      pcw_offer_send, pcw_offer_withdraw y pcw_offer_choose. Se borra accept_pcw: nadie se queda un anuncio sin que lo
--      elijan.
--   2. Al cerrarse un anuncio (elegido, cancelado o borrado) sus ofertas abiertas quedan rechazadas. pcw_cleanup no
--      borra los bandos con una oferta abierta.
--   3. create_pcw_post: publicar es para cuentas VIP (o admins). Error 'vip_required' (errcode V8901).
--   4. Mapas fijos: si el pool tiene tantos mapas como el formato (o menos), no hay veto y se juegan en el orden elegido
--      (veto_sequence, match_map_pool y match_series_maps).
--   5. Avisos pcw_offer (al que publicó), pcw_offer_chosen y pcw_offer_rejected (al que ofertó), categoría pcw.
--   6. pcw_my_context(): lo mío para la página de PCW (VIP, ficha, equipo con su plantel y sanción, amigos).
--   7. servers_free('pcw'): los servidores libres para PCW los ve cualquiera con sesión (antes, solo organizadores).
-- No es del matchmaking. Inversa: docs/bitacora/2026-10-14-replanteo-modelo-datos/reversas/92_pcw_ofertas.sql.
begin;

do $$
begin
  if to_regprocedure('public.create_pcw_post(text, integer, text, timestamp with time zone, text, uuid[], text[], uuid, text[])') is null then
    raise exception 'replanteo 92: falta la 30 (create_pcw_post con map_pool)';
  end if;
  if to_regclass('public.match_bookings') is null then raise exception 'replanteo 92: falta la 56 (match_bookings)'; end if;
  if to_regclass('public.pcw_offers') is not null then raise exception 'replanteo 92: ya se aplicó (pcw_offers existe)'; end if;
end $$;

create or replace function pg_temp.reemplazar(fn regprocedure, cambios text[][]) returns void language plpgsql as $$
declare d text := pg_get_functiondef(fn); i int;
begin
  for i in 1 .. array_length(cambios, 1) loop
    if position(cambios[i][1] in d) = 0 then
      raise exception 'replanteo 92: en % no se encontró: %', fn, left(cambios[i][1], 80);
    end if;
    d := replace(d, cambios[i][1], cambios[i][2]);
  end loop;
  execute d;
end $$;

-- Las funciones que cambian, como estaban: la inversa las vuelve a crear desde acá.
create table public.replanteo92_funciones as
select p.oid::regprocedure::text as fn, pg_get_functiondef(p.oid) as def,
       array(select r.rolname from aclexplode(p.proacl) a join pg_roles r on r.oid = a.grantee where a.privilege_type = 'EXECUTE') as exec_roles
  from pg_proc p
 where p.oid in ('public.accept_pcw(uuid, text, uuid[], text[], uuid)'::regprocedure, 'public.pcw_cleanup()'::regprocedure,
                 'public.create_pcw_post(text, integer, text, timestamp with time zone, text, uuid[], text[], uuid, text[])'::regprocedure,
                 'public.veto_sequence(integer, integer)'::regprocedure, 'public.match_map_pool(uuid)'::regprocedure,
                 'public.match_series_maps(uuid)'::regprocedure, 'public.notification_category(text)'::regprocedure,
                 'public.servers_free(text)'::regprocedure);
comment on table public.replanteo92_funciones is 'Respaldo del replanteo 92 para su inversa; se puede borrar cuando ya no se vaya a volver atrás';
alter table public.replanteo92_funciones enable row level security;
revoke all on public.replanteo92_funciones from anon, authenticated;

-- ---------- 1. Ofertas ----------

create table public.pcw_offers (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.pcw_posts(id) on delete cascade,
  team_id uuid not null references public.teams(id) on delete cascade,
  by_user uuid not null references auth.users(id) on delete cascade,
  starts_at timestamptz,
  status text not null default 'open' check (status in ('open', 'chosen', 'rejected', 'withdrawn')),
  created_at timestamptz not null default now(),
  closed_at timestamptz
);
comment on table public.pcw_offers is 'Ofertas a un anuncio de PCW: el que publicó elige una (replanteo 92)';
comment on column public.pcw_offers.team_id is 'Bando que ofrece jugar (teams.kind = pcw, armado con pcw_make_side)';
comment on column public.pcw_offers.starts_at is 'Otra hora que propone; null = la del anuncio';
create unique index pcw_offers_una_abierta on public.pcw_offers (post_id, by_user) where status = 'open';
create index pcw_offers_post on public.pcw_offers (post_id, status);
create index pcw_offers_user on public.pcw_offers (by_user, status);

alter table public.pcw_offers enable row level security;
create policy "pcw_offers: el que publicó y el que ofertó" on public.pcw_offers for select to authenticated
  using (by_user = auth.uid() or is_admin()
         or exists (select 1 from pcw_posts p where p.id = post_id and p.by_user = auth.uid()));
grant select on public.pcw_offers to authenticated;

/** Mandar una oferta a un anuncio abierto. Devuelve el id de la oferta. */
create function public.pcw_offer_send(p_post uuid, p_name text, p_players uuid[], p_guests text[], p_team uuid default null,
                                      p_starts_at timestamptz default null) returns uuid
  language plpgsql security definer set search_path = public as $$
declare po pcw_posts%rowtype; tid uuid; oid uuid;
begin
  if auth.uid() is null then raise exception 'Tenés que iniciar sesión'; end if;
  perform pcw_cleanup();
  select * into po from pcw_posts where id = p_post for update;
  if not found or po.status <> 'open' then raise exception 'Este anuncio ya no está disponible'; end if;
  if po.by_user = auth.uid() then raise exception 'No podés mandarle una oferta a tu propio anuncio'; end if;
  if exists (select 1 from pcw_offers where post_id = p_post and by_user = auth.uid() and status = 'open') then
    raise exception 'Ya le mandaste una oferta a este anuncio';
  end if;
  if (select count(*) from pcw_offers where by_user = auth.uid() and created_at > now() - interval '1 day') >= 20 then
    raise exception 'Alcanzaste el límite de ofertas por día';
  end if;
  if p_starts_at is not null and p_starts_at < now() - interval '5 minutes' then
    raise exception 'La hora que proponés ya pasó';
  end if;
  tid := pcw_make_side(p_name, p_players, p_guests);
  perform pcw_side_team(tid, p_team);
  perform pcw_ban_check(tid);
  if exists (select 1 from team_members a join team_members b on b.player_id = a.player_id
              where a.team_id = po.team_id and b.team_id = tid and a.left_at is null and b.left_at is null) then
    raise exception 'Hay jugadores que están en los dos rosters';
  end if;
  if exists (select 1 from teams a, teams b, unnest(a.guests) x, unnest(b.guests) y
             where a.id = po.team_id and b.id = tid and lower(x) = lower(y)) then
    raise exception 'Hay tags repetidos entre los dos rosters';
  end if;
  insert into pcw_offers (post_id, team_id, by_user, starts_at) values (p_post, tid, auth.uid(), p_starts_at)
  returning id into oid;
  perform notify(array[po.by_user], 'pcw_offer',
    jsonb_build_object('post_id', p_post, 'offer_id', oid, 'team', team_ref(tid), 'starts_at', p_starts_at), 'pcw_offer:' || oid);
  return oid;
end $$;

/** Retirar mi oferta mientras siga abierta. */
create function public.pcw_offer_withdraw(p_offer uuid) returns void
  language plpgsql security definer set search_path = public as $$
declare o pcw_offers%rowtype;
begin
  select * into o from pcw_offers where id = p_offer for update;
  if not found or (o.by_user is distinct from auth.uid() and not is_admin()) then raise exception 'Esa oferta no es tuya'; end if;
  if o.status <> 'open' then raise exception 'Esa oferta ya no está abierta'; end if;
  update pcw_offers set status = 'withdrawn', closed_at = now() where id = p_offer;
  perform notifications_resolve('pcw_offer:' || p_offer, 'cancelled');
end $$;

/** El que publicó elige una oferta: se crea la partida y las demás quedan rechazadas. Devuelve el id de la partida. */
create function public.pcw_offer_choose(p_offer uuid) returns uuid
  language plpgsql security definer set search_path = public as $$
declare o pcw_offers%rowtype; po pcw_posts%rowtype; mid uuid;
begin
  if auth.uid() is null then raise exception 'Tenés que iniciar sesión'; end if;
  select * into o from pcw_offers where id = p_offer for update;
  if not found then raise exception 'Esa oferta no existe'; end if;
  select * into po from pcw_posts where id = o.post_id for update;
  if po.by_user is distinct from auth.uid() and not is_admin() then raise exception 'Solo el que publicó elige una oferta'; end if;
  if po.status <> 'open' then raise exception 'Este anuncio ya no está disponible'; end if;
  if o.status <> 'open' then raise exception 'Esa oferta ya no está abierta'; end if;
  insert into matches(team1, team2, status, starts_at, best_of, kind)
  values (po.team_id, o.team_id, 'upcoming', coalesce(o.starts_at, po.starts_at), po.best_of, 'pcw')
  returning id into mid;
  update pcw_offers set status = 'chosen', closed_at = now() where id = p_offer;
  -- Pasa el anuncio a 'matched': el trigger de abajo rechaza las demás y tg_notify_pcw_posts avisa a los de quien publicó.
  update pcw_posts set status = 'matched', match_id = mid where id = po.id;
  perform notifications_resolve('pcw_offer:' || p_offer, 'accepted');
  perform notify(array[o.by_user] || team_roster_users(o.team_id), 'pcw_offer_chosen',
    match_ref(mid) || jsonb_build_object('rival', team_ref(po.team_id)), null, true);
  return mid;
end $$;

revoke all on function public.pcw_offer_send(uuid, text, uuid[], text[], uuid, timestamptz), public.pcw_offer_withdraw(uuid),
  public.pcw_offer_choose(uuid) from public, anon;
grant execute on function public.pcw_offer_send(uuid, text, uuid[], text[], uuid, timestamptz), public.pcw_offer_withdraw(uuid),
  public.pcw_offer_choose(uuid) to authenticated;

-- Con ofertas, nadie acepta un anuncio directo.
drop function public.accept_pcw(uuid, text, uuid[], text[], uuid);

-- ---------- 2. Anuncio cerrado: las ofertas abiertas quedan rechazadas ----------

-- Al pasar de 'open' a otro estado (elegido) o al borrarse abierto (cancelado o vencido: cancel_pcw_post y pcw_cleanup
-- lo borran). En el borrado corre antes, para avisar antes de que las ofertas se vayan en cascada.
create function public.tg_pcw_posts_close_offers() returns trigger
  language plpgsql security definer set search_path = public as $$
declare o record; v_reason text;
begin
  if old.status <> 'open' then return case when tg_op = 'DELETE' then old else null end; end if;
  if tg_op = 'UPDATE' then
    if new.status = 'open' then return null; end if;
    v_reason := new.status;
  else
    v_reason := 'cancelled';
  end if;
  for o in update pcw_offers set status = 'rejected', closed_at = now()
            where post_id = old.id and status = 'open' returning id, by_user loop
    perform notifications_resolve('pcw_offer:' || o.id, 'rejected');
    perform notify(array[o.by_user], 'pcw_offer_rejected',
      jsonb_build_object('post_id', old.id, 'team', team_ref(old.team_id), 'reason', v_reason));
  end loop;
  return case when tg_op = 'DELETE' then old else null end;
end $$;
create trigger pcw_posts_close_offers after update of status on public.pcw_posts
  for each row execute function public.tg_pcw_posts_close_offers();
create trigger pcw_posts_close_offers_delete before delete on public.pcw_posts
  for each row execute function public.tg_pcw_posts_close_offers();
revoke all on function public.tg_pcw_posts_close_offers() from public, anon, authenticated;

-- Los bandos con una oferta abierta no se borran.
select pg_temp.reemplazar('public.pcw_cleanup()', array[
  array[$q$and not exists (select 1 from pcw_posts p where p.team_id = t.id and p.status = 'open');$q$,
        $q$and not exists (select 1 from pcw_posts p where p.team_id = t.id and p.status = 'open')
    and not exists (select 1 from pcw_offers o where o.team_id = t.id and o.status = 'open'); -- (replanteo 92)$q$]]);

-- ---------- 3. Publicar es para VIP ----------

select pg_temp.reemplazar('public.create_pcw_post(text, integer, text, timestamp with time zone, text, uuid[], text[], uuid, text[])', array[
  array[$q$if auth.uid() is null then raise exception 'Tenés que iniciar sesión'; end if;$q$,
        $q$if auth.uid() is null then raise exception 'Tenés que iniciar sesión'; end if;
  -- (replanteo 92) publicar es para VIP; mandar ofertas es para todos
  if not (coalesce(is_vip(auth.uid()), false) or is_admin()) then
    raise exception 'Publicar una PCW es para cuentas VIP' using errcode = 'V8901';
  end if;$q$]]);

-- ---------- 4. Mapas fijos ----------

-- Con tantos mapas como el formato (o menos) no hay veto.
create or replace function public.veto_sequence(p_bo int, p_maps int) returns text[]
  language plpgsql immutable as $$
declare a text[] := '{}';
begin
  if p_maps <= p_bo then return '{}'; end if; -- (replanteo 92) mapas fijos
  if p_bo >= 3 then a := a || array['ban', 'ban']; end if;
  if p_bo = 3 then a := a || array['pick', 'pick']; end if;
  if p_bo >= 5 then a := a || array['pick', 'pick', 'pick', 'pick']; end if;
  while cardinality(a) < p_maps - 1 loop a := a || 'ban'::text; end loop;
  return a[1:p_maps - 1];
end $$;

-- Con mapas fijos, el pool va en el orden elegido.
create or replace function public.match_map_pool(p_match uuid) returns setof public.map_pool
  language sql stable security definer set search_path = public as $$
  with pool as (
    select coalesce(e.map_pool, po.map_pool) as names, m.best_of
      from matches m
      left join events e on e.id = m.event_id
      left join pcw_posts po on po.match_id = m.id and m.kind = 'pcw'
     where m.id = p_match
     limit 1)
  select mp.* from map_pool mp, pool
   where case when pool.names is null then mp.active and mp.veto_default else mp.name = any(pool.names) end
   order by case when pool.names is not null and cardinality(pool.names) <= pool.best_of
                 then array_position(pool.names, mp.name) else mp.position end, mp.name $$;

-- Sin veto, los mapas de la serie son todo el pool en orden.
select pg_temp.reemplazar('public.match_series_maps(uuid)', array[
  array[$q$  if (select count(*) from match_vetos where match_id = p_match) < cardinality(seq) then return '{}'; end if;$q$,
        $q$  if (select count(*) from match_vetos where match_id = p_match) < cardinality(seq) then return '{}'; end if;
  -- (replanteo 92) mapas fijos: sin veto, todo el pool en el orden elegido
  if cardinality(seq) = 0 then
    return coalesce((select array_agg(coalesce(mp.versions[1], mp.name)) from match_map_pool(p_match) mp), '{}');
  end if;$q$]]);

-- ---------- 7. Servidores libres para PCW: los ve cualquiera con sesión (el panel de la página) ----------

select pg_temp.reemplazar('public.servers_free(text)', array[
  array[$q$if not (is_moderator() or is_organizer()) then raise exception$q$,
        $q$if not (is_moderator() or is_organizer() or (p_kind = 'pcw' and auth.uid() is not null)) then raise exception$q$]]);

-- ---------- 6. Lo mío para la página de PCW ----------

/**
 * Para la página de PCW: si soy VIP, mi ficha con su ELO, el equipo oficial con el que puedo jugar (soy su capitán o
 * su dueño) con su plantel, su puesto y su sanción de PCW, y mis amigos (mm_friends no se lee con la sesión).
 */
create function public.pcw_my_context() returns jsonb
  language sql stable security definer set search_path = public as $$
  with me as (select p.id, p.nick, p.steam_id from players p where p.user_id = auth.uid() limit 1),
  t as (select id, name, tag, logo_url, captain_id from teams
         where kind = 'official' and dissolved_at is null and (captain_id = auth.uid() or owner_id = auth.uid())
         order by (captain_id = auth.uid()) desc, founded_at nulls last limit 1)
  select jsonb_build_object(
    'vip', coalesce(is_vip(auth.uid()), false) or is_admin(),
    'me', (select jsonb_build_object('player_id', me.id, 'alias', me.nick,
                                     'elo', (select elo from player_elo where steam_id = elo_key(me.steam_id))) from me),
    'team', (select jsonb_build_object(
               'id', t.id, 'name', t.name, 'tag', t.tag, 'logo_url', t.logo_url,
               'rank', (select total_position from team_ranking r where r.team_id = t.id),
               'ban_until', team_pcw_ban_until(t.id),
               'plantel', coalesce((select jsonb_agg(jsonb_build_object('player_id', p.id, 'alias', p.nick, 'has_account', p.user_id is not null,
                                                                       'elo', (select elo from player_elo where steam_id = elo_key(p.steam_id)))
                                                     order by (p.user_id = t.captain_id) desc nulls last, p.nick)
                                     from team_members tm join players p on p.id = tm.player_id
                                    where tm.team_id = t.id and tm.left_at is null), '[]'))
             from t),
    'friends', coalesce((select jsonb_agg(jsonb_build_object('player_id', p.id, 'alias', p.nick,
                                                             'elo', (select elo from player_elo where steam_id = elo_key(p.steam_id)),
                                                             'teammate', exists (select 1 from t join team_members tm on tm.team_id = t.id
                                                                                  where tm.player_id = p.id and tm.left_at is null))
                                          order by p.nick)
                           from mm_friends f join players p on p.id = f.player_id where f.user_id = auth.uid()), '[]')) $$;
revoke all on function public.pcw_my_context() from public, anon;
grant execute on function public.pcw_my_context() to authenticated;

-- ---------- 5. Avisos ----------

select pg_temp.reemplazar('public.notification_category(text)', array[
  array[$q$'pcw_server_ready', 'pcw_abandoned') then 'pcw'$q$,
        $q$'pcw_server_ready', 'pcw_abandoned', 'pcw_offer', 'pcw_offer_chosen', 'pcw_offer_rejected') then 'pcw' -- (replanteo 92) ofertas$q$]]);

commit;
