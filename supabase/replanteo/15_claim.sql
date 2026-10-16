-- Replanteo 15: perfiles sin reclamar, !claim y varios SteamID por ficha (plan docs/bitacora/2026-10-16-claim-steamid).
--   - players.steam_id sigue siendo el SteamID principal; player_extra_steam_ids guarda los adicionales.
--     Un SteamID pertenece a una sola ficha (principal o adicional) y una solicitud pendiente lo reserva.
--   - El ELO de una ficha es uno solo: el motor usa elo_key(), el SteamID principal de la ficha.
--   - claim_with_code (lo llama el plugin) vincula el primer SteamID o crea una solicitud de adicional.
--   - Se borran los reclamos viejos (profile_requests); los aprobados pasan a claim_log como historia.
-- Necesita la migración 20261015210000_elo_ajustes.sql (ajustes manuales de ELO).
-- NO aplicar en producción antes del corte (ver README.md).
begin;

do $$
begin
  if to_regclass('public.admin_demo_list') is null then
    raise exception 'replanteo 15: falta admin_demo_list (aplicar antes 14_demos_admin.sql)';
  end if;
  if to_regclass('public.elo_adjustments') is null then
    raise exception 'replanteo 15: falta elo_adjustments (aplicar antes supabase/migrations/20261015210000_elo_ajustes.sql)';
  end if;
  if to_regclass('public.claim_codes') is not null then
    raise exception 'replanteo 15: claim_codes ya existe (¿ya se aplicó?)';
  end if;
end $$;

-- =====================================================================================================
-- 1. Configuración: tope de SteamID por ficha
-- =====================================================================================================
-- Hasta 4: con 10 jugadores por lado, 4 SteamID cada uno entran en la lista de 1024 caracteres que el
-- plugin recibe para !match (csstv_match_lookup).
create table public.claim_config (
  id            smallint primary key default 1 check (id = 1),
  max_steam_ids integer not null default 3 check (max_steam_ids between 1 and 4),
  updated_at    timestamptz not null default now(),
  updated_by    uuid
);
insert into public.claim_config(id) values (1);
alter table public.claim_config enable row level security;
create policy "claim_config: todos ven" on public.claim_config for select using (true);
grant select on public.claim_config to anon, authenticated;

create function public.set_claim_config(p_max_steam_ids integer) returns integer
  language plpgsql security definer set search_path = public as $$
begin
  if not is_admin() then raise exception 'Solo un admin puede cambiar el tope de SteamID' using errcode = '42501'; end if;
  if p_max_steam_ids is null or p_max_steam_ids not between 1 and 4 then
    raise exception 'El tope de SteamID por ficha tiene que estar entre 1 y 4';
  end if;
  update claim_config set max_steam_ids = p_max_steam_ids, updated_at = now(), updated_by = auth.uid() where id = 1;
  return p_max_steam_ids;
end $$;

-- =====================================================================================================
-- 2. SteamID adicionales y solicitudes
-- =====================================================================================================
create function public.is_steam64(p text) returns boolean language sql immutable as $$
  select coalesce(p ~ '^(7656119[0-9]{10}|765612[0-9]{11})$', false) $$;

create table public.player_extra_steam_ids (
  steam_id  text primary key check (is_steam64(steam_id)),
  player_id uuid not null references public.players(id) on delete cascade,
  added_at  timestamptz not null default now(),
  added_by  uuid
);
create index player_extra_steam_ids_player on public.player_extra_steam_ids (player_id);
comment on table public.player_extra_steam_ids is 'SteamID adicionales de una ficha (el principal es players.steam_id)';
alter table public.player_extra_steam_ids enable row level security;
create policy "steam adicionales: todos ven" on public.player_extra_steam_ids for select using (true);
grant select on public.player_extra_steam_ids to anon, authenticated;

create table public.steam_requests (
  id          bigint generated always as identity primary key,
  player_id   uuid not null references public.players(id) on delete cascade,
  user_id     uuid references auth.users(id) on delete set null,
  steam_id    text not null check (is_steam64(steam_id)),
  nick        text,
  server_id   uuid references public.game_servers(id) on delete set null,
  status      text not null default 'pending' check (status in ('pending', 'approved', 'rejected', 'expired')),
  reason      text,
  created_at  timestamptz not null default now(),
  resolved_at timestamptz,
  resolved_by uuid
);
create unique index steam_requests_pendiente on public.steam_requests (steam_id) where status = 'pending';
create index steam_requests_player on public.steam_requests (player_id);
comment on table public.steam_requests is 'Solicitudes de SteamID adicional (con !claim); las aprueba un admin. Una pendiente reserva el SteamID';
alter table public.steam_requests enable row level security;
create policy "solicitudes de steam: la propia o admin" on public.steam_requests for select
  using (user_id = auth.uid() or is_admin());
