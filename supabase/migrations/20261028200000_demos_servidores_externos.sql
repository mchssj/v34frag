-- =============================================================================
-- Demos de los servidores externos: API key primero, SFTP después
-- (bitácora docs/bitacora/2026-10-28-demos-servidores-externos)
--
-- 1. game_servers.panel_url: el panel de cada servidor (vacío = el del Worker, Extreme Host).
-- 2. matches.demo_via: null = la toma el Worker (API del panel); 'sftp' = la toma la tarea de
--    SFTP del VPS. Una demo está en una sola cola a la vez.
-- 3. demo_pending(p_token, p_limit, p_via): 'api' (por defecto) o 'sftp'; devuelve panel_url.
--    El Worker de hoy sigue funcionando sin cambios: llama sin p_via.
-- 4. demo_fallback: el Worker pasa una demo a SFTP (sin key o la API falló), sin gastar intento.
-- 5. demo_mark vacía demo_via: 'uploaded' termina y 'retry' vuelve a empezar por la API.
--
-- Cómo aplicarla: Supabase > SQL Editor > pegar todo el archivo > Run. Es re-ejecutable.
-- Necesita 20261012120000_demos_y_canceladas.sql.
-- Después: cargar panel_server_id de RBK y flow (ver el final del archivo).
-- =============================================================================

begin;

-- -----------------------------------------------------------------------------
-- 1. Columnas nuevas
-- -----------------------------------------------------------------------------
alter table public.game_servers add column if not exists panel_url text;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'game_servers_panel_url_check') then
    alter table public.game_servers add constraint game_servers_panel_url_check
      check (panel_url is null or panel_url ~ '^https://[A-Za-z0-9.-]+(:[0-9]{1,5})?$');
  end if;
end $$;

alter table public.matches add column if not exists demo_via             text;
alter table public.matches add column if not exists demo_fallback_reason text;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'matches_demo_via_check') then
    alter table public.matches add constraint matches_demo_via_check check (demo_via is null or demo_via = 'sftp');
  end if;
end $$;

-- -----------------------------------------------------------------------------
-- 2. Funciones del Worker y de la tarea de SFTP (las dos con el token de demo_workers)
-- -----------------------------------------------------------------------------

-- Cambia el tipo de retorno (suma panel_url) y el parámetro p_via: hay que borrar la de 2 parámetros,
-- si no quedan dos y PostgREST no sabe cuál llamar.
drop function if exists public.demo_pending(text, integer);

-- Partidas con demo por subir, de la más vieja a la más nueva, de la cola pedida:
--   'api'  las que no pasaron a SFTP (las toma el Worker);
--   'sftp' las que el Worker pasó a SFTP (las toma la tarea del VPS).
-- Solo las de servidores con panel_server_id: es la llave de las credenciales en los dos lados.
create or replace function public.demo_pending(p_token text, p_limit integer default 10, p_via text default 'api')
returns table(external_id text, panel_server_id text, panel_url text, server_name text, map text, status text,
              score1 integer, score2 integer, played_at timestamptz, attempts integer)
language plpgsql security definer set search_path = public as $$
begin
  perform demo_auth(p_token);
  if coalesce(p_via, '') not in ('api', 'sftp') then
    raise exception 'Cola inválida: usá api o sftp' using errcode = 'PT422';
  end if;
  return query
    select m.external_id, g.panel_server_id, g.panel_url, g.name, m.map, m.status,
           m.score1, m.score2, m.played_at, m.demo_attempts
      from matches m join game_servers g on g.id = m.server_id
     where m.demo_status = 'pending' and g.panel_server_id is not null
       and m.demo_via is not distinct from (case when p_via = 'sftp' then 'sftp' end)
     order by m.played_at
     limit least(greatest(coalesce(p_limit, 10), 1), 50);
end $$;

