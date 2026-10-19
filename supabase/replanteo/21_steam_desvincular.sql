-- Replanteo 21: el jugador pide desvincular un SteamID y elige su principal (plan docs/bitacora/2026-10-19-api-steam-desvincular-principal).
--   - steam_requests.kind: 'add' (SteamID adicional, con !claim) o 'remove' (desvincular, desde la web). note: el motivo del jugador.
--   - request_steam_unlink: el pedido lo aprueba un admin con approve_steam_request; la ficha no puede quedar sin SteamID.
--   - set_my_primary_steam: el jugador cambia su principal sin aprobación, una vez cada 24 horas.
--     El cambio de principal (también el del admin) pasa la fila de player_elo a la clave nueva en vez de recalcular todo.
--   - players.steam_added_at: cuándo se vinculó el principal (player_steam_all la trae en added_at). Cada SteamID
--     conserva su fecha al cambiar el principal (steam_attach, steam_detach y steam_make_primary).
--   - admin_remove_steam y link_steam_id (desvincular) dan por aprobado el pedido pendiente.
-- NO aplicar en producción antes del corte (ver README.md).
begin;

do $$
begin
  if to_regclass('public.steam_requests') is null then
    raise exception 'replanteo 21: falta steam_requests (aplicar antes 15_claim.sql)';
  end if;
  if exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'steam_requests' and column_name = 'kind') then
    raise exception 'replanteo 21: steam_requests ya tiene kind (¿ya se aplicó?)';
  end if;
end $$;

-- =====================================================================================================
-- 1. Columnas
-- =====================================================================================================
alter table public.steam_requests
  add column kind text not null default 'add' constraint steam_requests_kind_check check (kind in ('add', 'remove')),
  add column note text constraint steam_requests_note_check check (char_length(note) <= 200);
comment on column public.steam_requests.kind is 'add: SteamID adicional (con !claim); remove: desvincular un SteamID de la ficha (replanteo 21)';
comment on column public.steam_requests.note is 'Motivo que escribió el jugador; lo ve el admin (replanteo 21)';
comment on table public.steam_requests is 'Pedidos de SteamID (adicional o desvincular); los aprueba un admin. Uno pendiente reserva el SteamID';

alter table public.players add column primary_steam_changed_at timestamptz;
comment on column public.players.primary_steam_changed_at is 'Último cambio de SteamID principal hecho por el jugador: uno cada 24 horas (replanteo 21)';

-- Fecha en que se vinculó cada SteamID. Se conserva al cambiar el principal (pasa con el SteamID).
-- null: se vinculó antes de que se guardara la fecha (lo vinculó un admin en el sistema viejo).
alter table public.players add column steam_added_at timestamptz;
comment on column public.players.steam_added_at is 'Cuándo se vinculó el SteamID principal; null si no se sabe (replanteo 21)';
alter table public.player_extra_steam_ids alter column added_at drop not null;
comment on column public.player_extra_steam_ids.added_at is 'Cuándo se vinculó; null si no se sabe (un principal viejo que pasó a adicional)';
-- Lo que se sabe de los principales actuales: el primer !claim aceptado o la aprobación del pedido.
update public.players p
   set steam_added_at = least(
         (select min(l.created_at) from claim_log l where l.ok and l.steam_id = p.steam_id and l.player_id = p.id),
         (select min(r.resolved_at) from steam_requests r where r.status = 'approved' and r.steam_id = p.steam_id and r.player_id = p.id))
 where p.steam_id is not null;

create or replace view public.player_steam_all as
select p.id as player_id, p.steam_id, true as is_primary, p.steam_added_at as added_at from players p where p.steam_id is not null -- (replanteo 21)
union all
select x.player_id, x.steam_id, false, x.added_at from player_extra_steam_ids x;

-- Como en la 15, guardando la fecha del principal.
create or replace function public.steam_attach(p_steam text, p_player uuid, p_by uuid) returns boolean
  language plpgsql security definer set search_path = public as $$
declare v_primary text;
begin
  select steam_id into v_primary from players where id = p_player for update;
  if not found then raise exception 'No existe esa ficha'; end if;
  if v_primary is null then
    update players set steam_id = p_steam, steam_added_at = now() where id = p_player; -- (replanteo 21)
  else
    insert into player_extra_steam_ids(steam_id, player_id, added_by) values (p_steam, p_player, p_by);
  end if;
  perform steam_history_to(p_steam, p_player);
  return v_primary is not null
     and (exists (select 1 from player_elo where steam_id = p_steam) or exists (select 1 from elo_adjustments where steam_id = p_steam));
end $$;

-- Como en la 15: el adicional más viejo (los sin fecha son de antes) pasa a ser el principal, con su fecha.
create or replace function public.steam_detach(p_steam text) returns boolean
  language plpgsql security definer set search_path = public as $$
