-- Inversa de supabase/replanteo/15_claim.sql.
-- Los datos nuevos (códigos, registro de reclamos, SteamID adicionales y solicitudes) se pierden, y los reclamos
-- viejos no vuelven (la tabla se recrea vacía; para recuperar su contenido, el respaldo previo al corte).
-- Antes de aplicarla, quitar los SteamID adicionales (admin_remove_steam) para que sus partidas vuelvan a quedar sin ficha.
begin;

create function pg_temp.reemplazar(fn regprocedure, cambios text[][]) returns void language plpgsql as $$
declare d text := pg_get_functiondef(fn); i int;
begin
  for i in 1 .. array_length(cambios, 1) loop
    if position(cambios[i][1] in d) = 0 then
      raise exception 'inversa 15: en % no se encontró: %', fn, left(cambios[i][1], 80);
    end if;
    d := replace(d, cambios[i][1], cambios[i][2]);
  end loop;
  execute d;
end $$;

-- Reclamos viejos (tabla vacía, con sus políticas y permisos).
create table public.profile_requests (
  id uuid default gen_random_uuid() not null,
  player_id uuid not null,
  user_id uuid not null,
  status text default 'pending'::text not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);
alter table only public.profile_requests add constraint profile_requests_pkey primary key (id);
create index idx_solicitudes_perfil on public.profile_requests using btree (player_id);
alter table only public.profile_requests add constraint profile_requests_player_id_fkey foreign key (player_id) references public.players(id) on delete cascade;
alter table only public.profile_requests add constraint profile_requests_user_id_fkey foreign key (user_id) references auth.users(id) on delete cascade;
alter table public.profile_requests enable row level security;
create policy "Admins pueden actualizar y borrar solicitudes" on public.profile_requests for update to authenticated using ((exists ( select 1
   from public.profiles
  where ((profiles.id = auth.uid()) and (profiles.role = 'admin'::text)))));
create policy "Admins pueden eliminar solicitudes" on public.profile_requests for delete to authenticated using ((exists ( select 1
   from public.profiles
  where ((profiles.id = auth.uid()) and (profiles.role = 'admin'::text)))));
create policy "Usuarios ven sus solicitudes y admins ven todas" on public.profile_requests for select to authenticated using (((auth.uid() = user_id) or (exists ( select 1
   from public.profiles
  where ((profiles.id = auth.uid()) and (profiles.role = 'admin'::text))))));
create policy "solicitudes: crear la propia" on public.profile_requests for insert with check (((auth.uid() = user_id) and (status = 'pending'::text) and (exists ( select 1
   from public.players p
  where ((p.id = profile_requests.player_id) and (p.user_id is null))))));
grant all on table public.profile_requests to anon, authenticated, service_role;

-- Ingesta, !match y motor del ELO como estaban.
select pg_temp.reemplazar('public.csstv_ingest(uuid, jsonb)', array[
  ['if v_s64 is not null then v_pid := steam_owner(v_s64); end if; -- (replanteo 15) principal o adicional',
   'if v_s64 is not null then select id into v_pid from players where steam_id = v_s64; end if;']
]);
select pg_temp.reemplazar('public.csstv_match_lookup(text, text)', array[
  [E'(select string_agg(public.csstv_steam2(x.steam_id), \',\' order by x.steam_id) from match_roster(m.id, m.team1) r join player_steam_all x on x.player_id = r /* (replanteo 15) todos sus SteamID */)',
   E'(select string_agg(public.csstv_steam2(p.steam_id), \',\' order by p.steam_id) from match_roster(m.id, m.team1) r join players p on p.id = r\n                        where p.steam_id is not null)'],
  [E'(select string_agg(public.csstv_steam2(x.steam_id), \',\' order by x.steam_id) from match_roster(m.id, m.team2) r join player_steam_all x on x.player_id = r)',
   E'(select string_agg(public.csstv_steam2(p.steam_id), \',\' order by p.steam_id) from match_roster(m.id, m.team2) r join players p on p.id = r\n                        where p.steam_id is not null)']
]);
select pg_temp.reemplazar('public.elo_apply_match(uuid)', array[
  ['select array_agg(distinct elo_key(steam_id) order by elo_key(steam_id)) into ids -- (replanteo 15) clave de ELO de la ficha',
   'select array_agg(steam_id order by steam_id) into ids'],
  ['e.steam_id = elo_key(s.steam_id)', 'e.steam_id = s.steam_id'],
  ['elo_key(s.steam_id) = any(ids)', 's.steam_id = any(ids)']
]);
select pg_temp.reemplazar('public.elo_apply_adjustment(text, integer)', array[
  [E'  p_steam_id := elo_key(p_steam_id); -- (replanteo 15) clave de ELO de la ficha\n', '']
]);

