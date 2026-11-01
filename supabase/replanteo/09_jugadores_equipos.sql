-- Replanteo 09: jugadores y equipos (plan docs/bitacora/2026-10-15-api-jugadores-equipos).
--   1. Alias web único (profiles.tag): espera de 15 días para el usuario, el admin siempre; el nick de un
--      jugador vinculado es su alias.
--   2. Palabras bloqueadas (blocked_words) para alias, equipos y solicitudes de equipo.
--   3. Plantel estilo FACEIT (team_invites): el capitán invita, el jugador pide entrar. Tope de 10 activos,
--      SteamID obligatorio y un jugador no puede estar en dos equipos del mismo torneo ni en los dos lados
--      de una partida pendiente.
--   4. Bando de PCW "como equipo" (teams.parent_team_id): la PCW ganada suma al equipo oficial.
--   5. Ranking de equipos (ranking_config, team_standings) y listado de jugadores (player_overview).
--   6. Solicitudes de equipo nuevo (approve/reject_team_request) y bajas seguras.
-- NO aplicar en producción antes del corte (ver README.md).
begin;

do $$
begin
  if to_regclass('public.pcw_config') is null then
    raise exception 'replanteo 09: falta pcw_config (aplicar antes 08_formatos_pcw.sql)';
  end if;
  if to_regclass('public.blocked_words') is not null then
    raise exception 'replanteo 09: blocked_words ya existe (¿ya se aplicó?)';
  end if;
  if exists (select lower(trim(tag)) from public.profiles group by 1 having count(*) > 1) then
    raise exception 'replanteo 09: hay alias repetidos en profiles.tag (sin distinguir mayúsculas); corregirlos antes';
  end if;
end $$;

-- ---------- 1. palabras bloqueadas ----------
-- Normaliza un nombre para compararlo: minúsculas, sin tildes, leetspeak (0→o, 1→i, 3→e, 4→a, 5→s, 7→t,
-- @→a, $→s) y solo letras (sin espacios ni signos).
create function public.name_norm(p text) returns text
  language sql immutable set search_path = public as $$
  select regexp_replace(
           translate(lower(coalesce(p, '')), 'áàäâãåéèëêíìïîóòöôõúùüûñç013457@$', 'aaaaaaeeeeiiiiooooouuuuncoieastas'),
           '[^a-z]', '', 'g')
$$;

-- Para búsquedas: minúsculas y sin tildes (el backend normaliza el texto buscado igual).
create function public.search_norm(p text) returns text
  language sql immutable set search_path = public as $$
  select translate(lower(coalesce(p, '')), 'áàäâãåéèëêíìïîóòöôõúùüûñç', 'aaaaaaeeeeiiiiooooouuuunc')
$$;

create table public.blocked_words (
  id         uuid primary key default gen_random_uuid(),
  word       text not null unique,
  created_at timestamptz not null default now(),
  created_by uuid
);
comment on table public.blocked_words is 'Palabras que no pueden aparecer en alias, nombres de equipo ni solicitudes (normalizadas con name_norm). Solo admin';

create function public.blocked_words_norm() returns trigger
  language plpgsql set search_path = public as $$
begin
  new.word := name_norm(new.word);
  if char_length(new.word) < 2 then
    raise exception 'La palabra tiene que tener al menos 2 letras (después de normalizarla)';
  end if;
  new.created_by := coalesce(new.created_by, auth.uid());
  return new;
end $$;
create trigger blocked_words_norm before insert or update on public.blocked_words
  for each row execute function public.blocked_words_norm();

alter table public.blocked_words enable row level security;
create policy blocked_words_admin on public.blocked_words for all to authenticated using (is_admin()) with check (is_admin());
revoke all on public.blocked_words from anon;

-- La primera palabra bloqueada que contiene el nombre, o null.
create function public.name_blocked(p text) returns text
  language sql stable security definer set search_path = public as $$
  select b.word from blocked_words b where position(b.word in name_norm(p)) > 0 order by length(b.word) desc, b.word limit 1
$$;
revoke all on function public.name_blocked(text) from public, anon, authenticated;

-- Para el admin: la palabra bloqueada que contiene un nombre, o null (el backend la usa para pedir "forzar").
create function public.admin_name_blocked(p text) returns text
  language plpgsql stable security definer set search_path = public as $$
begin
  if not is_admin() then raise exception 'Solo un administrador puede revisar nombres' using errcode = '42501'; end if;
  return name_blocked(p);
end $$;
revoke all on function public.admin_name_blocked(text) from public, anon;
grant execute on function public.admin_name_blocked(text) to authenticated;

-- Para el admin: alias, nicks de jugadores sin cuenta y nombres o siglas de equipos oficiales que hoy
-- contienen una palabra bloqueada.
create function public.blocked_names_hits() returns table (kind text, id uuid, name text, word text)
  language plpgsql stable security definer set search_path = public as $$
begin
  if not is_admin() then raise exception 'Solo un administrador puede ver los nombres bloqueados' using errcode = '42501'; end if;
  return query
    select x.kind, x.id, x.name, name_blocked(x.name)
      from (select 'alias'::text as kind, p.id, p.tag as name from profiles p
            union all
            select 'player', pl.id, pl.nick from players pl where pl.user_id is null
            union all
            select 'team', t.id, t.name from teams t where t.kind = 'official'
            union all
            select 'team', t.id, t.tag from teams t where t.kind = 'official') x
     where name_blocked(x.name) is not null
     order by 1, 3;
