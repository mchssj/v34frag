-- Replanteo 149: baneo por IP desde la web (plan docs/bitacora/2026-11-26-baneo-por-ip).
--   1. request_ip(): la IP real del pedido, del primer valor de X-Forwarded-For que pone Caddy (desde el 2026-11-26
--      también para los pedidos de la API, que la mandan con la IP del usuario). Las privadas y loopback dan null.
--   2. account_ips: la IP de cada cuenta al usar la web (iniciar sesión, renovar la sesión, entrar a la cola), con
--      primera y última vez. Solo admins. Se borra lo de más de 90 días.
--   3. ban_ips: IPs o rangos (Daniel, 2026-11-26: las IPs dinámicas repiten los primeros números) atados a un baneo de
--      ficha, con vencimiento propio (el del baneo, como mucho 30 días). Rangos de hasta /16 (IPv4) o /32 (IPv6).
--      Activa si la IP y el baneo siguen activos: levantar el baneo levanta sus IPs.
--   4. Triggers: con la IP baneada no se entra a la cola (mm_queue), no se acepta una partida (mm_lobby_players) ni se
--      entra a un grupo (mm_party_members). Solo frenan pedidos de una persona (auth.uid()), no los del worker ni los
--      de los servidores.
--   5. request_ip_banned() para la API (registro) y las funciones de admin, con admin_ip_range_accounts: qué fichas y
--      cuentas usaron alguna IP de un rango, para ver a quién afecta antes de banearlo.
begin;

do $$
begin
  if to_regclass('public.ban_ips') is not null or to_regclass('public.account_ips') is not null then
    raise exception 'replanteo 149: ban_ips o account_ips ya existen (¿ya se aplicó?)';
  end if;
  if to_regclass('public.bans') is null or to_regclass('public.player_ips') is null or to_regclass('public.player_steam_all') is null
     or to_regclass('public.mm_queue') is null or to_regclass('public.mm_lobby_players') is null or to_regclass('public.mm_party_members') is null then
    raise exception 'replanteo 149: faltan bans, player_ips, player_steam_all o las tablas del matchmaking';
  end if;
  if current_user not in ('postgres', 'supabase_admin') then
    raise exception 'replanteo 149: correr como postgres o supabase_admin';
  end if;
end $$;

-- Lo de public, como postgres (como el resto de las tablas).
do $$ begin if current_user = 'supabase_admin' then execute 'set local role postgres'; end if; end $$;

-- =====================================================================================================
-- 1. La IP del pedido
-- =====================================================================================================
create function public.request_ip() returns inet
  language plpgsql stable set search_path = public as $$
declare h text; v inet;
begin
  h := nullif(btrim(split_part(coalesce(current_setting('request.headers', true), '')::json ->> 'x-forwarded-for', ',', 1)), '');
  if h is null then return null; end if;
  v := h::inet;
  -- Las internas (Docker, el propio VPS) no son de nadie.
  if v << '10.0.0.0/8' or v << '172.16.0.0/12' or v << '192.168.0.0/16' or v << '127.0.0.0/8'
     or v = '::1'::inet or v << 'fc00::/7'::inet or v << 'fe80::/10'::inet then
    return null;
  end if;
  return v;
exception when others then
  return null;
end $$;

-- =====================================================================================================
-- 2. IPs de las cuentas en la web
-- =====================================================================================================
create table public.account_ips (
  user_id       uuid not null references auth.users (id) on delete cascade,
  ip            inet not null,
  first_seen_at timestamptz not null default now(),
  last_seen_at  timestamptz not null default now(),
  times         integer not null default 1,
  primary key (user_id, ip)
);
create index account_ips_ip on public.account_ips (ip);
create index account_ips_last_seen on public.account_ips (last_seen_at);
comment on table public.account_ips is
  'IP de cada cuenta al usar la web (replanteo 149): login, renovar la sesión y entrar a la cola. Solo admin. Se borra a los 90 días';
alter table public.account_ips enable row level security;
create policy account_ips_admin_read on public.account_ips for select to authenticated using (is_admin());

-- La registra la API. No escribe en cada pedido (una vez por minuto por cuenta e IP) y de paso borra lo viejo.
create function public.account_ip_seen() returns void
  language plpgsql volatile security definer set search_path = public as $$