-- El Worker no pudo usar la API (sin key, acceso rechazado o panel caído): la demo pasa a la cola de
-- SFTP sin gastar intento. Solo una demo pendiente que todavía no estaba en SFTP. Devuelve 'sftp' si
-- la pasó o el estado de la demo si no.
create or replace function public.demo_fallback(p_token text, p_uid text, p_reason text default null)
returns text language plpgsql security definer set search_path = public as $$
declare v_status text; v_via text;
begin
  perform demo_auth(p_token);
  update matches set demo_via = 'sftp', demo_fallback_reason = left(nullif(trim(p_reason), ''), 200)
   where external_id = p_uid and demo_status = 'pending' and demo_via is null
  returning demo_via into v_via;
  if v_via is not null then return v_via; end if;
  select demo_status, demo_via into v_status, v_via from matches where external_id = p_uid;
  if v_status is null then raise exception 'La partida no existe' using errcode = 'PT422'; end if;
  return coalesce(v_via, v_status);
end $$;

-- Resultado de un intento de subida (por la API o por SFTP):
--   'uploaded' con la ruta en R2 y el tamaño;
--   'retry' si la demo no estaba o falló algo (a los 6 intentos queda 'missing').
-- Las dos vacían demo_via: un reintento vuelve a empezar por la API.
-- Devuelve el estado en que quedó la demo.
create or replace function public.demo_mark(p_token text, p_uid text, p_result text,
                                            p_key text default null, p_size bigint default null)
returns text language plpgsql security definer set search_path = public as $$
declare v_status text;
begin
  perform demo_auth(p_token);
  if p_result = 'uploaded' then
    if p_key is null or p_key !~ '^demos/[0-9]{4}/[0-9]{2}/[A-Za-z0-9_-]{6,80}\.dem$' then
      raise exception 'Ruta de R2 inválida' using errcode = 'PT422';
    end if;
    if p_size is null or p_size <= 0 then
      raise exception 'Tamaño inválido' using errcode = 'PT422';
    end if;
    update matches
       set demo_status = 'uploaded', demo_key = p_key, demo_size = p_size,
           demo_uploaded_at = now(), demo_attempts = demo_attempts + 1, demo_via = null
     where external_id = p_uid and demo_status in ('pending', 'missing')
    returning demo_status into v_status;
  elsif p_result = 'retry' then
    update matches
       set demo_attempts = demo_attempts + 1,
           demo_status   = case when demo_attempts + 1 >= 6 then 'missing' else 'pending' end,
           demo_via      = null
     where external_id = p_uid and demo_status = 'pending'
    returning demo_status into v_status;
  else
    raise exception 'Resultado inválido: usá uploaded o retry' using errcode = 'PT422';
  end if;
  if v_status is null then
    select demo_status into v_status from matches where external_id = p_uid;
    if v_status is null then raise exception 'La partida no existe' using errcode = 'PT422'; end if;
  end if;
  return v_status;
end $$;

-- -----------------------------------------------------------------------------
-- 3. Permisos
-- -----------------------------------------------------------------------------
revoke all on function public.demo_pending(text, integer, text)  from public;
revoke all on function public.demo_fallback(text, text, text)    from public;
grant execute on function public.demo_pending(text, integer, text) to anon, authenticated;
grant execute on function public.demo_fallback(text, text, text)   to anon, authenticated;

commit;

-- Que PostgREST vea las funciones nuevas sin esperar.
notify pgrst, 'reload schema';

-- -----------------------------------------------------------------------------
-- Después de aplicarla (una sola vez, en el SQL Editor): los ids del panel de RBK y flow y el panel de
-- flow. Los valores están en la guía de implementación de la bitácora (salen del usuario de SFTP).
--
--   select id, name, panel_server_id, panel_url from game_servers order by name;
--   update game_servers set panel_server_id = '<id de RBK>' where id = 'be0fd76c-6bdc-477e-a843-6efc309b5ca9';
--   update game_servers set panel_server_id = '<id de flow>', panel_url = 'https://<panel de flow>'
--    where id = '<id de flow en game_servers>';
-- -----------------------------------------------------------------------------