end $$;
revoke all on function public.blocked_names_hits() from public, anon;
grant execute on function public.blocked_names_hits() to authenticated;

-- ---------- 2. alias ----------
alter table public.profiles add column tag_changed_at timestamptz;
comment on column public.profiles.tag is 'Alias web del usuario: único sin distinguir mayúsculas; es el nick de su jugador vinculado';
comment on column public.profiles.tag_changed_at is 'Último cambio del alias hecho por el usuario (espera de 15 días)';
create unique index profiles_tag_unico on public.profiles (lower(trim(tag)));

-- Si un alias se puede usar: ok, length, chars, blocked o taken. El alias propio (auth.uid()) no cuenta como tomado.
create function public.alias_check(p_tag text) returns text
  language plpgsql stable security definer set search_path = public as $$
declare v text := trim(coalesce(p_tag, ''));
begin
  if char_length(v) < 2 or char_length(v) > 24 then return 'length'; end if;
  if v ~ '[<>[:cntrl:]]' then return 'chars'; end if;
  if name_blocked(v) is not null then return 'blocked'; end if;
  if exists (select 1 from profiles where lower(trim(tag)) = lower(v) and id is distinct from auth.uid()) then return 'taken'; end if;
  return 'ok';
end $$;
revoke all on function public.alias_check(text) from public;
grant execute on function public.alias_check(text) to anon, authenticated;

