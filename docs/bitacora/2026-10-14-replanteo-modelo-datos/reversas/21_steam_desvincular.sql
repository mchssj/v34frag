-- Inversa de supabase/replanteo/21_steam_desvincular.sql: deja los pedidos de SteamID como después de la 15.
-- Se borran los pedidos de desvincular (kind = 'remove'), sus motivos y la fecha del último cambio de principal.
begin;

do $$
begin
  if not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'steam_requests' and column_name = 'kind') then
    raise exception 'inversa 21: steam_requests no tiene kind (¿no se aplicó la 21?)';
  end if;
end $$;

drop view public.admin_steam_requests;
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

drop function public.request_steam_unlink(text, text);
drop function public.set_my_primary_steam(text);

create or replace function public.admin_set_primary_steam(p_steam text) returns void
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
drop function public.steam_make_primary(text, uuid);

create or replace function public.approve_steam_request(p_id bigint) returns void
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

create or replace function public.admin_remove_steam(p_steam text) returns void
  language plpgsql security definer set search_path = public as $$
begin
  if not is_admin() then raise exception 'Solo un admin puede quitar SteamIDs' using errcode = '42501'; end if;
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

create or replace view public.player_steam_all as
select p.id as player_id, p.steam_id, true as is_primary, null::timestamptz as added_at from players p where p.steam_id is not null
union all
select x.player_id, x.steam_id, false, x.added_at from player_extra_steam_ids x;

create or replace function public.steam_attach(p_steam text, p_player uuid, p_by uuid) returns boolean
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

create or replace function public.steam_detach(p_steam text) returns boolean
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

-- Los adicionales sin fecha toman la de ahora (la 15 la exige).
update public.player_extra_steam_ids set added_at = now() where added_at is null;
alter table public.player_extra_steam_ids alter column added_at set not null;
comment on column public.player_extra_steam_ids.added_at is null;
alter table public.players drop column steam_added_at;

delete from public.steam_requests where kind = 'remove';
alter table public.steam_requests drop column kind, drop column note;
comment on table public.steam_requests is 'Solicitudes de SteamID adicional (con !claim); las aprueba un admin. Una pendiente reserva el SteamID';
alter table public.players drop column primary_steam_changed_at;

commit;