grant select on public.steam_requests to authenticated;

-- Todos los SteamID de cada ficha.
create view public.player_steam_all as
select p.id as player_id, p.steam_id, true as is_primary, null::timestamptz as added_at from players p where p.steam_id is not null
union all
select x.player_id, x.steam_id, false, x.added_at from player_extra_steam_ids x;
grant select on public.player_steam_all to anon, authenticated;

-- Ficha dueña de un SteamID (principal o adicional), o null.
create function public.steam_owner(p_steam text) returns uuid language sql stable set search_path = public as $$
  select coalesce((select id from players where steam_id = p_steam),
                  (select player_id from player_extra_steam_ids where steam_id = p_steam)) $$;

-- Clave de ELO: el SteamID principal de la ficha (para un adicional) o el propio SteamID.
create function public.elo_key(p_steam text) returns text language sql stable set search_path = public as $$
  select coalesce((select p.steam_id from player_extra_steam_ids x join players p on p.id = x.player_id where x.steam_id = p_steam), p_steam) $$;

-- Un SteamID en una sola ficha: ni principal de una y adicional de otra, ni adicional sin principal.
create function public.steam_unico() returns trigger language plpgsql set search_path = public as $$
begin
  if tg_table_name = 'players' then
    if new.steam_id is not null and exists (select 1 from player_extra_steam_ids where steam_id = new.steam_id) then
      raise exception 'Ese SteamID ya es adicional de una ficha' using errcode = '23505';
    end if;
    if new.steam_id is null and exists (select 1 from player_extra_steam_ids where player_id = new.id) then
      raise exception 'La ficha tiene SteamID adicionales: quitalos o elegí otro principal antes' using errcode = '23514';
    end if;
  else
    if exists (select 1 from players where steam_id = new.steam_id) then
      raise exception 'Ese SteamID ya es el principal de una ficha' using errcode = '23505';
    end if;
    if (select steam_id from players where id = new.player_id) is null then
      raise exception 'La ficha no tiene SteamID principal' using errcode = '23514';
    end if;
  end if;
  return new;
end $$;
create trigger players_steam_unico before insert or update of steam_id on public.players
  for each row execute function public.steam_unico();
create trigger player_extra_steam_ids_unico before insert or update on public.player_extra_steam_ids
  for each row execute function public.steam_unico();

-- Las solicitudes pendientes de más de 30 días vencen (se llama antes de leerlas o de reclamar).
create function public.steam_requests_expire() returns integer language plpgsql security definer set search_path = public as $$
declare n integer;
begin
  update steam_requests set status = 'expired', resolved_at = now()
   where status = 'pending' and created_at < now() - interval '30 days';
  get diagnostics n = row_count;
  return n;
end $$;

-- =====================================================================================================
-- 3. Pasar el historial de un SteamID a una ficha (o sacarlo)
-- =====================================================================================================
-- Lo que hacía link_steam_id: stats de las partidas y lineups/invitados de los mixes.
create function public.steam_history_to(p_steam text, p_player uuid) returns void
  language plpgsql security definer set search_path = public as $$
begin
  update match_player_stats set player_id = p_player where steam_id = p_steam;
  update matches m
     set lineup1      = case when s.team = 1 and not (p_player = any(m.lineup1)) then array_append(m.lineup1, p_player) else m.lineup1 end,
         lineup2      = case when s.team = 2 and not (p_player = any(m.lineup2)) then array_append(m.lineup2, p_player) else m.lineup2 end,
         side1_guests = case when s.team = 1 then array_remove(m.side1_guests, s.nick) else m.side1_guests end,
         side2_guests = case when s.team = 2 then array_remove(m.side2_guests, s.nick) else m.side2_guests end
    from match_player_stats s
   where s.steam_id = p_steam and s.match_id = m.id and m.kind = 'mix';
end $$;

create function public.steam_history_release(p_steam text, p_player uuid) returns void
  language plpgsql security definer set search_path = public as $$