declare v_ip inet := request_ip(); v_user uuid := auth.uid();
begin
  if v_ip is null or v_user is null then return; end if;
  insert into account_ips (user_id, ip) values (v_user, v_ip)
  on conflict (user_id, ip) do update
     set last_seen_at = now(), times = account_ips.times + 1
   where account_ips.last_seen_at < now() - interval '1 minute';
  delete from account_ips where last_seen_at < now() - interval '90 days';
end $$;

-- =====================================================================================================
-- 3. IPs baneadas
-- =====================================================================================================
create table public.ban_ips (
  id         uuid primary key default gen_random_uuid(),
  ban_id     uuid not null references public.bans (id) on delete cascade,
  ip         inet not null,
  expires_at timestamptz not null,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  lifted_at  timestamptz,
  lifted_by  uuid references auth.users (id) on delete set null,
  unique (ban_id, ip)
);
-- GiST para "la IP está dentro del rango" (<<=).
create index ban_ips_ip on public.ban_ips using gist (ip inet_ops) where lifted_at is null;
comment on table public.ban_ips is
  'IPs de un baneo de ficha (replanteo 149). Vencen con el baneo, como mucho a los 30 días. Solo admin';
alter table public.ban_ips enable row level security;
create policy ban_ips_admin_read on public.ban_ips for select to authenticated using (is_admin());

create function public.ip_banned(p_ip inet) returns boolean
  language sql stable security definer set search_path = public as $$
  select p_ip is not null and exists (
    select 1 from ban_ips i join bans b on b.id = i.ban_id
     where p_ip <<= i.ip and i.lifted_at is null and i.expires_at > now()
       and b.lifted_at is null and (b.expires_at is null or b.expires_at > now()))
$$;

-- Una IP suelta como 1.2.3.4 y un rango como 1.2.3.0/24.
create function public.ip_text(p inet) returns text
  language sql immutable set search_path = public as $$
  select case when masklen(p) = (case family(p) when 4 then 32 else 128 end) then host(p) else text(network(p)) end
$$;

-- Un rango válido para banear: de /16 a /32 en IPv4 y de /32 a /128 en IPv6, normalizado a su red (1.2.3.7/24 → 1.2.3.0/24).
create function public.ban_ip_parse(p text) returns inet
  language plpgsql immutable set search_path = public as $$
declare v inet;
begin
  begin
    v := btrim(p)::inet;
  exception when others then
    raise exception 'IP o rango inválido: %', p using errcode = 'P0001';
  end;
  if masklen(v) < (case family(v) when 4 then 16 else 32 end) then
    raise exception 'Rango demasiado grande: %. Como mucho /16 en IPv4 (x.y.*.*) o /32 en IPv6', p using errcode = 'P0001';
  end if;
  return network(v)::inet;
end $$;

create function public.request_ip_banned() returns boolean
  language sql stable security definer set search_path = public as $$
  select ip_banned(request_ip())
$$;

-- =====================================================================================================
-- 4. El freno en el matchmaking
-- =====================================================================================================
create function public.mm_ip_guard() returns trigger
  language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is not null and request_ip_banned() then
    raise exception 'No puedes buscar partida desde esta conexión. Si crees que es un error, escríbenos por Discord.'
      using errcode = 'P0001', hint = 'IP_BANNED';
  end if;
  return new;
end $$;

create trigger mm_queue_ip_guard before insert on public.mm_queue
  for each row execute function public.mm_ip_guard();
create trigger mm_party_members_ip_guard before insert on public.mm_party_members
  for each row execute function public.mm_ip_guard();
create trigger mm_lobby_players_ip_guard before update of accepted_at on public.mm_lobby_players
  for each row when (old.accepted_at is null and new.accepted_at is not null)
  execute function public.mm_ip_guard();

-- =====================================================================================================
-- 5. Admin
-- =====================================================================================================
-- Las IPs de una ficha (servidores, por sus SteamID) y de su cuenta (web), con las otras fichas o cuentas que las
-- usaron. Con p_user sirve para una cuenta sin ficha.
create function public.admin_ban_ip_candidates(p_player uuid default null, p_user uuid default null)
  returns table (ip text, sources text[], first_seen_at timestamptz, last_seen_at timestamptz, others jsonb, banned boolean)
  language plpgsql stable security definer set search_path = public as $$
