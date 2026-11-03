-- Replanteo 52: matchmaking para cuentas sin ficha (bitácora docs/bitacora/2026-11-02-mm-claim-en-sala).
--   - Al registrarse no se crea una ficha: solo el !claim (o un admin) la crea. Por eso la cola no dejaba entrar a una
--     cuenta nueva aunque la 49 sacó el pedido de SteamID.
--   - mm_join le crea la ficha con el alias (mm_ensure_player) a cada integrante que no la tenga.
--   - claim_with_code: si la cuenta tiene una ficha vacía (sin SteamID ni partidas) y el SteamID es de una ficha vieja
--     sin cuenta, las une (player_merge_empty): la cuenta pasa a la vieja, con su historial y su ELO, y lo que apuntaba
--     a la vacía (cola, sala, plantel de la partida, amigos, bloqueos…) pasa a la vieja. Antes respondía "Ese SteamID
--     es de otra ficha: pedile a un admin".
--   - Después de un !claim que vincula, el ELO de la cola y de la sala se actualiza con el de la ficha (mm_after_claim).
-- Va después de la 49.
begin;

do $$
begin
  if to_regprocedure('public.csstv_mm_poll(text, text)') is null or to_regprocedure('public.claim_with_code(text, text, text, text)') is null then
    raise exception 'replanteo 52: faltan la 48 (matchmaking) o la 15 (claim)';
  end if;
end $$;

/** La ficha de la cuenta, creada con su alias si no tiene (el trigger players_nick_alias le pone el alias). */
create function public.mm_ensure_player(p_user uuid) returns uuid
  language plpgsql security definer set search_path = public as $$
declare v_id uuid;
begin
  select id into v_id from players where user_id = p_user;
  if v_id is not null then return v_id; end if;
  begin
    insert into players (nick, user_id)
      values (coalesce((select tag from profiles where id = p_user), 'jugador-' || left(p_user::text, 8)), p_user)
      returning id into v_id;
  exception when unique_violation then
    -- Otra llamada la creó en el medio, o el alias ya es el nick de otra ficha.
    select id into v_id from players where user_id = p_user;
    if v_id is null then
      raise exception 'No se pudo crear tu ficha de jugador: tu alias ya es el nick de otra ficha. Pedile a un admin que lo revise';
    end if;
  end;
  return v_id;
end $$;

/** Ficha sin SteamID ni partidas: la que crea el matchmaking antes del !claim. */
create function public.player_is_empty(p_player uuid) returns boolean
  language sql stable security definer set search_path = public as $$
  select p_player is not null
     and exists (select 1 from players where id = p_player and steam_id is null)
     and not exists (select 1 from player_extra_steam_ids where player_id = p_player)
     and not exists (select 1 from match_player_stats where player_id = p_player) $$;

/**
 * Pasa todo lo que apunta a la ficha vacía p_from a p_to y la borra. Recorre las claves foráneas a players (así incluye
 * las tablas del matchmaking y las que se sumen) y los planteles de matches. Si una fila ya existe con p_to, la de p_from
 * se borra. No toca user_id: lo pone quien llama, después del borrado (el alias es el nick de la vacía y el nick es único).
 */
create function public.player_merge_empty(p_from uuid, p_to uuid) returns void
  language plpgsql security definer set search_path = public as $$
declare f record;
begin
  if not player_is_empty(p_from) then raise exception 'La ficha % no está vacía', p_from; end if;
  perform 1 from players where id in (p_from, p_to) for update;
  for f in
    select c.conrelid::regclass as tabla, a.attname as columna
      from pg_constraint c join pg_attribute a on a.attrelid = c.conrelid and a.attnum = c.conkey[1]
     where c.contype = 'f' and c.confrelid = 'public.players'::regclass and cardinality(c.conkey) = 1
  loop
    begin
      execute format('update %s set %I = $1 where %I = $2', f.tabla, f.columna, f.columna) using p_to, p_from;
    exception when unique_violation then
      execute format('delete from %s where %I = $1', f.tabla, f.columna) using p_from;
    end;
  end loop;
  update matches set lineup1 = array_replace(lineup1, p_from, p_to) where p_from = any(lineup1);
  update matches set lineup2 = array_replace(lineup2, p_from, p_to) where p_from = any(lineup2);
  delete from players where id = p_from;