begin
  update match_player_stats set player_id = null where steam_id = p_steam;
  update matches m
     set lineup1      = case when s.team = 1 then array_remove(m.lineup1, p_player) else m.lineup1 end,
         lineup2      = case when s.team = 2 then array_remove(m.lineup2, p_player) else m.lineup2 end,
         side1_guests = case when s.team = 1 and not (s.nick = any(m.side1_guests)) then array_append(m.side1_guests, s.nick) else m.side1_guests end,
         side2_guests = case when s.team = 2 and not (s.nick = any(m.side2_guests)) then array_append(m.side2_guests, s.nick) else m.side2_guests end
    from match_player_stats s
   where s.steam_id = p_steam and s.match_id = m.id and m.kind = 'mix';
end $$;

-- Suma un SteamID a una ficha: principal si no tiene, adicional si ya tiene. Devuelve true si hay que
-- recalcular el ELO (un adicional con partidas o ajustes: su historial se une al de la ficha).
create function public.steam_attach(p_steam text, p_player uuid, p_by uuid) returns boolean
  language plpgsql security definer set search_path = public as $$
declare v_primary text;
begin
  select steam_id into v_primary from players where id = p_player for update;
  if not found then raise exception 'No existe esa ficha'; end if;
  if v_primary is null then
    update players set steam_id = p_steam where id = p_player;
  else
    insert into player_extra_steam_ids(steam_id, player_id, added_by) values (p_steam, p_player, p_by);
  end if;
  perform steam_history_to(p_steam, p_player);
  return v_primary is not null
     and (exists (select 1 from player_elo where steam_id = p_steam) or exists (select 1 from elo_adjustments where steam_id = p_steam));
end $$;

-- Saca un SteamID de su ficha. Si era el principal, el adicional más viejo pasa a ser el principal.
-- Devuelve true si hay que recalcular el ELO (la ficha tenía más de un SteamID).
create function public.steam_detach(p_steam text) returns boolean
  language plpgsql security definer set search_path = public as $$
declare v_player uuid; v_next text; v_many boolean;
begin
  v_player := steam_owner(p_steam);
  if v_player is null then raise exception 'Ese SteamID no es de ninguna ficha'; end if;
  perform 1 from players where id = v_player for update;
  v_many := exists (select 1 from player_extra_steam_ids where player_id = v_player);
  if exists (select 1 from player_extra_steam_ids where steam_id = p_steam) then
    delete from player_extra_steam_ids where steam_id = p_steam;
  else
    select steam_id into v_next from player_extra_steam_ids where player_id = v_player order by added_at, steam_id limit 1;
    if v_next is not null then
      delete from player_extra_steam_ids where steam_id = v_next;
    end if;
    update players set steam_id = v_next where id = v_player;
  end if;
  perform steam_history_release(p_steam, v_player);
  return v_many;
end $$;

revoke all on function public.steam_history_to(text, uuid) from public, anon, authenticated;
revoke all on function public.steam_history_release(text, uuid) from public, anon, authenticated;
revoke all on function public.steam_attach(text, uuid, uuid) from public, anon, authenticated;
revoke all on function public.steam_detach(text) from public, anon, authenticated;
revoke all on function public.steam_requests_expire() from public, anon;
grant execute on function public.steam_requests_expire() to authenticated;

-- =====================================================================================================
-- 4. Funciones de admin
-- =====================================================================================================
-- Vincular (p_player) o desvincular (null) un SteamID. Ahora agrega a la lista, sin tope (hasta 4 en total).
create or replace function public.link_steam_id(p_steam text, p_player uuid) returns void
  language plpgsql security definer set search_path = public as $$
declare
  s64 text := csstv_steam64(p_steam);
  cur uuid;
begin
  -- (replanteo 15) varios SteamID por ficha
  if not is_admin() then raise exception 'Solo un admin puede vincular SteamIDs' using errcode = '42501'; end if;
  if s64 is null then raise exception 'SteamID inválido. Usá STEAM_0:X:Y, SteamID64 o el link del perfil.' using errcode = '22023'; end if;
  cur := steam_owner(s64);
  if p_player is null then
    if cur is null then return; end if;
    if steam_detach(s64) then perform elo_recompute_all(); end if;
    return;
  end if;
  if cur is not null and cur <> p_player then
    raise exception 'Ese SteamID ya está vinculado a otro jugador' using errcode = '23505';
  end if;
  if cur = p_player then return; end if;
  if exists (select 1 from steam_requests where steam_id = s64 and status = 'pending' and player_id <> p_player) then
    raise exception 'Ese SteamID tiene un pedido pendiente de otra ficha: resolvelo primero';
  end if;
  if (select count(*) from player_steam_all where player_id = p_player) >= 4 then
    raise exception 'La ficha ya tiene 4 SteamID, el máximo';
  end if;
  update steam_requests set status = 'approved', resolved_at = now(), resolved_by = auth.uid()
   where steam_id = s64 and status = 'pending';
  if steam_attach(s64, p_player, auth.uid()) then perform elo_recompute_all(); end if;