declare v_user uuid := p_user;
begin
  if not is_admin() then raise exception 'Solo un admin puede ver las IPs' using errcode = '42501'; end if;
  if v_user is null and p_player is not null then select pl.user_id into v_user from players pl where pl.id = p_player; end if;
  return query
    with mine as (
      select i.ip, 'servidor'::text as src, i.first_seen_at as f, i.last_seen_at as l
        from player_ips i join player_steam_all s on s.steam_id = i.steam_id
       where p_player is not null and s.player_id = p_player
      union all
      select a.ip, 'web', a.first_seen_at, a.last_seen_at from account_ips a where v_user is not null and a.user_id = v_user
    ), agg as (
      select m.ip, array_agg(distinct m.src order by m.src) as srcs, min(m.f) as f, max(m.l) as l from mine m group by m.ip
    )
    select host(g.ip), g.srcs, g.f, g.l,
           coalesce((select jsonb_agg(distinct jsonb_build_object('player_id', o.pid, 'alias', o.alias))
                       from (select s2.player_id as pid, coalesce(pr.tag, pl.nick) as alias
                               from player_ips j
                               join player_steam_all s2 on s2.steam_id = j.steam_id
                               join players pl on pl.id = s2.player_id
                               left join profiles pr on pr.id = pl.user_id
                              where j.ip = g.ip and s2.player_id is distinct from p_player
                             union
                             select pl.id, pr.tag
                               from account_ips a2
                               join profiles pr on pr.id = a2.user_id
                               left join players pl on pl.user_id = a2.user_id
                              where a2.ip = g.ip and a2.user_id is distinct from v_user) o), '[]'::jsonb),
           ip_banned(g.ip)
      from agg g
     order by g.l desc;
end $$;

-- Deja exactamente esas IPs en el baneo: las nuevas se banean y las que ya no están se levantan.
create function public.admin_ban_ips_set(p_ban uuid, p_ips text[]) returns integer
  language plpgsql security definer set search_path = public as $$
declare b bans; v_exp timestamptz; v inet; x text; ips inet[] := '{}';
begin
  if not is_admin() then raise exception 'Solo un admin puede banear IPs' using errcode = '42501'; end if;
  select * into b from bans where id = p_ban for update;
  if b.id is null then raise exception 'Ese baneo no existe' using errcode = 'P0002'; end if;
  if b.lifted_at is not null or (b.expires_at is not null and b.expires_at <= now()) then
    raise exception 'Ese baneo ya no está activo' using errcode = 'P0001';
  end if;
  foreach x in array coalesce(p_ips, '{}') loop
    v := ban_ip_parse(x);
    if not (v = any (ips)) then ips := ips || v; end if;
  end loop;
  -- Como mucho 30 días: muchas IPs son compartidas o cambian.
  v_exp := least(coalesce(b.expires_at, 'infinity'::timestamptz), now() + interval '30 days');
  update ban_ips set lifted_at = now(), lifted_by = auth.uid()
   where ban_id = p_ban and lifted_at is null and not (ip = any (ips));
  insert into ban_ips (ban_id, ip, expires_at, created_by)
  select p_ban, i, v_exp, auth.uid() from unnest(ips) i
  on conflict (ban_id, ip) do update set lifted_at = null, lifted_by = null, expires_at = v_exp;
  return coalesce(array_length(ips, 1), 0);
end $$;

create function public.admin_ban_ips(p_ban uuid)
  returns table (id uuid, ip text, expires_at timestamptz, created_at timestamptz, created_by_alias text, active boolean)
  language plpgsql stable security definer set search_path = public as $$
begin
  if not is_admin() then raise exception 'Solo un admin puede ver las IPs' using errcode = '42501'; end if;
  return query
    select i.id, ip_text(i.ip), i.expires_at, i.created_at, p.tag,
           i.lifted_at is null and i.expires_at > now() and b.lifted_at is null and (b.expires_at is null or b.expires_at > now())
      from ban_ips i join bans b on b.id = i.ban_id left join profiles p on p.id = i.created_by
     where i.ban_id = p_ban and i.lifted_at is null
     order by i.created_at;