declare v_player uuid; v_next text; v_next_at timestamptz; v_many boolean;
begin
  v_player := steam_owner(p_steam);
  if v_player is null then raise exception 'Ese SteamID no es de ninguna ficha'; end if;
  perform 1 from players where id = v_player for update;
  v_many := exists (select 1 from player_extra_steam_ids where player_id = v_player);
  if exists (select 1 from player_extra_steam_ids where steam_id = p_steam) then
    delete from player_extra_steam_ids where steam_id = p_steam;
  else
    select steam_id, added_at into v_next, v_next_at from player_extra_steam_ids where player_id = v_player
     order by added_at nulls first, steam_id limit 1; -- (replanteo 21)
    if v_next is not null then
      delete from player_extra_steam_ids where steam_id = v_next;
    end if;
    update players set steam_id = v_next, steam_added_at = v_next_at where id = v_player;
  end if;
  perform steam_history_release(p_steam, v_player);
  return v_many;
end $$;

-- =====================================================================================================
-- 2. Cambio de principal (lo usan el admin y el jugador)
-- =====================================================================================================
-- El ELO de la ficha está en player_elo con la clave del principal (elo_key) y los adicionales no tienen
-- fila propia: alcanza con pasar la fila a la clave nueva, sin recalcular todo. El resultado es el mismo
-- que el de elo_recompute_all (el orden de las claves no cambia el cálculo). Si un adicional tuviera fila
-- (no debería), se recalcula todo, y eso solo lo puede hacer un admin.
create function public.steam_make_primary(p_steam text, p_by uuid) returns void
  language plpgsql security definer set search_path = public as $$
declare v_player uuid; v_new_at timestamptz; v_old text; v_old_at timestamptz;
begin
  select player_id, added_at into v_player, v_new_at from player_extra_steam_ids where steam_id = p_steam;
  if v_player is null then raise exception 'Ese SteamID no es adicional de ninguna ficha'; end if;
  select steam_id, steam_added_at into v_old, v_old_at from players where id = v_player for update;
  delete from player_extra_steam_ids where steam_id = p_steam;
  -- El viejo principal se guarda como adicional después de cambiar el principal (el trigger lo exige).
  -- Cada SteamID conserva la fecha en que se vinculó.
  update players set steam_id = p_steam, steam_added_at = v_new_at where id = v_player;
  insert into player_extra_steam_ids(steam_id, player_id, added_at, added_by) values (v_old, v_player, v_old_at, p_by);
  lock table player_elo in exclusive mode;   -- como elo_recompute_all: frena los envíos mientras cambia la clave
  if exists (select 1 from player_elo where steam_id = p_steam) then
    perform elo_recompute_all();
  else
    update player_elo set steam_id = p_steam, updated_at = now() where steam_id = v_old;
  end if;
end $$;
revoke all on function public.steam_make_primary(text, uuid) from public, anon, authenticated;

create or replace function public.admin_set_primary_steam(p_steam text) returns void
  language plpgsql security definer set search_path = public as $$
begin
  if not is_admin() then raise exception 'Solo un admin puede cambiar el SteamID principal' using errcode = '42501'; end if;
  -- (replanteo 21) el cambio en sí está en steam_make_primary
  if exists (select 1 from players where steam_id = p_steam) then return; end if;
  if not exists (select 1 from player_extra_steam_ids where steam_id = p_steam) then
    raise exception 'Ese SteamID no es de ninguna ficha';
  end if;
  perform steam_make_primary(p_steam, auth.uid());
end $$;

create function public.set_my_primary_steam(p_steam text) returns void
  language plpgsql security definer set search_path = public as $$
declare acc players%rowtype;
begin
  if auth.uid() is null then raise exception 'Iniciá sesión para cambiar tu SteamID principal' using errcode = '42501'; end if;
  select * into acc from players where user_id = auth.uid() for update;
  if not found then raise exception 'Tu cuenta no tiene ficha de jugador: vinculá un SteamID con !claim'; end if;
  if acc.steam_id = p_steam then return; end if;
  if not exists (select 1 from player_extra_steam_ids where steam_id = p_steam and player_id = acc.id) then
    raise exception 'Ese SteamID no es de tu ficha';
  end if;
  perform steam_requests_expire();
  if exists (select 1 from steam_requests where steam_id = p_steam and kind = 'remove' and status = 'pending') then
    raise exception 'Ese SteamID tiene un pedido para desvincularlo: no puede ser el principal';
  end if;
  if acc.primary_steam_changed_at > now() - interval '24 hours' then
    raise exception 'Ya cambiaste tu SteamID principal en las últimas 24 horas: probá de nuevo después';
  end if;
  update players set primary_steam_changed_at = now() where id = acc.id;
  perform steam_make_primary(p_steam, auth.uid());
end $$;
revoke all on function public.set_my_primary_steam(text) from public, anon;
grant execute on function public.set_my_primary_steam(text) to authenticated;