create or replace function public.set_my_tag(p_tag text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
-- (replanteo 09) alias único, con palabras bloqueadas y una espera de 15 días entre cambios
declare
  v    text := trim(coalesce(p_tag, ''));
  cur  profiles%rowtype;
  chk  text;
  dias int;
begin
  if auth.uid() is null then raise exception 'Tenés que iniciar sesión'; end if;
  select * into cur from profiles where id = auth.uid() for update;
  if found and cur.tag = v then return; end if;
  chk := alias_check(v);
  if chk = 'length' then raise exception 'El alias tiene que tener entre 2 y 24 caracteres'; end if;
  if chk = 'chars' then raise exception 'El alias no puede tener < ni >'; end if;
  if chk = 'blocked' then raise exception 'El alias contiene una palabra no permitida'; end if;
  if chk = 'taken' then raise exception 'Ese alias ya está en uso' using errcode = '23505'; end if;
  -- Cambiar solo mayúsculas no cuenta como cambio.
  if found and lower(cur.tag) <> lower(v) and cur.tag_changed_at > now() - interval '15 days' then
    dias := ceil(extract(epoch from cur.tag_changed_at + interval '15 days' - now()) / 86400);
    raise exception 'Podés volver a cambiar tu alias en % día%', dias, case when dias = 1 then '' else 's' end;
  end if;
  begin
    insert into profiles(id, tag, tag_changed_at) values (auth.uid(), v, now())
    on conflict (id) do update
      set tag = excluded.tag,
          tag_changed_at = case when lower(profiles.tag) = lower(excluded.tag) then profiles.tag_changed_at else now() end;
  exception when unique_violation then
    raise exception 'Ese alias ya está en uso' using errcode = '23505';
  end;
end $function$;

-- El admin cambia el alias de cualquiera (moderación), sin espera. Con p_force guarda aunque tenga una palabra bloqueada.
create function public.set_user_tag(p_user uuid, p_tag text, p_force boolean default false) returns void
  language plpgsql security definer set search_path = public as $$
declare v text := trim(coalesce(p_tag, '')); chk text;
begin
  if not is_admin() then raise exception 'Solo un administrador puede cambiar el alias de otro usuario' using errcode = '42501'; end if;
  if not exists (select 1 from profiles where id = p_user) then raise exception 'No existe ese usuario'; end if;
  if char_length(v) < 2 or char_length(v) > 24 then raise exception 'El alias tiene que tener entre 2 y 24 caracteres'; end if;
  if v ~ '[<>[:cntrl:]]' then raise exception 'El alias no puede tener < ni >'; end if;
  if not coalesce(p_force, false) and name_blocked(v) is not null then
    raise exception 'El alias contiene una palabra no permitida (%). Para guardarlo igual, forzalo', name_blocked(v);
  end if;
  if exists (select 1 from profiles where lower(trim(tag)) = lower(v) and id <> p_user) then
    raise exception 'Ese alias ya está en uso' using errcode = '23505';
  end if;
  update profiles set tag = v where id = p_user;
end $$;
revoke all on function public.set_user_tag(uuid, text, boolean) from public, anon;
grant execute on function public.set_user_tag(uuid, text, boolean) to authenticated;

-- El nick de un jugador vinculado es el alias de su cuenta.
create function public.players_nick_alias() returns trigger
  language plpgsql security definer set search_path = public as $$
begin
  if new.user_id is not null then
    new.nick := coalesce((select tag from profiles where id = new.user_id), new.nick);
  end if;
  return new;
end $$;
create trigger players_nick_alias before insert or update of nick, user_id on public.players
  for each row execute function public.players_nick_alias();

create function public.profiles_alias_nick() returns trigger
  language plpgsql security definer set search_path = public as $$
begin
  update players set nick = new.tag where user_id = new.id and nick is distinct from new.tag;
  return null;
end $$;
create trigger profiles_alias_nick after insert or update of tag on public.profiles
  for each row execute function public.profiles_alias_nick();

update public.players p set nick = pr.tag from public.profiles pr where pr.id = p.user_id and p.nick is distinct from pr.tag;

-- ---------- 3. bando de PCW "como equipo" ----------
alter table public.teams add column parent_team_id uuid references public.teams(id) on delete set null;
comment on column public.teams.parent_team_id is 'Bandos de PCW: equipo oficial con el que juega (sus jugadores son de ese plantel). La PCW ganada suma a ese equipo en el ranking';
create index teams_parent on public.teams (parent_team_id) where parent_team_id is not null;

create function public.teams_rules() returns trigger
  language plpgsql security definer set search_path = public as $$
declare p record; fuera text;
begin
  -- Palabras bloqueadas, solo para usuarios: el admin las controla desde el backend (con la opción de forzar)
  -- y las cargas sin usuario (mantenimiento) no se frenan.
  if auth.uid() is not null and not is_admin() and (name_blocked(new.name) is not null or name_blocked(new.tag) is not null) then
    raise exception 'El nombre o la sigla del equipo contiene una palabra no permitida';
  end if;
  if new.parent_team_id is not null and (tg_op = 'INSERT' or new.parent_team_id is distinct from old.parent_team_id or new.kind is distinct from old.kind) then
    select kind, name into p from teams where id = new.parent_team_id;
    if new.kind <> 'pcw' or p.kind is distinct from 'official' then
      raise exception 'Solo un bando de PCW puede jugar como un equipo oficial';
    end if;
    select string_agg(pl.nick, ', ' order by pl.nick) into fuera
      from team_members tm join players pl on pl.id = tm.player_id
     where tm.team_id = new.id and tm.left_at is null
       and not exists (select 1 from team_members x where x.team_id = new.parent_team_id and x.player_id = tm.player_id and x.left_at is null);
    if fuera is not null then
      raise exception 'Para jugar como % todos los jugadores del roster tienen que ser de su plantel (no lo son: %)', p.name, fuera;
    end if;
  end if;
  return new;
end $$;
create trigger teams_rules before insert or update of name, tag, kind, parent_team_id on public.teams
  for each row execute function public.teams_rules();

-- ---------- 4. reglas del plantel ----------
create function public.team_members_rules() returns trigger
  language plpgsql security definer set search_path = public as $$
declare t teams%rowtype; pl players%rowtype; x record;
begin
  if new.left_at is not null then return new; end if;
  select * into t from teams where id = new.team_id;
  select * into pl from players where id = new.player_id;
  if t.kind = 'official' then
    if (select count(*) from team_members where team_id = new.team_id and left_at is null and id <> new.id) >= 10 then
      raise exception 'El equipo ya tiene 10 jugadores, el máximo';
    end if;
    if pl.steam_id is null then
      raise exception '% no tiene el SteamID vinculado: hace falta para entrar a un equipo', pl.nick;
    end if;
  end if;
  if t.kind = 'pcw' and t.parent_team_id is not null
     and not exists (select 1 from team_members where team_id = t.parent_team_id and player_id = new.player_id and left_at is null) then
    raise exception '% no es del plantel de %', pl.nick, (select name from teams where id = t.parent_team_id);
  end if;
  -- Un jugador no puede estar en dos equipos inscritos en el mismo torneo (sin campeón todavía).
  select e.name as torneo, t2.name as equipo into x
    from tournament_registrations r
    join events e on e.id = r.event_id and e.champion is null
    join tournament_registrations r2 on r2.event_id = r.event_id and r2.team_id <> r.team_id
    join team_members m2 on m2.team_id = r2.team_id and m2.player_id = new.player_id and m2.left_at is null
    join teams t2 on t2.id = r2.team_id
   where r.team_id = new.team_id
   limit 1;
  if found then
    raise exception '% ya está inscrito en el torneo % con %', pl.nick, x.torneo, x.equipo;
  end if;
  -- Ni en el plantel del rival de una partida pendiente o en vivo.
  select rv.name as equipo into x
    from matches m
    join teams rv on rv.id = case when m.team1 = new.team_id then m.team2 else m.team1 end
   where m.kind <> 'mix' and m.status in ('upcoming', 'live') and new.team_id in (m.team1, m.team2)
     and exists (select 1 from team_members r where r.team_id = rv.id and r.player_id = new.player_id and r.left_at is null)
   limit 1;
  if found then
    raise exception '% está en el plantel de %, rival de este equipo en una partida pendiente', pl.nick, x.equipo;
  end if;
  return new;
end $$;
create trigger team_members_rules before insert or update of team_id, player_id, left_at on public.team_members
  for each row execute function public.team_members_rules();

-- Inscripción a un torneo: ningún jugador del plantel puede estar inscrito con otro equipo.
create function public.tournament_registrations_unicos() returns trigger
  language plpgsql security definer set search_path = public as $$
declare x record;
begin
  select pl.nick, t2.name as equipo into x
    from team_members m
    join team_members m2 on m2.player_id = m.player_id and m2.left_at is null and m2.team_id <> m.team_id
    join tournament_registrations r2 on r2.team_id = m2.team_id and r2.event_id = new.event_id
    join players pl on pl.id = m.player_id
    join teams t2 on t2.id = m2.team_id
   where m.team_id = new.team_id and m.left_at is null
   order by pl.nick
   limit 1;
  if found then
    raise exception '% ya está inscrito en este torneo con %. Uno de los dos equipos tiene que sacarlo de su plantel', x.nick, x.equipo;
  end if;
  return new;
end $$;
create trigger tournament_registrations_unicos before insert on public.tournament_registrations
  for each row execute function public.tournament_registrations_unicos();

-- ---------- 5. invitaciones y pedidos ----------
create table public.team_invites (
  id          uuid primary key default gen_random_uuid(),
  team_id     uuid not null references public.teams(id) on delete cascade,
  player_id   uuid not null references public.players(id) on delete cascade,
  kind        text not null check (kind in ('invite', 'request')),
  status      text not null default 'open' check (status in ('open', 'accepted', 'rejected', 'cancelled', 'expired')),
  created_by  uuid,
  created_at  timestamptz not null default now(),
  expires_at  timestamptz not null default now() + interval '7 days',
  resolved_at timestamptz,
  resolved_by uuid
);
comment on table public.team_invites is 'Plantel estilo FACEIT: invitaciones del capitán (invite) y pedidos para entrar (request). Vencen a los 7 días';
create unique index team_invites_abierta on public.team_invites (team_id, player_id) where status = 'open';
create index team_invites_player on public.team_invites (player_id);

alter table public.team_invites enable row level security;
create policy team_invites_ver on public.team_invites for select to authenticated using (
  is_admin()
  or exists (select 1 from players p where p.id = team_invites.player_id and p.user_id = auth.uid())
  or exists (select 1 from teams t where t.id = team_invites.team_id and t.captain_id = auth.uid()));
revoke insert, update, delete, truncate on public.team_invites from anon, authenticated;
revoke select on public.team_invites from anon;

create function public.team_invites_expire() returns void
  language sql security definer set search_path = public as $$
  update team_invites set status = 'expired', resolved_at = now() where status = 'open' and expires_at <= now()
$$;
revoke all on function public.team_invites_expire() from public, anon, authenticated;

-- Valida que un jugador pueda sumarse a un equipo oficial (mensajes para invitar y pedir; los triggers lo
-- vuelven a controlar al aceptar).
create function public.team_can_join(p_team uuid, p_player uuid) returns void
  language plpgsql security definer set search_path = public as $$
declare t teams%rowtype; pl players%rowtype;
begin
  select * into t from teams where id = p_team;
  if not found then raise exception 'No existe ese equipo'; end if;
  if t.kind <> 'official' then raise exception 'Solo los equipos oficiales tienen plantel con invitaciones'; end if;
  select * into pl from players where id = p_player;
  if pl.steam_id is null then
    raise exception '% no tiene el SteamID vinculado: hace falta para entrar a un equipo', pl.nick;
  end if;
  if exists (select 1 from team_members where team_id = p_team and player_id = p_player and left_at is null) then
    raise exception '% ya está en el equipo', pl.nick;
  end if;
  if (select count(*) from team_members where team_id = p_team and left_at is null) >= 10 then
    raise exception 'El equipo ya tiene 10 jugadores, el máximo';
  end if;
end $$;
revoke all on function public.team_can_join(uuid, uuid) from public, anon, authenticated;

-- El capitán (o el admin) invita a un jugador con cuenta, por id de jugador o por alias.
create function public.team_invite(p_team uuid, p_player uuid default null, p_alias text default null) returns uuid
  language plpgsql security definer set search_path = public as $$
declare u uuid; pl players%rowtype; v uuid;
begin
  if auth.uid() is null then raise exception 'Tenés que iniciar sesión'; end if;
  perform team_invites_expire();
  if not (is_admin() or exists (select 1 from teams where id = p_team and captain_id = auth.uid())) then
    raise exception 'Solo el capitán o un admin puede invitar jugadores' using errcode = '42501';
  end if;
  if p_player is not null then
    select * into pl from players where id = p_player;
    if not found then raise exception 'No existe ese jugador'; end if;
    if pl.user_id is null then raise exception '% no tiene cuenta en la web: no puede aceptar una invitación', pl.nick; end if;
  else
    select id into u from profiles where lower(trim(tag)) = lower(trim(coalesce(p_alias, '')));
    if u is null then raise exception 'No hay ningún usuario con ese alias'; end if;
    select * into pl from players where user_id = u;
    if not found then raise exception 'Ese usuario no tiene un SteamID vinculado: hace falta para entrar a un equipo'; end if;
  end if;
  perform team_can_join(p_team, pl.id);
  if exists (select 1 from team_invites where team_id = p_team and player_id = pl.id and status = 'open' and kind = 'request') then
    raise exception '% ya pidió entrar al equipo: aceptá su pedido', pl.nick;
  end if;
  if exists (select 1 from team_invites where team_id = p_team and player_id = pl.id and status = 'open') then
    raise exception '% ya tiene una invitación abierta a este equipo', pl.nick;
  end if;
  insert into team_invites(team_id, player_id, kind, created_by) values (p_team, pl.id, 'invite', auth.uid()) returning id into v;
  return v;
end $$;

-- Un usuario pide entrar a un equipo.
create function public.team_request_join(p_team uuid) returns uuid
  language plpgsql security definer set search_path = public as $$
declare pl players%rowtype; v uuid;
begin
  if auth.uid() is null then raise exception 'Tenés que iniciar sesión'; end if;
  perform team_invites_expire();
  select * into pl from players where user_id = auth.uid();
  if not found then raise exception 'Para entrar a un equipo tenés que tener tu SteamID vinculado'; end if;
  if pl.steam_id is null then raise exception 'Para entrar a un equipo tenés que tener tu SteamID vinculado'; end if;
  perform team_can_join(p_team, pl.id);
  if exists (select 1 from team_invites where team_id = p_team and player_id = pl.id and status = 'open' and kind = 'invite') then
    raise exception 'Ya tenés una invitación de este equipo: aceptala';
  end if;
  if exists (select 1 from team_invites where team_id = p_team and player_id = pl.id and status = 'open') then
    raise exception 'Ya pediste entrar a este equipo';
  end if;
  insert into team_invites(team_id, player_id, kind, created_by) values (p_team, pl.id, 'request', auth.uid()) returning id into v;
  return v;
end $$;

-- Responder: una invitación la responde el invitado; un pedido, el capitán o un admin.
create function public.team_invite_answer(p_id uuid, p_accept boolean) returns void
  language plpgsql security definer set search_path = public as $$
declare i team_invites%rowtype; puede boolean;
begin
  if auth.uid() is null then raise exception 'Tenés que iniciar sesión'; end if;
  perform team_invites_expire();
  select * into i from team_invites where id = p_id for update;
  if not found then raise exception 'No existe esa invitación'; end if;
  if i.kind = 'invite' then
    puede := exists (select 1 from players where id = i.player_id and user_id = auth.uid()) or is_admin();
  else
    puede := exists (select 1 from teams where id = i.team_id and captain_id = auth.uid()) or is_admin();
  end if;
  if not puede then raise exception 'No podés responder esta invitación' using errcode = '42501'; end if;
  if i.status <> 'open' then
    raise exception 'Esta invitación ya no está abierta (%)', case i.status when 'accepted' then 'aceptada' when 'rejected' then 'rechazada'
                                                             when 'cancelled' then 'cancelada' else 'vencida' end;
  end if;
  if coalesce(p_accept, false) then
    perform team_can_join(i.team_id, i.player_id);
    insert into team_members(team_id, player_id, joined_at) values (i.team_id, i.player_id, now());
  end if;
  update team_invites set status = case when p_accept then 'accepted' else 'rejected' end, resolved_at = now(), resolved_by = auth.uid()
   where id = p_id;
end $$;

-- Cancelar: una invitación, el capitán o un admin; un pedido, quien lo hizo o un admin.
create function public.team_invite_cancel(p_id uuid) returns void
  language plpgsql security definer set search_path = public as $$
declare i team_invites%rowtype; puede boolean;
begin
  if auth.uid() is null then raise exception 'Tenés que iniciar sesión'; end if;
  perform team_invites_expire();
  select * into i from team_invites where id = p_id for update;
  if not found then raise exception 'No existe esa invitación'; end if;
  if i.kind = 'invite' then
    puede := exists (select 1 from teams where id = i.team_id and captain_id = auth.uid()) or is_admin();
  else
    puede := exists (select 1 from players where id = i.player_id and user_id = auth.uid()) or is_admin();
  end if;
  if not puede then raise exception 'No podés cancelar esta invitación' using errcode = '42501'; end if;
  if i.status <> 'open' then raise exception 'Esta invitación ya no está abierta'; end if;
  update team_invites set status = 'cancelled', resolved_at = now(), resolved_by = auth.uid() where id = p_id;
end $$;

-- Salir del equipo. El capitán tiene que ceder antes la capitanía.
create function public.team_leave(p_team uuid) returns void
  language plpgsql security definer set search_path = public as $$
declare pid uuid;
begin
  if auth.uid() is null then raise exception 'Tenés que iniciar sesión'; end if;
  select id into pid from players where user_id = auth.uid();
  if pid is null or not exists (select 1 from team_members where team_id = p_team and player_id = pid and left_at is null) then
    raise exception 'No estás en ese equipo';
  end if;
  if exists (select 1 from teams where id = p_team and captain_id = auth.uid()) then
    raise exception 'Sos el capitán: cedé la capitanía antes de salir del equipo';
  end if;
  update team_members set left_at = now() where team_id = p_team and player_id = pid and left_at is null;
end $$;

-- Sacar a un jugador (capitán o admin). Al capitán no se lo puede sacar.
create function public.team_kick(p_team uuid, p_player uuid) returns void
  language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'Tenés que iniciar sesión'; end if;
  if not (is_admin() or exists (select 1 from teams where id = p_team and captain_id = auth.uid())) then
    raise exception 'Solo el capitán o un admin puede sacar jugadores' using errcode = '42501';
  end if;
  if exists (select 1 from teams t join players p on p.user_id = t.captain_id where t.id = p_team and p.id = p_player) then
    raise exception 'No se puede sacar al capitán: primero hay que cambiar de capitán';
  end if;
  update team_members set left_at = now() where team_id = p_team and player_id = p_player and left_at is null;
  if not found then raise exception 'Ese jugador no está en el equipo'; end if;
end $$;

revoke all on function public.team_invite(uuid, uuid, text) from public, anon;
revoke all on function public.team_request_join(uuid) from public, anon;
revoke all on function public.team_invite_answer(uuid, boolean) from public, anon;
revoke all on function public.team_invite_cancel(uuid) from public, anon;
revoke all on function public.team_leave(uuid) from public, anon;
revoke all on function public.team_kick(uuid, uuid) from public, anon;
grant execute on function public.team_invite(uuid, uuid, text) to authenticated;
grant execute on function public.team_request_join(uuid) to authenticated;
grant execute on function public.team_invite_answer(uuid, boolean) to authenticated;
grant execute on function public.team_invite_cancel(uuid) to authenticated;
grant execute on function public.team_leave(uuid) to authenticated;
grant execute on function public.team_kick(uuid, uuid) to authenticated;

-- ---------- 6. solicitudes de equipo nuevo ----------
-- Quien pide un equipo va a ser su primer miembro: necesita SteamID. Palabras bloqueadas en nombre y sigla.
create function public.team_requests_rules() returns trigger
  language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null or is_admin() then return new; end if;
  if new.status = 'pending' and not exists (select 1 from players where user_id = new.user_id and steam_id is not null) then
    raise exception 'Para pedir un equipo tenés que tener tu SteamID vinculado';
  end if;
  if name_blocked(new.name) is not null or name_blocked(new.tag) is not null then
    raise exception 'El nombre o la sigla del equipo contiene una palabra no permitida';
  end if;
  return new;
end $$;
create trigger team_requests_rules before insert or update of name, tag, status on public.team_requests
  for each row execute function public.team_requests_rules();

-- Aprobar: crea el equipo con el usuario como dueño, capitán y primer miembro.
create function public.approve_team_request(p_user uuid) returns uuid
  language plpgsql security definer set search_path = public as $$
declare r team_requests%rowtype; pid uuid; tid uuid;
begin
  if not is_admin() then raise exception 'Solo un administrador puede aprobar solicitudes de equipo' using errcode = '42501'; end if;
  select * into r from team_requests where user_id = p_user for update;
  if not found or r.status <> 'pending' then raise exception 'No hay una solicitud pendiente de ese usuario'; end if;
  select id into pid from players where user_id = p_user and steam_id is not null;
  if pid is null then raise exception 'El usuario no tiene el SteamID vinculado: hace falta para crear el equipo'; end if;
  insert into teams(name, tag, owner_id, captain_id, kind) values (r.name, r.tag, p_user, p_user, 'official') returning id into tid;
  insert into team_members(team_id, player_id, joined_at) values (tid, pid, now());
  update team_requests set status = 'approved' where user_id = p_user;
  return tid;
end $$;

create function public.reject_team_request(p_user uuid) returns void
  language plpgsql security definer set search_path = public as $$
begin
  if not is_admin() then raise exception 'Solo un administrador puede rechazar solicitudes de equipo' using errcode = '42501'; end if;
  update team_requests set status = 'rejected' where user_id = p_user and status = 'pending';
  if not found then raise exception 'No hay una solicitud pendiente de ese usuario'; end if;
end $$;
revoke all on function public.approve_team_request(uuid) from public, anon;
revoke all on function public.reject_team_request(uuid) from public, anon;
grant execute on function public.approve_team_request(uuid) to authenticated;
grant execute on function public.reject_team_request(uuid) to authenticated;

-- ---------- 7. ranking ----------
create table public.ranking_config (
  id           smallint primary key default 1 check (id = 1),
  win_official int not null default 30 check (win_official between 0 and 1000),
  win_pcw      int not null default 5 check (win_pcw between 0 and 1000),
  updated_at   timestamptz not null default now(),
  updated_by   uuid
);
comment on table public.ranking_config is 'Puntos del ranking de equipos por partida ganada: de torneo y de PCW (una sola fila). Se cambia con set_ranking_config';
insert into public.ranking_config (id) values (1);
alter table public.ranking_config enable row level security;
create policy ranking_config_leer on public.ranking_config for select to anon, authenticated using (true);
revoke insert, update, delete, truncate on public.ranking_config from anon, authenticated;

create function public.set_ranking_config(p_official int, p_pcw int) returns void
  language plpgsql security definer set search_path = public as $$
begin
  if not is_admin() then raise exception 'Solo un administrador puede cambiar los puntos del ranking' using errcode = '42501'; end if;
  if p_official is null or p_pcw is null or p_official not between 0 and 1000 or p_pcw not between 0 and 1000 then
    raise exception 'Los puntos tienen que estar entre 0 y 1000';
  end if;
  update ranking_config set win_official = p_official, win_pcw = p_pcw, updated_at = now(), updated_by = auth.uid() where id = 1;
end $$;
revoke all on function public.set_ranking_config(int, int) from public, anon;
grant execute on function public.set_ranking_config(int, int) to authenticated;

-- Por equipo oficial: partidas de torneo (como la web vieja: terminadas, sin byes ni huérfanas, con ganador)
-- y PCW jugadas como ese equipo (bando con parent_team_id).
create view public.team_standings with (security_invoker = true) as
with jugadas as (
  select m.team1 as team_id, m.winner_side = 1 as gano, 'official' as tipo from matches m
   where m.kind = 'official' and m.status = 'finished' and not coalesce(m.bye, false) and m.winner_side is not null
     and m.team1 is not null and m.team2 is not null
     and not (coalesce(m.stage, '') <> '' and (m.event_id is null or not exists (select 1 from events e where e.id = m.event_id)))
  union all
  select m.team2, m.winner_side = 2, 'official' from matches m
   where m.kind = 'official' and m.status = 'finished' and not coalesce(m.bye, false) and m.winner_side is not null
     and m.team1 is not null and m.team2 is not null
     and not (coalesce(m.stage, '') <> '' and (m.event_id is null or not exists (select 1 from events e where e.id = m.event_id)))
  union all
  select s.parent_team_id, m.winner_side = 1, 'pcw' from matches m join teams s on s.id = m.team1
   where m.kind = 'pcw' and m.status = 'finished' and m.winner_side is not null and s.parent_team_id is not null
  union all
  select s.parent_team_id, m.winner_side = 2, 'pcw' from matches m join teams s on s.id = m.team2
   where m.kind = 'pcw' and m.status = 'finished' and m.winner_side is not null and s.parent_team_id is not null
)
select t.id as team_id, t.name, t.tag,
       count(j.*) filter (where j.tipo = 'official')::int                 as official_played,
       count(j.*) filter (where j.tipo = 'official' and j.gano)::int      as official_won,
       count(j.*) filter (where j.tipo = 'official' and not j.gano)::int  as official_lost,
       count(j.*) filter (where j.tipo = 'pcw')::int                      as pcw_played,
       count(j.*) filter (where j.tipo = 'pcw' and j.gano)::int           as pcw_won,
       count(j.*) filter (where j.tipo = 'pcw' and not j.gano)::int       as pcw_lost,
       (count(j.*) filter (where j.tipo = 'official' and j.gano) * c.win_official)::int as official_points,
       (count(j.*) filter (where j.tipo = 'pcw' and j.gano) * c.win_pcw)::int           as pcw_points
  from teams t
  cross join ranking_config c
  left join jugadas j on j.team_id = t.id
 where t.kind = 'official'
 group by t.id, t.name, t.tag, c.win_official, c.win_pcw;
comment on view public.team_standings is 'Ranking de equipos oficiales: PJ, G, P y puntos de torneo y de PCW por separado (puntos de ranking_config)';
grant select on public.team_standings to anon, authenticated;

-- ---------- 8. listado de jugadores ----------
create view public.player_overview with (security_invoker = true) as
select p.id, p.nick, p.user_id is not null as has_account, p.steam_id is not null as has_steam,
       coalesce(p.photo_url, d.avatar_url) as photo_url, p.privacy,
       e.elo, e.peak_elo, coalesce(e.matches, 0) as elo_matches,
       s.maps, s.rating, s.kd, s.wins, s.losses,
       coalesce((select jsonb_agg(jsonb_build_object('id', t.id, 'name', t.name, 'tag', t.tag) order by tm.joined_at nulls first, t.name)
                   from team_members tm join teams t on t.id = tm.team_id
                  where tm.player_id = p.id and tm.left_at is null and t.kind = 'official'), '[]'::jsonb) as teams,
       search_norm(p.nick || ' ' || coalesce((select string_agg(t.name || ' ' || coalesce(t.tag, ''), ' ')
                                                from team_members tm join teams t on t.id = tm.team_id
                                               where tm.player_id = p.id and tm.left_at is null and t.kind = 'official'), '')) as search
  from players p
  left join player_elo e on e.steam_id = p.steam_id
  left join player_stats s on s.player_id = p.id
  left join profile_details d on d.user_id = p.user_id;
comment on view public.player_overview is 'Listado de jugadores: alias o nick, ELO, stats y equipos oficiales actuales';
grant select on public.player_overview to anon, authenticated;

-- Partidas de un jugador: sus stats en cada partida terminada, con los bandos y el resultado.
create view public.player_matches with (security_invoker = true) as
select s.player_id, m.id as match_id, m.kind, m.status, coalesce(m.played_at, m.starts_at) as played_at, m.map,
       m.side1_name, m.side2_name, t1.name as team1_name, t2.name as team2_name, m.score1, m.score2, m.winner_side,
       s.team as side, s.team = m.winner_side as won, m.parent_match_id,
       s.nick as game_nick, s.kills, s.deaths, s.assists, s.headshots, s.damage, s.rounds, s.rating,
       s.elo_before, s.elo_after, s.elo_delta, m.demo_status
  from match_player_stats s
  join matches m on m.id = s.match_id
  left join teams t1 on t1.id = m.team1
  left join teams t2 on t2.id = m.team2
 where s.player_id is not null and m.status = 'finished';
comment on view public.player_matches is 'Partidas terminadas de cada jugador vinculado, con sus stats y su cambio de ELO';
grant select on public.player_matches to anon, authenticated;

-- Listado de equipos: capitán (su alias es el nick de su jugador) y jugadores activos.
create view public.team_overview with (security_invoker = true) as
select t.id, t.name, t.tag, t.kind, t.owner_id, t.captain_id, t.parent_team_id,
       (select p.id from players p where p.user_id = t.captain_id) as captain_player_id,
       (select p.nick from players p where p.user_id = t.captain_id) as captain_nick,
       (select count(*) from team_members tm where tm.team_id = t.id and tm.left_at is null)::int as members,
       search_norm(t.name || ' ' || coalesce(t.tag, '')) as search
  from teams t;
comment on view public.team_overview is 'Listado de equipos con capitán y cantidad de jugadores activos';
grant select on public.team_overview to anon, authenticated;

-- SteamIDs que jugaron y no están vinculados a ningún jugador (para el admin; las stats ya son públicas).
create view public.steam_unlinked with (security_invoker = true) as
select s.steam_id,
       (array_agg(s.nick order by coalesce(m.played_at, s.created_at) desc))[1] as last_nick,
       count(distinct s.match_id)::int as matches,
       max(coalesce(m.played_at, s.created_at)) as last_played
  from match_player_stats s
  join matches m on m.id = s.match_id
 where s.player_id is null and s.steam_id ~ '^(7656119[0-9]{10}|765612[0-9]{11})$'
 group by s.steam_id;
comment on view public.steam_unlinked is 'SteamIDs con partidas y sin jugador vinculado';
grant select on public.steam_unlinked to authenticated;

-- Usuarios para el admin (profiles solo deja leer el propio): alias, rol y jugador vinculado.
create function public.admin_users(p_q text default null) returns table
  (id uuid, tag text, role text, tag_changed_at timestamptz, player_id uuid, player_steam_id text)
  language plpgsql stable security definer set search_path = public as $$
begin
  if not is_admin() then raise exception 'Solo un administrador puede ver los usuarios' using errcode = '42501'; end if;
  return query
    select pr.id, pr.tag, pr.role, pr.tag_changed_at, p.id, p.steam_id
      from profiles pr left join players p on p.user_id = pr.id
     where p_q is null or search_norm(pr.tag) like '%' || search_norm(p_q) || '%'
     order by lower(pr.tag);
end $$;
revoke all on function public.admin_users(text) from public, anon;
grant execute on function public.admin_users(text) to authenticated;

-- ---------- 9. bajas seguras ----------
create function public.players_safe_delete() returns trigger
  language plpgsql security definer set search_path = public as $$
begin
  if exists (select 1 from match_player_stats where player_id = old.id)
     or exists (select 1 from matches where old.id = any(lineup1) or old.id = any(lineup2)) then
    raise exception '% tiene partidas jugadas: no se puede borrar', old.nick;
  end if;
  return old;
end $$;
create trigger players_safe_delete before delete on public.players
  for each row execute function public.players_safe_delete();

create function public.teams_safe_delete() returns trigger
  language plpgsql security definer set search_path = public as $$
begin
  if exists (select 1 from matches where team1 = old.id or team2 = old.id)
     or exists (select 1 from tournament_registrations where team_id = old.id) then
    raise exception '% tiene partidas o inscripciones: no se puede borrar', old.name;
  end if;
  return old;
end $$;
create trigger teams_safe_delete before delete on public.teams
  for each row execute function public.teams_safe_delete();

-- ---------- 10. funciones existentes ----------
create function pg_temp.reemplazar(fn regprocedure, cambios text[][]) returns void language plpgsql as $$
declare d text := pg_get_functiondef(fn); i int;
begin
  for i in 1 .. array_length(cambios, 1) loop
    if position(cambios[i][1] in d) = 0 then
      raise exception 'replanteo 09: en % no se encontró: %', fn, left(cambios[i][1], 80);
    end if;
    d := replace(d, cambios[i][1], cambios[i][2]);
  end loop;
  execute d;
end $$;

-- Registro: si el alias está tomado o tiene una palabra bloqueada, queda el genérico (el backend lo valida antes).
select pg_temp.reemplazar('public.handle_new_user()', array[
  [E'  insert into profiles(id, tag)\n  values (new.id, coalesce(nullif(left(trim(coalesce(new.raw_user_meta_data->>''tag'','''')), 24), ''''), ''user_'' || left(new.id::text, 6)))',
   E'  -- (replanteo 09) alias tomado o con palabra bloqueada: queda el genérico\n  insert into profiles(id, tag)\n  values (new.id, (select case when alias_check(x.t) = ''ok'' then x.t else ''user_'' || right(replace(new.id::text, ''-'', ''''), 8) end\n                     from (select coalesce(nullif(left(trim(coalesce(new.raw_user_meta_data->>''tag'','''')), 24), ''''), ''user_'' || left(new.id::text, 6)) as t) x))']
]);

commit;
