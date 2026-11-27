-- Replanteo 151: los baneos por IP también en los servidores (plan docs/bitacora/2026-11-26-baneos-en-los-servidores,
-- sección 10). Lo usa el reporter 2.12.0 (csstv/bans.inc).
--   1. ban_ips puede existir sin baneo de ficha (ban_id null): los !banip del servidor, con su motivo, quién y desde qué
--      servidor. Sin vencimiento = 'infinity'.
--   2. ip_ban_match(ip, ficha, cuenta): la IP o rango activo que alcanza a esa IP, sin los que exceptúan a esa ficha o
--      cuenta. ip_banned, ip_banned_for y request_ip_banned pasan a usarla (y entienden los baneos sin ficha).
--   3. Para el plugin, con el token del servidor:
--      - csstv_ban_check_ip(token, steam, ip): al conectarse; baneado por la ficha o el SteamID (como csstv_ban_check) o
--        por la IP, con las excepciones de la ficha dueña del SteamID y de su cuenta.
--      - csstv_ban_ips_active(token): la lista completa de IPs y rangos activos, con los SteamID exceptuados (la copia
--        local del servidor; se pide entera, es chica).
--      - csstv_ban_ip_add(token, ip, minutos, motivo, admin_steam, admin_nombre, ban_id): !banip (sin ficha) y la IP
--        exacta de un !ban (con el ban_id de csstv_ban_add y su mismo vencimiento, sin el tope de 30 días de la web).
--      - csstv_ban_ip_lift(token, ip, admin_steam, admin_nombre): !unbanip.
--   4. admin_ban_ips_loose(): los baneos por IP sin ficha, para verlos y levantarlos en la web.
begin;

do $$
begin
  if to_regclass('public.ban_ip_exceptions') is null then raise exception 'replanteo 151: falta el 150'; end if;
  if exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'ban_ips' and column_name = 'server_id') then
    raise exception 'replanteo 151: ya se aplicó';
  end if;
  if current_user not in ('postgres', 'supabase_admin') then raise exception 'replanteo 151: correr como postgres o supabase_admin'; end if;
end $$;
do $$ begin if current_user = 'supabase_admin' then execute 'set local role postgres'; end if; end $$;

-- =====================================================================================================
-- 1. Baneos por IP sin ficha
-- =====================================================================================================
alter table public.ban_ips alter column ban_id drop not null;
alter table public.ban_ips
  add column reason text check (char_length(reason) <= 200),
  add column created_by_steam text,
  add column created_by_name text check (char_length(created_by_name) <= 64),
  add column server_id uuid references public.game_servers (id) on delete set null,
  add column source text not null default 'web' check (source in ('web', 'server')),
  add column lifted_by_steam text,
  add column lifted_by_name text check (char_length(lifted_by_name) <= 64);
alter table public.ban_ips add constraint ban_ips_ban_or_reason check (ban_id is not null or reason is not null);

-- =====================================================================================================
-- 2. La coincidencia, con excepciones y con los baneos sin ficha
-- =====================================================================================================
create function public.ip_ban_match(p_ip inet, p_player uuid, p_user uuid)
  returns table (id uuid, ban_id uuid, ip inet, reason text, expires_at timestamptz)
  language sql stable security definer set search_path = public as $$
  select i.id, i.ban_id, i.ip, coalesce(b.reason, i.reason), i.expires_at
    from ban_ips i left join bans b on b.id = i.ban_id
   where p_ip is not null and p_ip <<= i.ip and i.lifted_at is null and i.expires_at > now()
     and (i.ban_id is null or (b.lifted_at is null and (b.expires_at is null or b.expires_at > now())))
     and not exists (
       select 1 from ban_ip_exceptions e
        where e.ban_ip_id = i.id
          and ((p_player is not null and e.player_id = p_player)
               or (p_user is not null and (e.user_id = p_user
                                           or e.player_id in (select pl.id from players pl where pl.user_id = p_user)))))
   order by i.expires_at desc
   limit 1
$$;

create or replace function public.ip_banned(p_ip inet) returns boolean
  language sql stable security definer set search_path = public as $$
  select exists (select 1 from ip_ban_match(p_ip, null, null))
$$;

create or replace function public.ip_banned_for(p_ip inet, p_user uuid) returns boolean
  language sql stable security definer set search_path = public as $$
  select exists (select 1 from ip_ban_match(p_ip, null, p_user))
$$;

-- =====================================================================================================
-- 3. Para el plugin
-- =====================================================================================================
create function public.csstv_ban_check_ip(p_token text, p_steam text, p_ip text) returns jsonb
  language plpgsql security definer set search_path = public as $$