-- =====================================================================================================
-- 3. Pedido para desvincular
-- =====================================================================================================
create function public.request_steam_unlink(p_steam text, p_note text default null) returns bigint
  language plpgsql security definer set search_path = public as $$
declare acc players%rowtype; v_id bigint;
begin
  if auth.uid() is null then raise exception 'Iniciá sesión para desvincular un SteamID' using errcode = '42501'; end if;
  select * into acc from players where user_id = auth.uid() for update;
  if not found or steam_owner(p_steam) is distinct from acc.id then
    raise exception 'Ese SteamID no es de tu ficha';
  end if;
  perform steam_requests_expire();
  if exists (select 1 from steam_requests where steam_id = p_steam and status = 'pending') then
    raise exception 'Ya pediste desvincular ese SteamID: falta que lo apruebe un admin';
  end if;
  -- La ficha tiene que quedar con al menos un SteamID (contando los otros pedidos pendientes).
  if (select count(*) from player_steam_all where player_id = acc.id)
     - (select count(*) from steam_requests where player_id = acc.id and kind = 'remove' and status = 'pending') <= 1 then
    raise exception 'Es tu único SteamID: no se puede desvincular';
  end if;
  insert into steam_requests(player_id, user_id, steam_id, kind, note)
  values (acc.id, auth.uid(), p_steam, 'remove', nullif(left(trim(coalesce(p_note, '')), 200), ''))
  returning id into v_id;
  return v_id;
end $$;
revoke all on function public.request_steam_unlink(text, text) from public, anon;
grant execute on function public.request_steam_unlink(text, text) to authenticated;

-- =====================================================================================================
-- 4. Aprobar (adicional o desvincular) y quitar directo
-- =====================================================================================================
create or replace function public.approve_steam_request(p_id bigint) returns void
  language plpgsql security definer set search_path = public as $$
declare r steam_requests%rowtype;
begin
  if not is_admin() then raise exception 'Solo un admin puede aprobar SteamIDs' using errcode = '42501'; end if;
  perform steam_requests_expire();
  select * into r from steam_requests where id = p_id for update;
  if not found then raise exception 'No existe esa solicitud'; end if;
  if r.status <> 'pending' then raise exception 'La solicitud ya no está pendiente (%)', r.status; end if;
  if r.kind = 'remove' then
    -- (replanteo 21) desvincular: sigue siendo de la ficha y no es el único
    if steam_owner(r.steam_id) is distinct from r.player_id then raise exception 'Ese SteamID ya no es de esa ficha'; end if;
    if (select count(*) from player_steam_all where player_id = r.player_id) <= 1 then
      raise exception 'Es el único SteamID de la ficha: para sacarlo, quitalo desde la ficha';
    end if;
    update steam_requests set status = 'approved', resolved_at = now(), resolved_by = auth.uid() where id = p_id;
    if steam_detach(r.steam_id) then perform elo_recompute_all(); end if;
    return;
  end if;
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

-- El admin lo saca directo: el pedido pendiente de desvincularlo queda aprobado.
create or replace function public.admin_remove_steam(p_steam text) returns void
  language plpgsql security definer set search_path = public as $$
begin
  if not is_admin() then raise exception 'Solo un admin puede quitar SteamIDs' using errcode = '42501'; end if;
  update steam_requests set status = 'approved', resolved_at = now(), resolved_by = auth.uid()
   where steam_id = p_steam and kind = 'remove' and status = 'pending'; -- (replanteo 21)
  if steam_detach(p_steam) then perform elo_recompute_all(); end if;
end $$;

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
    update steam_requests set status = 'approved', resolved_at = now(), resolved_by = auth.uid()
     where steam_id = s64 and kind = 'remove' and status = 'pending'; -- (replanteo 21)
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

-- =====================================================================================================
-- 5. Vista del admin: tipo y motivo (al final); shares_match solo para un adicional
-- =====================================================================================================
create or replace view public.admin_steam_requests as
select r.id, r.status, case r.status when 'pending' then 0 else 1 end as status_order, r.created_at, r.resolved_at, r.reason,
       r.steam_id, r.nick, r.player_id, p.nick as player_nick, r.user_id, pr.tag as alias,
       r.server_id, g.name as server_name,
       (select count(distinct s.match_id)::int from match_player_stats s where s.steam_id = r.steam_id) as matches,
       (select count(*)::int from player_steam_all a where a.player_id = r.player_id) as player_steam_count,
       r.kind = 'add' and exists (select 1 from match_player_stats a join match_player_stats b on b.match_id = a.match_id
                where a.steam_id = r.steam_id and b.steam_id in (select x.steam_id from player_steam_all x where x.player_id = r.player_id)) as shares_match,
       search_norm(concat_ws(' ', r.nick, p.nick, pr.tag, r.steam_id)) as search,
       r.kind, r.note
  from steam_requests r
  join players p on p.id = r.player_id
  left join profiles pr on pr.id = r.user_id
  left join game_servers g on g.id = r.server_id
 where is_admin();

commit;