-- link_steam_id como estaba (copiada de la base antes de la 15).
CREATE OR REPLACE FUNCTION public.link_steam_id(p_steam text, p_player uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  s64  text := csstv_steam64(p_steam);
  cur  uuid;
  prev text;
begin
  if not is_admin() then raise exception 'Solo un admin puede vincular SteamIDs' using errcode = '42501'; end if;
  if s64 is null then raise exception 'SteamID inválido. Usá STEAM_0:X:Y, SteamID64 o el link del perfil.' using errcode = '22023'; end if;

  select id into cur from players where steam_id = s64;

  if p_player is null then
    if cur is null then return; end if;
    update players set steam_id = null where id = cur;
    update match_player_stats set player_id = null where steam_id = s64;
    update matches m
       set lineup1      = case when s.team = 1 then array_remove(m.lineup1, cur) else m.lineup1 end,
           lineup2      = case when s.team = 2 then array_remove(m.lineup2, cur) else m.lineup2 end,
           side1_guests = case when s.team = 1 and not (s.nick = any(m.side1_guests)) then array_append(m.side1_guests, s.nick) else m.side1_guests end,
           side2_guests = case when s.team = 2 and not (s.nick = any(m.side2_guests)) then array_append(m.side2_guests, s.nick) else m.side2_guests end
      from match_player_stats s
     where s.steam_id = s64 and s.match_id = m.id and m.kind = 'mix';
    -- (replanteo 06) las stats de cur salen de la vista player_stats
    return;
  end if;

  if cur is not null and cur <> p_player then
    raise exception 'Ese SteamID ya está vinculado a otro jugador' using errcode = '23505';
  end if;
  if cur = p_player then return; end if;

  select steam_id into prev from players where id = p_player;
  if prev is not null then perform link_steam_id(prev, null); end if;

  update players set steam_id = s64 where id = p_player;
  update match_player_stats set player_id = p_player where steam_id = s64;
  update matches m
     set lineup1      = case when s.team = 1 and not (p_player = any(m.lineup1)) then array_append(m.lineup1, p_player) else m.lineup1 end,
         lineup2      = case when s.team = 2 and not (p_player = any(m.lineup2)) then array_append(m.lineup2, p_player) else m.lineup2 end,
         side1_guests = case when s.team = 1 then array_remove(m.side1_guests, s.nick) else m.side1_guests end,
         side2_guests = case when s.team = 2 then array_remove(m.side2_guests, s.nick) else m.side2_guests end
    from match_player_stats s
   where s.steam_id = s64 and s.match_id = m.id and m.kind = 'mix';
  -- (replanteo 06) las stats de p_player salen de la vista player_stats
end $function$

;

drop view public.admin_claim_log;
drop view public.admin_steam_requests;
drop view public.steam_profile_matches;
drop view public.steam_profile_map_stats;
drop view public.steam_profile_stats;
drop view public.steam_profile_list;
drop function public.claim_with_code(text, text, text, text);
drop function public.create_claim_code();
drop table public.claim_log;
drop table public.claim_codes;
drop function public.reject_steam_request(bigint, text);
drop function public.approve_steam_request(bigint);
drop function public.admin_set_primary_steam(text);
drop function public.admin_remove_steam(text);
drop function public.steam_detach(text);
drop function public.steam_attach(text, uuid, uuid);
drop function public.steam_history_release(text, uuid);
drop function public.steam_history_to(text, uuid);
drop function public.steam_requests_expire();
drop trigger player_extra_steam_ids_unico on public.player_extra_steam_ids;
drop trigger players_steam_unico on public.players;
drop function public.steam_unico();
drop function public.elo_key(text);
drop function public.steam_owner(text);
drop view public.player_steam_all;
drop table public.steam_requests;
drop table public.player_extra_steam_ids;
drop function public.is_steam64(text);
drop function public.set_claim_config(integer);
drop table public.claim_config;
commit;