end $$;

create function public.admin_remove_steam(p_steam text) returns void
  language plpgsql security definer set search_path = public as $$
begin
  if not is_admin() then raise exception 'Solo un admin puede quitar SteamIDs' using errcode = '42501'; end if;
  if steam_detach(p_steam) then perform elo_recompute_all(); end if;
end $$;

-- El adicional pasa a ser el principal (y el principal, adicional). Cambia la clave de ELO: se recalcula.
create function public.admin_set_primary_steam(p_steam text) returns void
  language plpgsql security definer set search_path = public as $$
declare v_player uuid; v_old text;
begin
  if not is_admin() then raise exception 'Solo un admin puede cambiar el SteamID principal' using errcode = '42501'; end if;
  select player_id into v_player from player_extra_steam_ids where steam_id = p_steam;
  if v_player is null then
    if exists (select 1 from players where steam_id = p_steam) then return; end if;
    raise exception 'Ese SteamID no es de ninguna ficha';
  end if;
  select steam_id into v_old from players where id = v_player for update;
  delete from player_extra_steam_ids where steam_id = p_steam;
  -- El viejo principal se guarda como adicional después de cambiar el principal (el trigger lo exige).
  update players set steam_id = p_steam where id = v_player;
  insert into player_extra_steam_ids(steam_id, player_id, added_by) values (v_old, v_player, auth.uid());
  perform elo_recompute_all();
end $$;

-- Aprobar una solicitud: el SteamID tiene que seguir libre, la ficha por debajo de 4 y sin partidas compartidas.
create function public.approve_steam_request(p_id bigint) returns void
  language plpgsql security definer set search_path = public as $$
declare r steam_requests%rowtype;
begin
  if not is_admin() then raise exception 'Solo un admin puede aprobar SteamIDs' using errcode = '42501'; end if;
  perform steam_requests_expire();
  select * into r from steam_requests where id = p_id for update;
  if not found then raise exception 'No existe esa solicitud'; end if;
  if r.status <> 'pending' then raise exception 'La solicitud ya no está pendiente (%)', r.status; end if;
  if steam_owner(r.steam_id) is not null then raise exception 'Ese SteamID ya es de una ficha'; end if;
  if (select count(*) from player_steam_all where player_id = r.player_id) >= 4 then
    raise exception 'La ficha ya tiene 4 SteamID, el máximo';
  end if;
  if exists (select 1 from match_player_stats a join match_player_stats b on b.match_id = a.match_id
              where a.steam_id = r.steam_id and b.steam_id in (select steam_id from player_steam_all where player_id = r.player_id)) then
    raise exception 'Ese SteamID jugó una partida junto a otro SteamID de la ficha: no puede ser la misma persona';
  end if;
  update steam_requests set status = 'approved', resolved_at = now(), resolved_by = auth.uid() where id = p_id;
  if steam_attach(r.steam_id, r.player_id, auth.uid()) then perform elo_recompute_all(); end if;
end $$;

create function public.reject_steam_request(p_id bigint, p_reason text) returns void
  language plpgsql security definer set search_path = public as $$
begin
  if not is_admin() then raise exception 'Solo un admin puede rechazar SteamIDs' using errcode = '42501'; end if;
  update steam_requests set status = 'rejected', reason = nullif(left(trim(coalesce(p_reason, '')), 200), ''),
         resolved_at = now(), resolved_by = auth.uid()
   where id = p_id and status = 'pending';
  if not found then raise exception 'No existe esa solicitud o ya no está pendiente'; end if;
end $$;

revoke all on function public.set_claim_config(integer) from public, anon;
revoke all on function public.admin_remove_steam(text) from public, anon;
revoke all on function public.admin_set_primary_steam(text) from public, anon;
revoke all on function public.approve_steam_request(bigint) from public, anon;
revoke all on function public.reject_steam_request(bigint, text) from public, anon;
grant execute on function public.set_claim_config(integer) to authenticated;
grant execute on function public.admin_remove_steam(text) to authenticated;
grant execute on function public.admin_set_primary_steam(text) to authenticated;
grant execute on function public.approve_steam_request(bigint) to authenticated;
grant execute on function public.reject_steam_request(bigint, text) to authenticated;

