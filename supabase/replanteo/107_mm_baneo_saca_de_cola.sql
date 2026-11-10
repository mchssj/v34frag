-- 107: un baneo saca al jugador del matchmaking (bitácora docs/bitacora/2026-11-09-mm-baneo-saca-de-cola/, Daniel 2026-11-09
-- y 2026-11-10).
--
-- Antes, los baneos de los servidores (bans) solo se miraban al entrar a la cola (mm_block_reason): un baneado que ya
-- estaba en la cola seguía ahí, caía en una sala y el servidor lo echaba al conectarse.
--   1. mm_ban_kick(baneo): con un baneo activo, a cada cuenta del baneado:
--      - sala antes de "en vivo" (accepting, veto, waiting_server, assigned o connecting): se cancela con
--        "Un jugador fue baneado" y los demás vuelven a la cola con su lugar;
--      - sala en vivo: su abandono se marca en el acto (opción A de Daniel), sin sanción de matchmaking: el baneo ya es
--        la sanción. El reemplazo lo abre mm_replace_sweep en la próxima vuelta de mm_tick;
--      - cola: sale él y todo su grupo (resultado 'cancelled'). Va después de la sala, porque mm_cancel_lobby devuelve
--        a la cola a los que habían aceptado, también al baneado.
--   2. Trigger bans_mm_kick (after insert on bans): la llama para todo baneo nuevo (web, !ban del juego e importación).
--      Si falla, el baneo se guarda igual (warning en el log de Postgres).
--   3. mm_user_banned / mm_unit_banned y mm_try_build: una unidad con alguien baneado no entra en el armado (la red por
--      si algo se cuela). El reemplazo de texto en mm_try_build lleva la marca "(replanteo 107)".
-- Inversa en docs/bitacora/2026-10-14-replanteo-modelo-datos/reversas/107_mm_baneo_saca_de_cola.sql.

begin;

do $$
begin
  if to_regprocedure('public.mm_ban_kick(uuid)') is not null then
    raise exception 'replanteo 107: ya está aplicado';
  end if;
  if to_regprocedure('public.mm_unit_away(text)') is null or to_regprocedure('public.mm_cancel_lobby(uuid,text,boolean)') is null then
    raise exception 'replanteo 107: falta el matchmaking (mm_unit_away o mm_cancel_lobby)';
  end if;
end $$;

-- ---------- 1. ¿Está baneado? (la misma condición que mm_block_reason) ----------
create function public.mm_user_banned(p_user uuid) returns boolean
  language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from players p join bans b on b.player_id = p.id or b.steam_id = p.steam_id
     where p.user_id = p_user and b.lifted_at is null and (b.expires_at is null or b.expires_at > now()))
$$;

create function public.mm_unit_banned(p_unit text) returns boolean
  language sql stable security definer set search_path = public as $$
  select exists (select 1 from mm_queue q where coalesce(q.party_id::text, q.user_id::text) = p_unit and mm_user_banned(q.user_id))
$$;

-- ---------- 2. Sacarlo de la sala y de la cola ----------
create function public.mm_ban_kick(p_ban uuid) returns jsonb
  language plpgsql security definer set search_path = public as $$
declare
  b bans%rowtype;
  v_player uuid;
  v_users uuid[];
  v_parties uuid[];
  v_removed uuid[] := '{}';
  v_cancelled uuid[] := '{}';
  v_abandoned uuid[] := '{}';
  l mm_lobbies%rowtype;
  r record;