declare s64 text; b bans; v_ip inet; v_player uuid; v_user uuid; m record;
begin
  perform csstv_auth(p_token);
  s64 := csstv_steam64(p_steam);
  if s64 is null then return jsonb_build_object('ok', false, 'message', 'SteamID inválido'); end if;
  select * into b from ban_active_for(s64) limit 1;
  if b.id is not null then
    return jsonb_build_object('ok', true, 'banned', true, 'kind', 'steam', 'ban_id', b.id, 'reason', b.reason,
                              'expires', ban_unix(b.expires_at), 'expires_at', b.expires_at);
  end if;
  begin
    v_ip := nullif(btrim(coalesce(p_ip, '')), '')::inet;
  exception when others then
    v_ip := null;
  end;
  v_player := steam_owner(s64);
  select pl.user_id into v_user from players pl where pl.id = v_player;
  select * into m from ip_ban_match(v_ip, v_player, v_user);
  if m.id is not null then
    return jsonb_build_object('ok', true, 'banned', true, 'kind', 'ip', 'ban_ip_id', m.id, 'reason', m.reason,
                              'expires', case when m.expires_at = 'infinity' then 0 else extract(epoch from m.expires_at)::bigint end,
                              'expires_at', case when m.expires_at = 'infinity' then null else m.expires_at end);
  end if;
  return jsonb_build_object('ok', true, 'banned', false);
end $$;

-- La copia local: todas las IPs y rangos activos, con los SteamID64 exceptuados (de las fichas exceptuadas y de las
-- fichas de las cuentas exceptuadas). expires 0 = sin vencimiento.
create function public.csstv_ban_ips_active(p_token text) returns jsonb
  language plpgsql security definer set search_path = public as $$
declare v_items jsonb;
begin
  perform csstv_auth(p_token);
  select coalesce(jsonb_agg(jsonb_build_object(
           'id', i.id, 'ip', ip_text(i.ip), 'reason', coalesce(b.reason, i.reason),
           'expires', case when i.expires_at = 'infinity' then 0 else extract(epoch from i.expires_at)::bigint end,
           'except', coalesce((select jsonb_agg(distinct s.steam_id)
                                 from ban_ip_exceptions e
                                 join player_steam_all s on s.player_id = coalesce(e.player_id,
                                                              (select pl.id from players pl where pl.user_id = e.user_id))
                                where e.ban_ip_id = i.id), '[]'::jsonb))
           order by i.created_at), '[]'::jsonb)
    into v_items
    from ban_ips i left join bans b on b.id = i.ban_id
   where i.lifted_at is null and i.expires_at > now()
     and (i.ban_id is null or (b.lifted_at is null and (b.expires_at is null or b.expires_at > now())));
  return jsonb_build_object('ok', true, 'items', v_items);
end $$;

create function public.csstv_ban_ip_add(p_token text, p_ip text, p_minutes integer, p_reason text, p_admin_steam text,
                                        p_admin_name text, p_ban_id uuid default null) returns jsonb
  language plpgsql security definer set search_path = public as $$
declare v_server uuid; v inet; b bans; v_exp timestamptz; v_id uuid;
begin
  v_server := csstv_auth(p_token);
  begin
    v := ban_ip_parse(p_ip);
  exception when sqlstate 'P0001' then
    return jsonb_build_object('ok', false, 'message', sqlerrm);
  end;
  if p_ban_id is not null then
    -- La IP exacta de un !ban: el mismo vencimiento que el baneo (Daniel, 2026-11-26).
    select * into b from bans where id = p_ban_id;
    if b.id is null then return jsonb_build_object('ok', false, 'message', 'Ese baneo no existe'); end if;
    v_exp := coalesce(b.expires_at, 'infinity'::timestamptz);
  else
    if p_minutes is null or p_minutes < 0 then return jsonb_build_object('ok', false, 'message', 'Duración inválida'); end if;
    v_exp := case when p_minutes = 0 then 'infinity'::timestamptz else now() + p_minutes * interval '1 minute' end;
  end if;
  insert into ban_ips (ban_id, ip, expires_at, reason, created_by_steam, created_by_name, server_id, source)
  values (p_ban_id, v, v_exp,
          case when p_ban_id is null then left(coalesce(nullif(btrim(p_reason), ''), 'Sin motivo (baneado en el servidor)'), 200) end,
          csstv_steam64(p_admin_steam), left(nullif(btrim(p_admin_name), ''), 64), v_server, 'server')
  returning id into v_id;
  return jsonb_build_object('ok', true, 'id', v_id, 'ip', ip_text(v));
end $$;

create function public.csstv_ban_ip_lift(p_token text, p_ip text, p_admin_steam text, p_admin_name text) returns jsonb
  language plpgsql security definer set search_path = public as $$
declare v_server uuid; v inet; n int;
begin
  v_server := csstv_auth(p_token);
  begin
    v := ban_ip_parse(p_ip);
  exception when sqlstate 'P0001' then
    return jsonb_build_object('ok', false, 'message', sqlerrm);
  end;
  update ban_ips set lifted_at = now(), lifted_by_steam = csstv_steam64(p_admin_steam),
                     lifted_by_name = left(nullif(btrim(p_admin_name), ''), 64)
   where ip = v and lifted_at is null;
  get diagnostics n = row_count;
  return jsonb_build_object('ok', true, 'lifted', n);
end $$;