-- =====================================================================================================
-- 5. Códigos, registro y !claim
-- =====================================================================================================
create table public.claim_codes (
  code          text primary key check (code ~ '^[A-HJKMNP-Z2-9]{6}$'),
  user_id       uuid not null references auth.users(id) on delete cascade,
  created_at    timestamptz not null default now(),
  expires_at    timestamptz not null,
  used_at       timestamptz,
  used_steam_id text,
  result        text
);
create index claim_codes_user on public.claim_codes (user_id, created_at desc);
alter table public.claim_codes enable row level security;
create policy "códigos: los propios" on public.claim_codes for select using (user_id = auth.uid());
grant select on public.claim_codes to authenticated;

create table public.claim_log (
  id         bigint generated always as identity primary key,
  steam_id   text,
  nick       text,
  user_id    uuid references auth.users(id) on delete set null,
  player_id  uuid references public.players(id) on delete set null,
  server_id  uuid references public.game_servers(id) on delete set null,
  code       text,
  ok         boolean not null,
  result     text not null,
  created_at timestamptz not null default now()
);
create index claim_log_steam on public.claim_log (steam_id, created_at desc);
alter table public.claim_log enable row level security;
create policy "registro de reclamos: admin" on public.claim_log for select using (is_admin());
grant select on public.claim_log to authenticated;

-- Código nuevo de la cuenta (vence a los 10 minutos). Los anteriores sin usar vencen. Hasta 5 por hora.
create function public.create_claim_code() returns table(code text, expires_at timestamptz)
  language plpgsql security definer set search_path = public as $$
declare
  v_code text;
  abc    constant text := 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  i      integer;
begin
  if auth.uid() is null then raise exception 'Iniciá sesión para generar un código' using errcode = '42501'; end if;
  if (select count(*) from claim_codes c where c.user_id = auth.uid() and c.created_at > now() - interval '1 hour') >= 5 then
    raise exception 'Generaste 5 códigos en la última hora: esperá un rato';
  end if;
  update claim_codes c set expires_at = now() where c.user_id = auth.uid() and c.used_at is null and c.expires_at > now();
  loop
    v_code := '';
    for i in 1 .. 6 loop
      v_code := v_code || substr(abc, 1 + floor(random() * length(abc))::int, 1);
    end loop;
    exit when not exists (select 1 from claim_codes c where c.code = v_code);
  end loop;
  insert into claim_codes(code, user_id, expires_at) values (v_code, auth.uid(), now() + interval '10 minutes');
  return query select v_code, now() + interval '10 minutes';
end $$;
revoke all on function public.create_claim_code() from public, anon;
grant execute on function public.create_claim_code() to authenticated;

-- La llama el plugin con el token del servidor. Responde siempre (sin error) con
-- { ok, pending, message, alias }, para que el plugin distinga un "no" de una falla de red.
create function public.claim_with_code(p_token text, p_steam text, p_code text, p_nick text default null) returns jsonb
  language plpgsql security definer set search_path = public as $$
declare
  t        record;
  s64      text;
  c        claim_codes%rowtype;
  acc      players%rowtype;
  v_owner  uuid;
  own      players%rowtype;
  v_alias  text;
  v_max    integer;
  v_nick   text := left(nullif(trim(coalesce(p_nick, '')), ''), 40);
  v_code   text := upper(trim(coalesce(p_code, '')));
  res      jsonb;
  v_player uuid;