begin
  select * into b from bans where id = p_ban;
  if b.id is null or b.lifted_at is not null or (b.expires_at is not null and b.expires_at <= now()) then
    return jsonb_build_object('users', '[]'::jsonb);
  end if;
  -- Las cuentas del baneado: la de su ficha (por player_id o por el dueño del SteamID) y la de una ficha con ese
  -- SteamID principal, como mm_block_reason.
  v_player := coalesce(b.player_id, steam_owner(b.steam_id));
  v_users := array(select distinct p.user_id from players p
                    where p.user_id is not null and (p.id = v_player or p.steam_id = b.steam_id));
  if cardinality(v_users) = 0 then return jsonb_build_object('users', '[]'::jsonb); end if;

  -- Primero la sala.
  for r in select distinct u.user_id, mm_active_lobby(u.user_id) as lobby_id from unnest(v_users) as u(user_id) loop
    continue when r.lobby_id is null;
    select * into l from mm_lobbies where id = r.lobby_id for update;
    if l.status in ('accepting', 'veto', 'waiting_server', 'assigned', 'connecting') then
      if l.status = 'accepting' then
        update mm_lobby_players set declined_at = coalesce(declined_at, now()) where lobby_id = l.id and user_id = r.user_id;
      end if;
      perform mm_cancel_lobby(l.id, 'Un jugador fue baneado', true);
      v_cancelled := v_cancelled || l.id;
    elsif l.status = 'live' then
      -- Solo si ya estaba jugando: un reemplazo que todavía no entró lo saca mm_replace_sweep al vencer su plazo.
      update mm_lobby_players set abandoned = true, left_at = null
       where lobby_id = l.id and user_id = r.user_id and not abandoned and connected_at is not null;
      if found then
        v_abandoned := v_abandoned || l.id;
        perform mm_emit('lobby.player', l.id, mm_lobby_users(l.id));
      end if;
    end if;
  end loop;

  -- Después la cola: él y su grupo entero.
  v_parties := array(select distinct q.party_id from mm_queue q where q.user_id = any(v_users) and q.party_id is not null);
  for r in select q.user_id from mm_queue q where q.user_id = any(v_users) or q.party_id = any(v_parties) for update loop
    perform mm_queue_remove(r.user_id, 'cancelled');
    v_removed := v_removed || r.user_id;
  end loop;
  -- Su pantalla y la de sus compañeros tienen que dejar de mostrar "Buscando" (como mm_queue_drop_away).
  if cardinality(v_removed) > 0 then perform mm_emit('party.changed', null, v_removed); end if;

  return jsonb_build_object('users', to_jsonb(v_users), 'removed', to_jsonb(v_removed),
                            'cancelled', to_jsonb(v_cancelled), 'abandoned', to_jsonb(v_abandoned));
end $$;

create function public.bans_mm_kick() returns trigger
  language plpgsql security definer set search_path = public as $$
begin
  begin
    perform mm_ban_kick(new.id);
  exception when others then
    -- El baneo vale igual: el matchmaking no lo puede frenar.
    raise warning 'replanteo 107: mm_ban_kick(%) falló: %', new.id, sqlerrm;
  end;
  return null;
end $$;

create trigger bans_mm_kick after insert on public.bans for each row execute function public.bans_mm_kick();

-- ---------- 3. La red en el armado ----------
do $$
declare
  f text := pg_get_functiondef('public.mm_try_build(text)'::regprocedure);
  v_old text := 'and not mm_unit_away(coalesce(party_id::text, user_id::text))';
  v_new text := 'and not mm_unit_away(coalesce(party_id::text, user_id::text)) and not mm_unit_banned(coalesce(party_id::text, user_id::text)) /* (replanteo 107) */';
  n int;
begin
  n := (length(f) - length(replace(f, v_old, ''))) / length(v_old);
  if n <> 3 then raise exception 'replanteo 107: mm_try_build no es el esperado (% apariciones de mm_unit_away)', n; end if;
  execute replace(f, v_old, v_new);
end $$;

-- ---------- 4. Permisos ----------
-- Solo los usa la base (el trigger y el armado).
revoke all on function public.mm_user_banned(uuid) from public, anon, authenticated;
revoke all on function public.mm_unit_banned(text) from public, anon, authenticated;
revoke all on function public.mm_ban_kick(uuid)    from public, anon, authenticated;
revoke all on function public.bans_mm_kick()       from public, anon, authenticated;

commit;