end $$;

/** Después de un !claim que vincula: el ELO de la cola y de la sala abierta pasa a ser el de la ficha, y avisa a la sala. */
create function public.mm_after_claim(p_user uuid) returns void
  language plpgsql security definer set search_path = public as $$
declare v_player uuid; v_lobby uuid;
begin
  select id into v_player from players where user_id = p_user;
  if v_player is null then return; end if;
  update mm_queue set player_id = v_player, elo = mm_player_elo(v_player) where user_id = p_user;
  v_lobby := mm_active_lobby(p_user);
  if v_lobby is not null and (select status from mm_lobbies where id = v_lobby) not in ('live', 'finished', 'cancelled') then
    update mm_lobby_players set elo = mm_player_elo(v_player) where lobby_id = v_lobby and user_id = p_user;
  end if;
  if v_lobby is not null then perform mm_emit('lobby.update', v_lobby, mm_lobby_users(v_lobby)); end if;
end $$;

revoke all on function public.mm_ensure_player(uuid), public.player_is_empty(uuid), public.player_merge_empty(uuid, uuid),
  public.mm_after_claim(uuid) from public, anon, authenticated;
grant execute on function public.mm_ensure_player(uuid), public.player_is_empty(uuid), public.player_merge_empty(uuid, uuid),
  public.mm_after_claim(uuid) to service_role;

create or replace function public.mm_block_reason(p_user uuid) returns text
  language plpgsql stable security definer set search_path = public as $$
declare
  c mm_config%rowtype;
  p players%rowtype;
  u auth.users%rowtype;
  dev ac_devices%rowtype;
  n int;
begin
  select * into c from mm_config;
  select * into p from players where user_id = p_user;
  -- Sin ficha también: mm_join se la crea con el alias y el !claim la une con la vieja si la hay (replanteo 52).
  -- Sin SteamID también: se vincula con !claim al entrar al servidor de su primera sala (replanteo 49).
  select * into u from auth.users where id = p_user;
  if u.email_confirmed_at is null then return 'Confirmá tu correo para jugar'; end if;
  if exists (select 1 from mm_penalties where user_id = p_user and until > now()) then return 'Tenés una sanción vigente'; end if;
  if exists (select 1 from mm_bans where user_id = p_user and until > now()) then return 'Estás excluido del matchmaking'; end if;
  if exists (select 1 from bans b where b.lifted_at is null and (b.expires_at is null or b.expires_at > now())
              and (b.player_id = p.id or b.steam_id = p.steam_id)) then return 'Tenés un baneo activo en los servidores'; end if;
  if c.min_mixes > 0 then
    n := coalesce((select maps from player_overview where id = p.id), 0);
    if n < c.min_mixes then return format('Te faltan %s mixes para jugar matchmaking', c.min_mixes - n); end if;
  end if;
  if u.created_at > now() - make_interval(days => c.min_account_days) then
    return 'Tu cuenta es muy nueva para jugar matchmaking';
  end if;
  if c.require_anticheat then
    select * into dev from ac_devices where user_id = p_user and revoked_at is null order by last_seen_at desc nulls last limit 1;
    if dev.id is null then return 'Para jugar tenés que vincular el anticheat'; end if;
    if dev.last_seen_at is null or dev.last_seen_at < now() - interval '90 seconds' then return 'Tu anticheat no está activo'; end if;
  end if;
  return null;
end $$;

create or replace function public.mm_join(p_mode text, p_region text default null) returns void
  language plpgsql security definer set search_path = public as $$
declare
  me uuid := auth.uid();
  v_party uuid;
  v_leader uuid;
  v_size int;
  r record;
  razon text;