begin
  select * into t from csstv_check_token(p_token);
  if t.sid is null then
    return jsonb_build_object('ok', false, 'pending', false, 'reason', t.reason,
                              'message', 'Este servidor no tiene una licencia válida de CSSTV');
  end if;
  s64 := csstv_steam64(p_steam);
  if s64 is null then
    return jsonb_build_object('ok', false, 'pending', false, 'message', 'Tu SteamID no es válido: no se puede vincular');
  end if;

  if (select count(*) from claim_log l where l.steam_id = s64 and not l.ok and l.created_at > now() - interval '10 minutes') >= 5 then
    return jsonb_build_object('ok', false, 'pending', false, 'message', 'Demasiados intentos: esperá unos minutos');
  end if;
  perform steam_requests_expire();

  begin
    select * into c from claim_codes where code = v_code and used_at is null and expires_at > now() for update;
    if not found then
      res := jsonb_build_object('ok', false, 'pending', false, 'message', 'Código inválido o vencido: generá otro en la web (Mi perfil)');
    else
      select tag into v_alias from profiles where id = c.user_id;
      select * into acc from players where user_id = c.user_id for update;
      v_owner := steam_owner(s64);
      if v_owner is not null then
        select * into own from players where id = v_owner;
        if acc.id = v_owner then
          res := jsonb_build_object('ok', true, 'pending', false, 'message', 'Tu cuenta ya está vinculada a este SteamID');
        elsif acc.id is null and own.user_id is null then
          -- La ficha de ese SteamID (cargada por un admin) pasa a ser de la cuenta.
          update players set user_id = c.user_id where id = v_owner;
          v_player := v_owner;
          res := jsonb_build_object('ok', true, 'pending', false, 'message', 'Listo: tu cuenta quedó vinculada');
        elsif own.user_id is not null then
          res := jsonb_build_object('ok', false, 'pending', false, 'message', 'Ese SteamID pertenece a otra cuenta');
        else
          res := jsonb_build_object('ok', false, 'pending', false, 'message', 'Ese SteamID es de otra ficha: pedile a un admin que lo revise');
        end if;
      elsif exists (select 1 from steam_requests r where r.steam_id = s64 and r.status = 'pending') then
        if exists (select 1 from steam_requests r where r.steam_id = s64 and r.status = 'pending' and r.player_id = acc.id) then
          res := jsonb_build_object('ok', true, 'pending', true, 'message', 'Ya pediste este SteamID: falta que lo apruebe un admin');
        else
          res := jsonb_build_object('ok', false, 'pending', false, 'message', 'Ese SteamID tiene un pedido pendiente de otra cuenta');
        end if;
      elsif acc.id is null then
        -- Cuenta sin ficha: se crea (el trigger le pone el alias) con este SteamID y su historial.
        insert into players(nick, user_id) values (coalesce(v_alias, 'jugador'), c.user_id) returning id into v_player;
        perform steam_attach(s64, v_player, null);
        res := jsonb_build_object('ok', true, 'pending', false, 'message', 'Listo: tu cuenta quedó vinculada');
      elsif acc.steam_id is null then
        perform steam_attach(s64, acc.id, null);
        v_player := acc.id;
        res := jsonb_build_object('ok', true, 'pending', false, 'message', 'Listo: tu cuenta quedó vinculada');
      else
        select max_steam_ids into v_max from claim_config where id = 1;
        if (select count(*) from player_steam_all where player_id = acc.id) >= coalesce(v_max, 3) then
          res := jsonb_build_object('ok', false, 'pending', false, 'message', 'Llegaste al máximo de SteamID: pedíselo a un admin');
        else
          insert into steam_requests(player_id, user_id, steam_id, nick, server_id) values (acc.id, c.user_id, s64, v_nick, t.sid);
          res := jsonb_build_object('ok', true, 'pending', true, 'message', 'Pedido enviado: un admin lo tiene que aprobar');
        end if;
      end if;
      update claim_codes set used_at = now(), used_steam_id = s64, result = res->>'message' where code = c.code;
      v_player := coalesce(v_player, acc.id);
    end if;
  exception when others then
    res := jsonb_build_object('ok', false, 'pending', false, 'message', 'No se pudo vincular: probá de nuevo en un rato');
  end;

  insert into claim_log(steam_id, nick, user_id, player_id, server_id, code, ok, result)
  values (s64, v_nick, c.user_id, v_player, t.sid, nullif(v_code, ''), (res->>'ok')::boolean, res->>'message');
  return res || jsonb_build_object('alias', case when (res->>'ok')::boolean then v_alias end);
end $$;
revoke all on function public.claim_with_code(text, text, text, text) from public;
grant execute on function public.claim_with_code(text, text, text, text) to anon, authenticated;

-- =====================================================================================================
-- 6. Motor del ELO: un solo ELO por ficha (clave = SteamID principal)
-- =====================================================================================================
create function pg_temp.reemplazar(fn regprocedure, cambios text[][]) returns void language plpgsql as $$
declare d text := pg_get_functiondef(fn); i int;
begin
  for i in 1 .. array_length(cambios, 1) loop
    if position(cambios[i][1] in d) = 0 then
      raise exception 'replanteo 15: en % no se encontró: %', fn, left(cambios[i][1], 80);
    end if;
    d := replace(d, cambios[i][1], cambios[i][2]);
  end loop;
  execute d;
end $$;

select pg_temp.reemplazar('public.elo_apply_match(uuid)', array[
  ['select array_agg(steam_id order by steam_id) into ids',
   'select array_agg(distinct elo_key(steam_id) order by elo_key(steam_id)) into ids -- (replanteo 15) clave de ELO de la ficha'],
  ['e.steam_id = s.steam_id', 'e.steam_id = elo_key(s.steam_id)'],
  ['s.steam_id = any(ids)', 'elo_key(s.steam_id) = any(ids)']
]);

