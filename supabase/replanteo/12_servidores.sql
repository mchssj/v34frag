-- Replanteo 12: admin de servidores (plan docs/bitacora/2026-10-16-api-admin-servidores).
-- Nombre único, IP permitida válida, alta que devuelve id y token, borrar solo sin partidas, vista para el
-- listado del admin, y solo servidores con licencia vigente para asignar partidas.
-- NO aplicar en producción antes del corte (ver README.md).
begin;

do $$
declare rep text;
begin
  if to_regclass('public.match_list') is null then
    raise exception 'replanteo 12: falta match_list (aplicar antes 11_listados.sql)';
  end if;
  if to_regclass('public.admin_server_list') is not null then
    raise exception 'replanteo 12: admin_server_list ya existe (¿ya se aplicó?)';
  end if;
  select string_agg(n, ', ') into rep from (
    select min(name) as n from game_servers group by lower(trim(name)) having count(*) > 1) x;
  if rep is not null then
    raise exception 'replanteo 12: hay nombres de servidor repetidos (sin distinguir mayúsculas): %. Renombrarlos antes', rep;
  end if;
end $$;

-- IPv4 o IPv6 sin máscara.
create function public.is_ip(p text) returns boolean language plpgsql immutable as $$
begin
  return p is not null and position('/' in p) = 0 and p::inet is not null;
exception when others then
  return false;
end $$;

do $$
begin
  if exists (select 1 from game_servers where allowed_ip is not null and not is_ip(trim(allowed_ip))) then
    raise exception 'replanteo 12: hay servidores con una IP permitida inválida. Corregirla antes';
  end if;
end $$;

create unique index game_servers_name_key on public.game_servers (lower(trim(name)));
alter table public.game_servers add constraint game_servers_name_len check (char_length(trim(name)) between 2 and 40);
alter table public.game_servers add constraint game_servers_allowed_ip_format check (allowed_ip is null or is_ip(allowed_ip));

-- Alta de un servidor: devuelve su id (para el build licenciado) y el token, que se muestra una sola vez.
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

-- Un servidor con partidas no se borra: se revoca (sus partidas y demos pendientes lo necesitan).
create function public.game_servers_no_borrar_con_partidas() returns trigger language plpgsql set search_path = public as $$
begin
  if exists (select 1 from matches where server_id = old.id) then
    raise exception 'Este servidor tiene partidas: revocalo en vez de borrarlo';
  end if;
  return old;
end $$;
create trigger game_servers_no_borrar_con_partidas before delete on public.game_servers
  for each row execute function public.game_servers_no_borrar_con_partidas();

-- Listado del admin: sin token_hash, con estado de licencia, en línea, partidas y búsqueda.
-- security_invoker: la RLS "servidores: admin gestiona" deja verla solo al admin.
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

-- Para asignar partidas: solo activos con licencia vigente.
create or replace view public.game_servers_public as
select id, name, connect_address from game_servers
 where active and (license_expires_at is null or license_expires_at > now()); -- (replanteo 12)

create function pg_temp.reemplazar(fn regprocedure, cambios text[][]) returns void language plpgsql as $$
declare d text := pg_get_functiondef(fn); i int;
begin
  for i in 1 .. array_length(cambios, 1) loop
    if position(cambios[i][1] in d) = 0 then
      raise exception 'replanteo 12: en % no se encontró: %', fn, left(cambios[i][1], 80);
    end if;
    d := replace(d, cambios[i][1], cambios[i][2]);
  end loop;
  execute d;
end $$;

select pg_temp.reemplazar('public.match_schedule(uuid, timestamptz, uuid)', array[
  ['select 1 from game_servers where id = p_server and active) then raise exception ''Ese servidor no existe o no está activo''; end if;',
   'select 1 from game_servers where id = p_server and active' || E'\n' ||
   '      and (license_expires_at is null or license_expires_at > now())) then -- (replanteo 12) licencia vigente' || E'\n' ||
   '    raise exception ''Ese servidor no existe, no está activo o tiene la licencia vencida'';' || E'\n' ||
   '  end if;']
]);

commit;
