-- =============================================================================
-- IPs de los jugadores (bitácora docs/bitacora/2026-10-29-ips-jugadores)
--
-- 1. player_ips: resumen por SteamID64 e IP (primera y última vez, veces, último servidor y nick). No se borra.
-- 2. player_connections: cada entrada con el SteamID validado. Se borra a los 90 días.
-- 3. connect_attempts: conexiones por servidor, IP y hora, también las que no llegan a validar el SteamID
--    (para ver ataques). Se borra a los 90 días.
-- 4. csstv_connections(p_token, p_seen, p_attempts): la llama el reporter (2.6.0) cada 60 segundos con lo que
--    juntó. Responde siempre 200 con {"ok": ...}, como csstv_whois.
--
-- Las tablas no tienen políticas: nadie las lee por la API pública. La IP es un dato personal: solo la ven los
-- admins de la web nueva (replanteo 38).
-- Cómo aplicarla: Supabase > SQL Editor > pegar todo el archivo > Run. Es re-ejecutable.
-- Necesita 20261013120000_licencia_servidores.sql (csstv_auth) y 20261011220000_steamid64_cuentas_nuevas.sql.
-- =============================================================================

begin;

-- -----------------------------------------------------------------------------
-- 1. Tablas
-- -----------------------------------------------------------------------------
create table if not exists public.player_ips (
  steam_id       text not null check (steam_id ~ '^7656[0-9]{13}$'),
  ip             inet not null,
  first_seen_at  timestamptz not null default now(),
  last_seen_at   timestamptz not null default now(),
  times          integer not null default 1 check (times >= 1),
  last_server_id uuid references public.game_servers(id) on delete set null,
  last_nick      text check (length(last_nick) <= 64),
  primary key (steam_id, ip)
);
create index if not exists player_ips_ip on public.player_ips (ip);
comment on table public.player_ips is 'IPs desde las que entró cada SteamID64 (resumen, no se borra). Solo admins. Bitácora 2026-10-29-ips-jugadores';

create table if not exists public.player_connections (
  id        bigint generated always as identity primary key,
  at        timestamptz not null default now(),
  server_id uuid references public.game_servers(id) on delete set null,
  steam_id  text not null check (steam_id ~ '^7656[0-9]{13}$'),
  ip        inet not null,
  nick      text check (length(nick) <= 64)
);
create index if not exists player_connections_steam on public.player_connections (steam_id, at desc);
create index if not exists player_connections_ip on public.player_connections (ip, at desc);
create index if not exists player_connections_at on public.player_connections (at);
comment on table public.player_connections is 'Cada entrada al servidor con el SteamID validado. Se borra a los 90 días. Solo admins';

create table if not exists public.connect_attempts (
  server_id uuid not null references public.game_servers(id) on delete cascade,
  ip        inet not null,
  hour      timestamptz not null,
  count     integer not null check (count >= 1),
  primary key (server_id, ip, hour)
);
create index if not exists connect_attempts_hour on public.connect_attempts (hour);
comment on table public.connect_attempts is 'Conexiones por servidor, IP y hora (también sin SteamID validado), para ver ataques. Se borra a los 90 días. Solo admins';

alter table public.player_ips enable row level security;
alter table public.player_connections enable row level security;
alter table public.connect_attempts enable row level security;
revoke all on public.player_ips, public.player_connections, public.connect_attempts from anon, authenticated;

-- -----------------------------------------------------------------------------
-- 2. La función del plugin
-- -----------------------------------------------------------------------------
-- IP válida o null (sin máscara: una sola dirección).
create or replace function public.csstv_ip(p text) returns inet language plpgsql immutable as $$
begin
  if p is null or length(p) > 45 or position('/' in p) > 0 then return null; end if;
  return host(p::inet)::inet;
exception when others then
  return null;
end $$;

-- p_seen: [{"steam": "STEAM_0:1:2", "ip": "1.2.3.4", "nick": "x"}] (hasta 64).
-- p_attempts: [{"ip": "1.2.3.4", "n": 3}] (hasta 256). Lo que no sirve se descarta sin error.
create or replace function public.csstv_connections(p_token text, p_seen jsonb default '[]', p_attempts jsonb default '[]')
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_sid  uuid;
  v_hour timestamptz := date_trunc('hour', now());
  e      jsonb;
  v_s64  text;
  v_ip   inet;
  v_nick text;
  n_seen integer := 0;
  n_att  integer := 0;
begin
  begin
    v_sid := csstv_auth(p_token);
  exception when others then
    return jsonb_build_object('ok', false, 'error', sqlerrm);
  end;

  if jsonb_typeof(p_seen) = 'array' then
    for e in select x from jsonb_array_elements(p_seen) x limit 64 loop
      begin
        v_s64 := csstv_steam64(left(e ->> 'steam', 40));
      exception when others then   -- un número que no entra en bigint
        v_s64 := null;
      end;
      v_ip := csstv_ip(e ->> 'ip');
      continue when v_s64 is null or v_s64 !~ '^7656[0-9]{13}$' or v_ip is null;
      v_nick := nullif(left(btrim(coalesce(e ->> 'nick', '')), 64), '');
      insert into player_connections(server_id, steam_id, ip, nick) values (v_sid, v_s64, v_ip, v_nick);
      insert into player_ips as p (steam_id, ip, last_server_id, last_nick) values (v_s64, v_ip, v_sid, v_nick)
      on conflict (steam_id, ip) do update
        set last_seen_at = now(), times = p.times + 1, last_server_id = excluded.last_server_id,
            last_nick = coalesce(excluded.last_nick, p.last_nick);
      n_seen := n_seen + 1;
    end loop;
  end if;

  if jsonb_typeof(p_attempts) = 'array' then
    for e in select x from jsonb_array_elements(p_attempts) x limit 256 loop
      v_ip := csstv_ip(e ->> 'ip');
      continue when v_ip is null or coalesce(jsonb_typeof(e -> 'n'), '') <> 'number';
      insert into connect_attempts as a (server_id, ip, hour, count)
      values (v_sid, v_ip, v_hour, greatest(1, least((e ->> 'n')::numeric, 100000))::integer)
      on conflict (server_id, ip, hour) do update set count = least(a.count + excluded.count, 2000000000);
      n_att := n_att + 1;
    end loop;
  end if;

  -- Sin pg_cron: de vez en cuando, borra lo que tiene más de 90 días.
  if random() < 0.02 then
    delete from player_connections where at < now() - interval '90 days';
    delete from connect_attempts where hour < now() - interval '90 days';
  end if;

  return jsonb_build_object('ok', true, 'seen', n_seen, 'attempts', n_att);
end $$;

revoke all on function public.csstv_connections(text, jsonb, jsonb) from public;
grant execute on function public.csstv_connections(text, jsonb, jsonb) to anon, authenticated, service_role;
revoke all on function public.csstv_ip(text) from public, anon, authenticated;

commit;

-- -----------------------------------------------------------------------------
-- Consultas útiles (SQL Editor)
-- -----------------------------------------------------------------------------
-- IPs de un SteamID:      select * from player_ips where steam_id = csstv_steam64('STEAM_0:1:12345') order by last_seen_at desc;
-- SteamID de una IP:      select * from player_ips where ip = '1.2.3.4' order by last_seen_at desc;
-- Más intentos (24 h):    select server_id, ip, sum(count) from connect_attempts where hour > now() - interval '24 hours'
--                           group by 1, 2 order by 3 desc limit 20;