-- Un ajuste a un SteamID adicional mueve el ELO de la ficha.
select pg_temp.reemplazar('public.elo_apply_adjustment(text, integer)', array[
  [E'begin\n  select c.elo_floor, c.start_elo into cfg',
   E'begin\n  p_steam_id := elo_key(p_steam_id); -- (replanteo 15) clave de ELO de la ficha\n  select c.elo_floor, c.start_elo into cfg']
]);

-- =====================================================================================================
-- 7. Ingesta y !match con varios SteamID
-- =====================================================================================================
select pg_temp.reemplazar('public.csstv_ingest(uuid, jsonb)', array[
  ['if v_s64 is not null then select id into v_pid from players where steam_id = v_s64; end if;',
   'if v_s64 is not null then v_pid := steam_owner(v_s64); end if; -- (replanteo 15) principal o adicional']
]);

select pg_temp.reemplazar('public.csstv_match_lookup(text, text)', array[
  [E'(select string_agg(public.csstv_steam2(p.steam_id), \',\' order by p.steam_id) from match_roster(m.id, m.team1) r join players p on p.id = r\n                        where p.steam_id is not null)',
   E'(select string_agg(public.csstv_steam2(x.steam_id), \',\' order by x.steam_id) from match_roster(m.id, m.team1) r join player_steam_all x on x.player_id = r /* (replanteo 15) todos sus SteamID */)'],
  [E'(select string_agg(public.csstv_steam2(p.steam_id), \',\' order by p.steam_id) from match_roster(m.id, m.team2) r join players p on p.id = r\n                        where p.steam_id is not null)',
   E'(select string_agg(public.csstv_steam2(x.steam_id), \',\' order by x.steam_id) from match_roster(m.id, m.team2) r join player_steam_all x on x.player_id = r)']
]);

-- =====================================================================================================
-- 8. Perfil sin reclamar (SteamID con partidas y sin ficha)
-- =====================================================================================================
create view public.steam_profile_list with (security_invoker = true) as
select s.steam_id,
       (array_agg(s.nick order by coalesce(m.played_at, m.starts_at) desc nulls last))[1] as last_nick,
       (select array_agg(n order by last desc) from (
          select s2.nick as n, max(coalesce(m2.played_at, m2.starts_at)) as last
            from match_player_stats s2 join matches m2 on m2.id = s2.match_id
           where s2.steam_id = s.steam_id and s2.nick is not null
           group by s2.nick order by last desc limit 5) x) as nicks,
       count(distinct s.match_id)::integer as matches,
       min(coalesce(m.played_at, m.starts_at)) as first_played,
       max(coalesce(m.played_at, m.starts_at)) as last_played,
       e.elo, e.peak_elo, coalesce(e.matches, 0) as elo_matches,
       search_norm(concat_ws(' ', string_agg(distinct s.nick, ' '), s.steam_id)) as search
  from match_player_stats s
  join matches m on m.id = s.match_id
  left join player_elo e on e.steam_id = s.steam_id
 where s.player_id is null and is_steam64(s.steam_id) and steam_owner(s.steam_id) is null
 group by s.steam_id, e.elo, e.peak_elo, e.matches;
comment on view public.steam_profile_list is 'Perfiles sin reclamar: SteamID con partidas y sin ficha (no van al ranking)';

create view public.steam_profile_stats with (security_invoker = true) as
select s.steam_id,
       count(*)::integer                                                   as maps,
       coalesce(sum(s.rounds), 0)::integer                                 as rounds,
       coalesce(sum(s.kills), 0)::integer                                  as kills,
       coalesce(sum(s.deaths), 0)::integer                                 as deaths,
       coalesce(sum(s.assists), 0)::integer                                as assists,
       coalesce(sum(s.damage), 0)::integer                                 as damage,
       public.csstv_rating(sum(s.kills), sum(s.deaths), sum(s.rounds),
                           sum(s.k1), sum(s.k2), sum(s.k3), sum(s.k4), sum(s.k5)) as rating,
       round(sum(s.kills)::numeric / greatest(sum(s.deaths), 1), 2)        as kd,
       case when sum(s.kills) > 0 then round(sum(s.headshots) * 100.0 / sum(s.kills), 1) end as hs,
       case when sum(s.rounds) > 0 then round(sum(s.damage)::numeric / sum(s.rounds), 1) end as adr,
       count(*) filter (where m.winner_side = s.team)::integer             as wins,
       count(*) filter (where m.winner_side is not null and m.winner_side <> s.team)::integer as losses
  from public.match_player_stats s
  join public.matches m on m.id = s.match_id
 where s.player_id is null and is_steam64(s.steam_id) and m.status = 'finished'
 group by s.steam_id;