begin
  if me is null then raise exception 'Tenés que iniciar sesión' using errcode = '42501'; end if;
  if not (select open from mm_config) then raise exception 'La cola está cerrada'; end if;
  select pm.party_id, p.leader_id into v_party, v_leader from mm_party_members pm join mm_parties p on p.id = pm.party_id where pm.user_id = me;
  if v_party is not null and v_leader <> me then raise exception 'Solo el líder del grupo entra a la cola'; end if;
  select g.players_per_team into v_size from mm_mode_settings s join game_modes g on g.code = s.mode where s.mode = p_mode and s.enabled;
  if v_size is null then raise exception 'Ese modo no está habilitado'; end if;
  if v_party is not null and (select count(*) from mm_party_members where party_id = v_party) > v_size then
    raise exception 'Tu grupo no entra en un equipo de %', p_mode;
  end if;
  if (select count(*) from game_servers s where s.mm_enabled and (s.region = p_region or p_region is null)) = 0 and p_region is not null then
    raise exception 'No hay servidores en esa región';
  end if;
  for r in select coalesce(pm.user_id, me) as uid from (select 1) x left join mm_party_members pm on pm.party_id = v_party loop
    razon := mm_block_reason(r.uid);
    if razon is not null then
      raise exception '%', case when r.uid = me then razon else 'Alguien de tu grupo no puede jugar: ' || razon end;
    end if;
    if mm_active_lobby(r.uid) is not null then raise exception 'Hay alguien del grupo en una sala'; end if;
    perform mm_ensure_player(r.uid);
  end loop;
  insert into mm_queue (user_id, player_id, party_id, mode, region, elo)
    select u.uid, p.id, v_party, p_mode, p_region, mm_player_elo(p.id)
      from (select coalesce(pm.user_id, me) as uid from (select 1) x left join mm_party_members pm on pm.party_id = v_party) u
      join players p on p.user_id = u.uid
    on conflict (user_id) do nothing;
end $$;

drop function if exists pg_temp.reemplazar(regprocedure, text[]);
create function pg_temp.reemplazar(fn regprocedure, cambios text[][]) returns void language plpgsql as $$
declare d text := pg_get_functiondef(fn); i int;
begin
  for i in 1 .. array_length(cambios, 1) loop
    if position(cambios[i][1] in d) = 0 then
      raise exception '%: en % no se encontró: %', 'replanteo 52', fn, left(cambios[i][1], 80);
    end if;
    d := replace(d, cambios[i][1], cambios[i][2]);
  end loop;
  execute d;
end $$;

select pg_temp.reemplazar('public.claim_with_code(text, text, text, text)'::regprocedure, array[
  [$q$        else
          res := jsonb_build_object('ok', false, 'pending', false, 'message', 'Ese SteamID es de otra ficha: pedile a un admin que lo revise');
        end if;$q$, $q$        elsif player_is_empty(acc.id) then
          -- La cuenta tiene una ficha vacía (la crea el matchmaking) y el SteamID es de una ficha vieja sin cuenta:
          -- la cuenta pasa a la vieja, con su historial y su ELO, y la vacía se borra (replanteo 52).
          perform player_merge_empty(acc.id, v_owner);
          update players set user_id = c.user_id where id = v_owner;
          v_player := v_owner;
          res := jsonb_build_object('ok', true, 'pending', false, 'message', 'Listo: tu cuenta quedó vinculada');
        else
          res := jsonb_build_object('ok', false, 'pending', false, 'message', 'Ese SteamID es de otra ficha: pedile a un admin que lo revise');
        end if;$q$],
  [$q$      update claim_codes set used_at = now(), used_steam_id = s64, result = res->>'message' where code = c.code;
      v_player := coalesce(v_player, acc.id);$q$, $q$      update claim_codes set used_at = now(), used_steam_id = s64, result = res->>'message' where code = c.code;
      v_player := coalesce(v_player, acc.id);
      if (res->>'ok')::boolean and not (res->>'pending')::boolean then perform mm_after_claim(c.user_id); end if;$q$]]);

notify pgrst, 'reload schema';

commit;
