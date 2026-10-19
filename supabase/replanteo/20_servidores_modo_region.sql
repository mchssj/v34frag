-- Replanteo 20: modo y región de cada servidor (plan docs/bitacora/2026-10-19-api-servidores-ping-modo-region).
--   - game_servers.mode (lista fija) y game_servers.region (texto libre de 2 a 30 caracteres).
--   - game_servers_public y admin_server_list los suman al final; la búsqueda del admin incluye la región.
--   - admin_create_server acepta p_mode y p_region.
-- NO aplicar en producción antes del corte (ver README.md).
begin;

do $$
begin
  if to_regclass('public.admin_server_list') is null then
    raise exception 'replanteo 20: falta admin_server_list (aplicar antes 12_servidores.sql)';
  end if;
  if exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'game_servers' and column_name = 'mode') then
    raise exception 'replanteo 20: game_servers ya tiene mode (¿ya se aplicó?)';
  end if;
end $$;

alter table public.game_servers
  add column mode text constraint game_servers_mode_check
    check (mode in ('mix', 'competitive', 'public', 'deathmatch', 'retakes', 'practice')),
  add column region text constraint game_servers_region_check
    check (region = trim(region) and char_length(region) between 2 and 30);
comment on column public.game_servers.mode is 'Modo de juego: mix, competitive, public, deathmatch, retakes o practice (replanteo 20)';
comment on column public.game_servers.region is 'Región para mostrar en la web, texto libre (replanteo 20)';

create or replace view public.game_servers_public as
select id, name, connect_address, mode, region from game_servers
 where active and (license_expires_at is null or license_expires_at > now()); -- (replanteo 12)

-- Como en la 12, con mode y region al final y la región en la búsqueda.
create or replace view public.admin_server_list with (security_invoker = true) as
select g.id, g.name, g.active, g.created_at, g.last_seen_at, g.connect_address, g.panel_server_id,
       g.license_expires_at, g.allowed_ip, g.last_ip, g.plugin_version,
       case when not g.active then 'revoked'
            when g.license_expires_at <= now() then 'expired'
            when g.license_expires_at <= now() + interval '7 days' then 'expiring'
            else 'ok' end as license_state,
       coalesce(g.last_seen_at > now() - interval '35 minutes', false) as online,
       g.panel_server_id is not null as has_panel,
       (select count(*)::int from matches m where m.server_id = g.id) as matches,
       (select max(coalesce(m.played_at, m.starts_at)) from matches m where m.server_id = g.id) as last_match_at,
       search_norm(concat_ws(' ', g.name, g.connect_address, g.allowed_ip, g.last_ip, g.plugin_version, g.region)) as search,
       g.mode, g.region
  from game_servers g;

drop function public.admin_create_server(text, text, text, timestamptz, text);
create function public.admin_create_server(p_name text, p_connect_address text default null, p_panel_server_id text default null,
                                           p_license_expires_at timestamptz default null, p_allowed_ip text default null,
                                           p_mode text default null, p_region text default null)
  returns table(id uuid, token text) language plpgsql security definer set search_path = public as $$
declare v_token text; v_id uuid;
begin
  if not is_admin() then raise exception 'Solo un admin puede crear servidores' using errcode = '42501'; end if;
  if char_length(trim(coalesce(p_name, ''))) not between 2 and 40 then
    raise exception 'El nombre tiene que tener entre 2 y 40 caracteres';
  end if;
  if exists (select 1 from game_servers g where lower(trim(g.name)) = lower(trim(p_name))) then
    raise exception 'Ya hay un servidor con ese nombre' using errcode = '23505';
  end if;
  v_token := 'csstv_' || replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', '');
  insert into game_servers(name, token_hash, connect_address, panel_server_id, license_expires_at, allowed_ip, mode, region)
  values (trim(p_name), encode(sha256(convert_to(v_token, 'UTF8')), 'hex'), nullif(trim(p_connect_address), ''),
          nullif(trim(p_panel_server_id), ''), p_license_expires_at, nullif(trim(p_allowed_ip), ''),
          nullif(trim(p_mode), ''), nullif(trim(p_region), ''))
  returning game_servers.id into v_id;
  return query select v_id, v_token;
end $$;
revoke all on function public.admin_create_server(text, text, text, timestamptz, text, text, text) from public, anon;
grant execute on function public.admin_create_server(text, text, text, timestamptz, text, text, text) to authenticated;

commit;