end $$;

-- Qué fichas y cuentas usaron alguna IP del rango (servidores o web), para ver a quién afecta antes de banearlo.
create function public.admin_ip_range_accounts(p_range text)
  returns table (player_id uuid, alias text, sources text[], ips integer, last_seen_at timestamptz)
  language plpgsql stable security definer set search_path = public as $$
declare r inet;
begin
  if not is_admin() then raise exception 'Solo un admin puede ver las IPs' using errcode = '42501'; end if;
  r := ban_ip_parse(p_range);
  return query
    with hits as (
      select s.player_id as pid, coalesce(pr.tag, pl.nick) as alias, 'servidor'::text as src, i.ip, i.last_seen_at as l
        from player_ips i
        join player_steam_all s on s.steam_id = i.steam_id
        join players pl on pl.id = s.player_id
        left join profiles pr on pr.id = pl.user_id
       where i.ip <<= r
      union all
      select pl.id, pr.tag, 'web', a.ip, a.last_seen_at
        from account_ips a
        join profiles pr on pr.id = a.user_id
        left join players pl on pl.user_id = a.user_id
       where a.ip <<= r
    )
    select h.pid, h.alias, array_agg(distinct h.src order by h.src), count(distinct h.ip)::int, max(h.l)
      from hits h group by h.pid, h.alias
     order by max(h.l) desc;
end $$;

create function public.admin_ban_ip_lift(p_id uuid) returns void
  language plpgsql security definer set search_path = public as $$
begin
  if not is_admin() then raise exception 'Solo un admin puede levantar IPs' using errcode = '42501'; end if;
  update ban_ips set lifted_at = now(), lifted_by = auth.uid() where id = p_id and lifted_at is null;
  if not found then raise exception 'Esa IP no está baneada' using errcode = 'P0002'; end if;
end $$;

-- =====================================================================================================
-- Permisos (sin los de por defecto de Supabase)
-- =====================================================================================================
revoke all on table public.account_ips, public.ban_ips from public, anon, authenticated, service_role;
grant select on table public.account_ips, public.ban_ips to authenticated;
grant all on table public.account_ips, public.ban_ips to service_role;
revoke all on function public.request_ip() from public, anon, authenticated;
revoke all on function public.account_ip_seen() from public, anon, authenticated;
revoke all on function public.ip_banned(inet) from public, anon, authenticated;
revoke all on function public.request_ip_banned() from public, anon, authenticated;
revoke all on function public.mm_ip_guard() from public, anon, authenticated, service_role;
revoke all on function public.admin_ban_ip_candidates(uuid, uuid) from public, anon, authenticated;
revoke all on function public.admin_ban_ips_set(uuid, text[]) from public, anon, authenticated;
revoke all on function public.admin_ban_ips(uuid) from public, anon, authenticated;
revoke all on function public.admin_ban_ip_lift(uuid) from public, anon, authenticated;
revoke all on function public.admin_ip_range_accounts(text) from public, anon, authenticated;
revoke all on function public.ip_text(inet) from public, anon, authenticated;
revoke all on function public.ban_ip_parse(text) from public, anon, authenticated;
grant execute on function public.admin_ip_range_accounts(text) to authenticated, service_role;
grant execute on function public.ip_text(inet), public.ban_ip_parse(text) to authenticated, service_role;
grant execute on function public.account_ip_seen() to authenticated, service_role;
grant execute on function public.request_ip_banned() to anon, authenticated, service_role;
grant execute on function public.ip_banned(inet) to service_role;
grant execute on function public.request_ip() to service_role;
grant execute on function public.admin_ban_ip_candidates(uuid, uuid) to authenticated, service_role;
grant execute on function public.admin_ban_ips_set(uuid, text[]) to authenticated, service_role;
grant execute on function public.admin_ban_ips(uuid) to authenticated, service_role;
grant execute on function public.admin_ban_ip_lift(uuid) to authenticated, service_role;

notify pgrst, 'reload schema';
commit;
