-- Inversa del replanteo 52: claim_with_code, mm_join y mm_block_reason como en la 49, y sin las funciones nuevas.
-- Las fichas que creó el matchmaking quedan (con su cuenta): son fichas comunes sin SteamID.
begin;

drop function if exists pg_temp.reemplazar(regprocedure, text[]);
create function pg_temp.reemplazar(fn regprocedure, cambios text[][]) returns void language plpgsql as $$
declare d text := pg_get_functiondef(fn); i int;
begin
  for i in 1 .. array_length(cambios, 1) loop
    if position(cambios[i][1] in d) = 0 then
      raise exception '%: en % no se encontró: %', 'inversa 52', fn, left(cambios[i][1], 80);
    end if;
    d := replace(d, cambios[i][1], cambios[i][2]);
  end loop;
  execute d;
end $$;

select pg_temp.reemplazar('public.claim_with_code(text, text, text, text)'::regprocedure, array[
  [$q$        elsif player_is_empty(acc.id) then
          -- La cuenta tiene una ficha vacía (la crea el matchmaking) y el SteamID es de una ficha vieja sin cuenta:
          -- la cuenta pasa a la vieja, con su historial y su ELO, y la vacía se borra (replanteo 52).
          perform player_merge_empty(acc.id, v_owner);
          update players set user_id = c.user_id where id = v_owner;
          v_player := v_owner;
          res := jsonb_build_object('ok', true, 'pending', false, 'message', 'Listo: tu cuenta quedó vinculada');
        else
          res := jsonb_build_object('ok', false, 'pending', false, 'message', 'Ese SteamID es de otra ficha: pedile a un admin que lo revise');
        end if;$q$, $q$        else
          res := jsonb_build_object('ok', false, 'pending', false, 'message', 'Ese SteamID es de otra ficha: pedile a un admin que lo revise');
        end if;$q$],
  [$q$      update claim_codes set used_at = now(), used_steam_id = s64, result = res->>'message' where code = c.code;
      v_player := coalesce(v_player, acc.id);
      if (res->>'ok')::boolean and not (res->>'pending')::boolean then perform mm_after_claim(c.user_id); end if;$q$, $q$      update claim_codes set used_at = now(), used_steam_id = s64, result = res->>'message' where code = c.code;
      v_player := coalesce(v_player, acc.id);$q$]]);

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
  if p.id is null then return 'Tu cuenta no tiene una ficha de jugador vinculada'; end if;
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
  end loop;
  insert into mm_queue (user_id, player_id, party_id, mode, region, elo)
    select u.uid, p.id, v_party, p_mode, p_region, mm_player_elo(p.id)
      from (select coalesce(pm.user_id, me) as uid from (select 1) x left join mm_party_members pm on pm.party_id = v_party) u
      join players p on p.user_id = u.uid
    on conflict (user_id) do nothing;
end $$;

drop function public.mm_after_claim(uuid);
drop function public.player_merge_empty(uuid, uuid);
drop function public.player_is_empty(uuid);
drop function public.mm_ensure_player(uuid);

notify pgrst, 'reload schema';

commit;
