-- Replanteo 14: demos desde el admin (plan docs/bitacora/2026-10-16-api-demos-admin).
-- Tokens del Worker de demos con nombre único, alta que devuelve id y token, token nuevo, reintentar una demo
-- perdida y vistas para el admin (listado de demos, Workers y resumen).
-- NO aplicar en producción antes del corte (ver README.md).
begin;

do $$
declare rep text;
begin
  if to_regprocedure('public.elo_simulate(integer, integer, numeric, integer, integer, integer, integer)') is null then
    raise exception 'replanteo 14: falta elo_simulate (aplicar antes 13_elo_simulacion.sql)';
  end if;
  if to_regclass('public.admin_demo_list') is not null then
    raise exception 'replanteo 14: admin_demo_list ya existe (¿ya se aplicó?)';
  end if;
  select string_agg(n, ', ') into rep from (
    select min(name) as n from demo_workers group by lower(trim(name)) having count(*) > 1) x;
  if rep is not null then
    raise exception 'replanteo 14: hay Workers de demos con el mismo nombre (sin distinguir mayúsculas): %. Renombrarlos antes', rep;
  end if;
end $$;

create unique index demo_workers_name_key on public.demo_workers (lower(trim(name)));
alter table public.demo_workers add constraint demo_workers_name_len check (char_length(trim(name)) between 2 and 40);

-- Alta de un Worker: devuelve su id y el token, que se muestra una sola vez.
create function public.admin_create_demo_worker(p_name text) returns table(id uuid, token text)
  language plpgsql security definer set search_path = public as $$
declare v_token text; v_id uuid;
begin
  if not is_admin() then raise exception 'Solo un admin puede crear Workers de demos' using errcode = '42501'; end if;
  if char_length(trim(coalesce(p_name, ''))) not between 2 and 40 then
    raise exception 'El nombre tiene que tener entre 2 y 40 caracteres';
  end if;
  if exists (select 1 from demo_workers w where lower(trim(w.name)) = lower(trim(p_name))) then
    raise exception 'Ya hay un Worker con ese nombre' using errcode = '23505';
  end if;
  v_token := 'demow_' || replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', '');
  insert into demo_workers(name, token_hash) values (trim(p_name), encode(sha256(convert_to(v_token, 'UTF8')), 'hex'))
  returning demo_workers.id into v_id;
  return query select v_id, v_token;
end $$;

-- Token nuevo para un Worker (el anterior deja de funcionar y el Worker queda activo).
create function public.rotate_demo_worker_token(p_worker uuid) returns text
  language plpgsql security definer set search_path = public as $$
declare v_token text;
begin
  if not is_admin() then raise exception 'Solo un admin puede cambiar tokens' using errcode = '42501'; end if;
  v_token := 'demow_' || replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', '');
  update demo_workers set token_hash = encode(sha256(convert_to(v_token, 'UTF8')), 'hex'), active = true where id = p_worker;
  if not found then raise exception 'No existe ese Worker'; end if;
  return v_token;
end $$;

-- Reintentar una demo perdida: vuelve a la cola del Worker con los intentos en 0.
create function public.admin_demo_retry(p_match uuid) returns void
  language plpgsql security definer set search_path = public as $$
declare m record;
begin
  if not is_admin() then raise exception 'Solo un admin puede reintentar demos' using errcode = '42501'; end if;
  select x.demo_status, g.panel_server_id into m from matches x left join game_servers g on g.id = x.server_id where x.id = p_match;
  if not found then raise exception 'No existe esa partida'; end if;
  if m.demo_status <> 'missing' then
    raise exception '%', case m.demo_status
      when 'pending'  then 'La demo ya está en la cola del Worker'
      when 'uploaded' then 'La demo ya está subida'
      when 'expired'  then 'La demo venció: ya no está en R2 ni en el servidor'
      else 'Esta partida no tiene demo' end;
  end if;
  if m.panel_server_id is null then
    raise exception 'El servidor de esta partida no tiene id del panel: el Worker no puede bajar la demo';
  end if;
  update matches set demo_status = 'pending', demo_attempts = 0 where id = p_match;
end $$;

revoke all on function public.admin_create_demo_worker(text) from public, anon;
revoke all on function public.rotate_demo_worker_token(uuid) from public, anon;
revoke all on function public.admin_demo_retry(uuid) from public, anon;
grant execute on function public.admin_create_demo_worker(text) to authenticated;
grant execute on function public.rotate_demo_worker_token(uuid) to authenticated;
grant execute on function public.admin_demo_retry(uuid) to authenticated;

-- Para el admin: corren como su dueño y filtran por is_admin() (como las de la 11).
-- Las demos se guardan 90 días en R2 (cron del Worker y regla demos-90-dias).
create view public.admin_demo_list as
select m.id, m.kind, m.status, m.map, m.played_at, m.external_id, m.parent_match_id,
       m.side1_name, m.side2_name, m.score1, m.score2,
       m.server_id, g.name as server_name, g.panel_server_id is not null as server_has_panel,
       m.demo_status, m.demo_size, m.demo_attempts, m.demo_uploaded_at,
       case when m.demo_status = 'uploaded' then m.demo_uploaded_at + interval '90 days' end as expires_at,
       search_norm(concat_ws(' ', m.side1_name, m.side2_name, m.map, g.name, m.external_id)) as search
  from matches m left join game_servers g on g.id = m.server_id
 where m.demo_status <> 'none' and is_admin();
grant select on public.admin_demo_list to authenticated;

create view public.admin_demo_worker_list as
select w.id, w.name, w.active, w.created_at, w.last_seen_at,
       coalesce(w.last_seen_at > now() - interval '25 minutes', false) as online,
       search_norm(w.name) as search
  from demo_workers w
 where is_admin();
grant select on public.admin_demo_worker_list to authenticated;

create view public.admin_demo_summary as
select count(*) filter (where m.demo_status = 'pending')::int  as pending,
       count(*) filter (where m.demo_status = 'uploaded')::int as uploaded,
       count(*) filter (where m.demo_status = 'missing')::int  as missing,
       count(*) filter (where m.demo_status = 'expired')::int  as expired,
       coalesce(sum(m.demo_size) filter (where m.demo_status = 'uploaded'), 0)::bigint as uploaded_bytes,
       min(coalesce(m.played_at, m.starts_at)) filter (where m.demo_status = 'pending') as oldest_pending_at,
       (select max(w.last_seen_at) from demo_workers w where w.active) as worker_last_seen_at,
       exists (select 1 from demo_workers w where w.active and w.last_seen_at > now() - interval '25 minutes') as worker_online
  from matches m
 where m.demo_status <> 'none' and is_admin()
having is_admin();
grant select on public.admin_demo_summary to authenticated;

commit;
