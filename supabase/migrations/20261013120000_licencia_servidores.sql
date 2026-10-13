-- =============================================================================
-- Licencia por servidor
--
-- El plugin 1.5.0 llama a csstv_license(token, versión) al cargar cada mapa y cada
-- 30 minutos; sin un "ok" no deja empezar mixes. El token es el mismo
-- csstv_server_token de siempre. Columnas nuevas en game_servers:
--   license_expires_at  vencimiento de la licencia (null = no vence)
--   allowed_ip          única IP desde la que se acepta el token (null = cualquiera)
--   last_ip             IP que vio Supabase en la última conexión válida
--   plugin_version      versión del plugin que informó el servidor
-- csstv_auth (la usa ingest_server_chunk) aplica las mismas reglas, así que un
-- plugin parcheado tampoco puede subir resultados sin licencia.
--
-- Con las columnas nuevas vacías no cambia nada para los servidores existentes.
-- Cómo aplicarla: Supabase > SQL Editor > pegar todo el archivo > Run.
-- Es re-ejecutable.
-- =============================================================================

begin;

alter table public.game_servers add column if not exists license_expires_at timestamptz;
alter table public.game_servers add column if not exists allowed_ip         text;
alter table public.game_servers add column if not exists last_ip            text;
alter table public.game_servers add column if not exists plugin_version     text;

-- IP del que llama, según las cabeceras que PostgREST deja en request.headers.
create or replace function public.csstv_request_ip()
returns text language plpgsql stable set search_path = public as $$
declare h jsonb;
begin
  h := nullif(current_setting('request.headers', true), '')::jsonb;
  return nullif(trim(coalesce(h->>'cf-connecting-ip', split_part(h->>'x-forwarded-for', ',', 1))), '');
exception when others then
  return null;
end $$;

-- Valida el token. reason: null (ok), 'token' (no existe o revocado), 'expired' o 'ip'.
create or replace function public.csstv_check_token(p_token text, out sid uuid, out reason text)
language plpgsql security definer set search_path = public as $$
declare
  g  game_servers%rowtype;
  ip text := csstv_request_ip();
begin
  select * into g from game_servers
   where token_hash = encode(sha256(convert_to(coalesce(p_token, ''), 'UTF8')), 'hex');
  if g.id is null or not g.active then
    reason := 'token';
  elsif g.license_expires_at is not null and g.license_expires_at <= now() then
    reason := 'expired';
  elsif nullif(trim(g.allowed_ip), '') is not null and ip is distinct from trim(g.allowed_ip) then
    reason := 'ip';
  else
    update game_servers set last_seen_at = now(), last_ip = coalesce(ip, last_ip) where id = g.id;
    sid := g.id;
  end if;
end $$;

-- Misma firma que en 20261011120000. Error PT401 => HTTP 401.
create or replace function public.csstv_auth(p_token text)
returns uuid language plpgsql security definer set search_path = public as $$
declare r record;
begin
  select * into r from csstv_check_token(p_token);
  if r.reason = 'expired' then
    raise exception 'La licencia del servidor venció' using errcode = 'PT401';
  elsif r.reason = 'ip' then
    raise exception 'El token no está autorizado desde esta IP' using errcode = 'PT401';
  elsif r.sid is null then
    raise exception 'Token de servidor inválido o revocado' using errcode = 'PT401';
  end if;
  return r.sid;
end $$;

-- La llama el plugin. Responde siempre 200 con {"ok": ...} para que el plugin
-- distinga un "no" de Supabase de una falla de red.
create or replace function public.csstv_license(p_token text, p_version text default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  r record;
  g game_servers%rowtype;
begin
  select * into r from csstv_check_token(p_token);
  if r.sid is null then
    return jsonb_build_object('ok', false, 'reason', r.reason);
  end if;
  update game_servers set plugin_version = left(nullif(trim(p_version), ''), 20)
   where id = r.sid and p_version is not null
   returning * into g;
  if g.id is null then
    select * into g from game_servers where id = r.sid;
  end if;
  return jsonb_build_object('ok', true, 'server_id', g.id, 'name', g.name, 'expires_at', g.license_expires_at);
end $$;

revoke all on function public.csstv_request_ip()             from public, anon, authenticated;
revoke all on function public.csstv_check_token(text)        from public, anon, authenticated;
revoke all on function public.csstv_auth(text)               from public, anon, authenticated;
revoke all on function public.csstv_license(text, text)      from public;
grant execute on function public.csstv_license(text, text)   to anon, authenticated;

commit;

notify pgrst, 'reload schema';