-- Lo mismo en texto compacto, para la copia local del plugin (SourcePawn no lee bien arrays JSON). Solo caracteres
-- seguros, sin escapes: registros separados por ';', campos por '|', SteamID por ','. expires 0 = sin vencimiento.
--   csstv_bans_compact:    STEAM_0:1:23|1767225600;...     (los SteamID de los baneos activos, también los adicionales)
--   csstv_ban_ips_compact: 181.21.0.0/16|1767225600|STEAM_0:1:2,STEAM_0:0:5;...   (solo IPv4: el servidor ve IPv4)
create function public.csstv_bans_compact(p_token text) returns text
  language plpgsql security definer set search_path = public as $$
declare v text;
begin
  perform csstv_auth(p_token);
  select coalesce(string_agg(distinct csstv_steam0(s) || '|' || coalesce(extract(epoch from b.expires_at)::bigint, 0), ';'), '')
    into v
    from bans b, unnest(ban_steams(b.player_id, b.steam_id)) s
   where s is not null and b.lifted_at is null and (b.expires_at is null or b.expires_at > now());
  return v;
end $$;

create function public.csstv_ban_ips_compact(p_token text) returns text
  language plpgsql security definer set search_path = public as $$
declare v text;
begin
  perform csstv_auth(p_token);
  select coalesce(string_agg(
           text(network(i.ip)) || '|' || case when i.expires_at = 'infinity' then 0 else extract(epoch from i.expires_at)::bigint end
           || '|' || coalesce((select string_agg(distinct csstv_steam0(st.steam_id), ',')
                                 from ban_ip_exceptions e
                                 join player_steam_all st on st.player_id = coalesce(e.player_id,
                                                               (select pl.id from players pl where pl.user_id = e.user_id))
                                where e.ban_ip_id = i.id), ''), ';' order by i.created_at), '')
    into v
    from ban_ips i left join bans b on b.id = i.ban_id
   where family(i.ip) = 4 and i.lifted_at is null and i.expires_at > now()
     and (i.ban_id is null or (b.lifted_at is null and (b.expires_at is null or b.expires_at > now())));
  return v;
end $$;

-- =====================================================================================================
-- 4. Los baneos por IP sin ficha, para la web
-- =====================================================================================================
create function public.admin_ban_ips_loose()
  returns table (id uuid, ip text, reason text, expires_at timestamptz, created_at timestamptz, created_by_name text,
                 server_name text, active boolean, exceptions jsonb)
  language plpgsql stable security definer set search_path = public as $$
begin
  if not is_admin() then raise exception 'Solo un admin puede ver las IPs' using errcode = '42501'; end if;
  return query
    select i.id, ip_text(i.ip), i.reason, case when i.expires_at = 'infinity' then null else i.expires_at end, i.created_at,
           coalesce(i.created_by_name, p.tag), g.name, i.lifted_at is null and i.expires_at > now(),
           coalesce((select jsonb_agg(jsonb_build_object('id', e.id, 'player_id', e.player_id, 'user_id', e.user_id,
                                                         'alias', coalesce(pu.tag, pr.tag, pl.nick)) order by e.created_at)
                       from ban_ip_exceptions e
                       left join players pl on pl.id = e.player_id
                       left join profiles pr on pr.id = pl.user_id
                       left join profiles pu on pu.id = e.user_id
                      where e.ban_ip_id = i.id), '[]'::jsonb)
      from ban_ips i left join profiles p on p.id = i.created_by left join game_servers g on g.id = i.server_id
     where i.ban_id is null and i.lifted_at is null and i.expires_at > now()
     order by i.created_at desc;
end $$;

-- admin_ban_ip_lift (149) también sirve para los sin ficha (levanta por id).

revoke all on function public.ip_ban_match(inet, uuid, uuid) from public, anon, authenticated;
revoke all on function public.csstv_ban_check_ip(text, text, text) from public;
revoke all on function public.csstv_ban_ips_active(text) from public;
revoke all on function public.csstv_ban_ip_add(text, text, integer, text, text, text, uuid) from public;
revoke all on function public.csstv_ban_ip_lift(text, text, text, text) from public;
revoke all on function public.admin_ban_ips_loose() from public, anon, authenticated;
grant execute on function public.ip_ban_match(inet, uuid, uuid) to service_role;
-- Las del plugin, como las demás csstv_*: con la clave anon y el token del servidor (csstv_auth).
grant execute on function public.csstv_ban_check_ip(text, text, text) to anon, authenticated, service_role;
grant execute on function public.csstv_ban_ips_active(text) to anon, authenticated, service_role;
grant execute on function public.csstv_ban_ip_add(text, text, integer, text, text, text, uuid) to anon, authenticated, service_role;
grant execute on function public.csstv_ban_ip_lift(text, text, text, text) to anon, authenticated, service_role;
grant execute on function public.admin_ban_ips_loose() to authenticated, service_role;
revoke all on function public.csstv_bans_compact(text) from public;
revoke all on function public.csstv_ban_ips_compact(text) from public;
grant execute on function public.csstv_bans_compact(text) to anon, authenticated, service_role;
grant execute on function public.csstv_ban_ips_compact(text) to anon, authenticated, service_role;

notify pgrst, 'reload schema';
commit;