create view public.steam_profile_map_stats with (security_invoker = true) as
select s.steam_id,
       m.map                                                               as map_name,
       count(*)::integer                                                   as maps,
       public.csstv_rating(sum(s.kills), sum(s.deaths), sum(s.rounds),
                           sum(s.k1), sum(s.k2), sum(s.k3), sum(s.k4), sum(s.k5)) as rating,
       round(sum(s.kills)::numeric / greatest(sum(s.deaths), 1), 2)        as kd,
       case when sum(s.rounds) > 0 then round(sum(s.damage)::numeric / sum(s.rounds), 1) end as adr,
       count(*) filter (where m.winner_side = s.team)::integer             as wins,
       count(*) filter (where m.winner_side is not null and m.winner_side <> s.team)::integer as losses
  from public.match_player_stats s
  join public.matches m on m.id = s.match_id
 where s.player_id is null and is_steam64(s.steam_id) and m.status = 'finished' and m.map is not null
 group by s.steam_id, m.map;

create view public.steam_profile_matches with (security_invoker = true) as
select s.steam_id, m.id as match_id, m.kind, m.status, coalesce(m.played_at, m.starts_at) as played_at, m.map,
       m.side1_name, m.side2_name, t1.name as team1_name, t2.name as team2_name, m.score1, m.score2, m.winner_side,
       s.team as side, s.team = m.winner_side as won, m.parent_match_id, s.nick as game_nick,
       s.kills, s.deaths, s.assists, s.headshots, s.damage, s.rounds, s.rating, s.elo_before, s.elo_after, s.elo_delta, m.demo_status
  from match_player_stats s
  join matches m on m.id = s.match_id
  left join teams t1 on t1.id = m.team1
  left join teams t2 on t2.id = m.team2
 where s.player_id is null and is_steam64(s.steam_id) and m.status = 'finished';

grant select on public.steam_profile_list, public.steam_profile_stats, public.steam_profile_map_stats, public.steam_profile_matches
  to anon, authenticated;

-- =====================================================================================================
-- 9. Vistas de admin
-- =====================================================================================================
create view public.admin_steam_requests as
select r.id, r.status, case r.status when 'pending' then 0 else 1 end as status_order, r.created_at, r.resolved_at, r.reason,
       r.steam_id, r.nick, r.player_id, p.nick as player_nick, r.user_id, pr.tag as alias,
       r.server_id, g.name as server_name,
       (select count(distinct s.match_id)::int from match_player_stats s where s.steam_id = r.steam_id) as matches,
       (select count(*)::int from player_steam_all a where a.player_id = r.player_id) as player_steam_count,
       exists (select 1 from match_player_stats a join match_player_stats b on b.match_id = a.match_id
                where a.steam_id = r.steam_id and b.steam_id in (select x.steam_id from player_steam_all x where x.player_id = r.player_id)) as shares_match,
       search_norm(concat_ws(' ', r.nick, p.nick, pr.tag, r.steam_id)) as search
  from steam_requests r
  join players p on p.id = r.player_id
  left join profiles pr on pr.id = r.user_id
  left join game_servers g on g.id = r.server_id
 where is_admin();
grant select on public.admin_steam_requests to authenticated;

create view public.admin_claim_log as
select l.id, l.created_at, l.ok, l.result, l.steam_id, l.nick, l.code, l.user_id, pr.tag as alias, l.player_id, p.nick as player_nick,
       l.server_id, g.name as server_name, search_norm(concat_ws(' ', l.nick, pr.tag, p.nick, l.steam_id)) as search
  from claim_log l
  left join profiles pr on pr.id = l.user_id
  left join players p on p.id = l.player_id
  left join game_servers g on g.id = l.server_id
 where is_admin();
grant select on public.admin_claim_log to authenticated;

-- =====================================================================================================
-- 10. Reclamos viejos: los aprobados pasan al registro y la tabla se borra
-- =====================================================================================================
insert into public.claim_log(user_id, player_id, ok, result, created_at)
select r.user_id, r.player_id, r.status = 'approved', 'Reclamo de perfil (sistema viejo): ' || r.status, r.created_at
  from public.profile_requests r
 where exists (select 1 from auth.users u where u.id = r.user_id);
drop table public.profile_requests;

commit;
