-- Inversa de supabase/replanteo/20_servidores_modo_region.sql: deja los servidores como después de la 12.
-- create or replace no puede quitar columnas: las vistas se borran y se vuelven a crear (no hay vistas que dependan de ellas).
-- Se pierden el modo y la región cargados.
begin;

do $$
begin
  if not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'game_servers' and column_name = 'mode') then
    raise exception 'inversa 20: game_servers no tiene mode (¿no se aplicó la 20?)';
  end if;
end $$;

drop view public.game_servers_public;
create view public.game_servers_public as
select id, name, connect_address from game_servers
 where active and (license_expires_at is null or license_expires_at > now()); -- (replanteo 12)
grant select on public.game_servers_public to anon, authenticated;

drop view public.admin_server_list;
create view public.admin_server_list with (security_invoker = true) as
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
       search_norm(concat_ws(' ', g.name, g.connect_address, g.allowed_ip, g.last_ip, g.plugin_version)) as search
  from game_servers g;
grant select on public.admin_server_list to authenticated;

drop function public.admin_create_server(text, text, text, timestamptz, text, text, text);
create function public.admin_create_server(p_name text, p_connect_address text default null, p_panel_server_id text default null,
                                           p_license_expires_at timestamptz default null, p_allowed_ip text default null)
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
  insert into game_servers(name, token_hash, connect_address, panel_server_id, license_expires_at, allowed_ip)
  values (trim(p_name), encode(sha256(convert_to(v_token, 'UTF8')), 'hex'), nullif(trim(p_connect_address), ''),
          nullif(trim(p_panel_server_id), ''), p_license_expires_at, nullif(trim(p_allowed_ip), ''))
  returning game_servers.id into v_id;
  return query select v_id, v_token;
end $$;
revoke all on function public.admin_create_server(text, text, text, timestamptz, text) from public, anon;
grant execute on function public.admin_create_server(text, text, text, timestamptz, text) to authenticated;

alter table public.game_servers drop column mode, drop column region;

commit;
