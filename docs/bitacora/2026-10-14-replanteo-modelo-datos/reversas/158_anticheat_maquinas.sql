-- Inversa de supabase/replanteo/158_anticheat_maquinas.sql. Borra las mÃ¡quinas y sus baneos. Los baneos por evasiÃ³n pasan a
-- source = 'web' (siguen activos: levantarlos a mano si corresponde).
begin;

do $$
begin
  if to_regclass('public.ac_machines') is null then raise exception 'inversa 158: no existe ac_machines (Â¿no se aplicÃ³ la 158?)'; end if;
end $$;

drop function public.ac_admin_machine_accounts(uuid);
drop function public.ac_admin_ban_machine(uuid, text);
drop function public.ac_admin_lift_machine(uuid, text);
drop function public.ac_admin_machine_exception(uuid, uuid, text);
drop function public.ac_session_machine(uuid);

-- Vuelven los lugares vacÃ­os de la 157.
create or replace function public.ac_heartbeat_machine(p_device uuid, p_hw jsonb) returns boolean language sql stable as $$ select false $$;
create or replace function public.ac_device_machine_banned(p_device uuid) returns boolean language sql stable as $$ select false $$;
revoke all on function public.ac_heartbeat_machine(uuid, jsonb), public.ac_device_machine_banned(uuid) from public, anon, authenticated;

drop function public.ac_link_start(text, text, text, jsonb, text);
create function public.ac_link_start(p_secret text, p_device_name text, p_version text) returns jsonb
  language plpgsql security definer set search_path = public as $$
declare
  v_device text := ac_token('fragd_');
  v_user   text;
begin
  perform ac_require_api(p_secret);
  delete from ac_link_requests where expires_at < now() - interval '1 day';
  loop
    v_user := ac_user_code();
    exit when not exists (select 1 from ac_link_requests where user_code = v_user);
  end loop;
  insert into ac_link_requests (device_code_hash, user_code, device_name, agent_version, expires_at)
    values (ac_hash(v_device), v_user, p_device_name, p_version, now() + interval '10 minutes');
  return jsonb_build_object('device_code', v_device, 'user_code', v_user, 'expires_in', 600);
end $$;
revoke all on function public.ac_link_start(text, text, text) from public, anon, authenticated;
grant execute on function public.ac_link_start(text, text, text) to anon, authenticated;

create or replace function public.ac_link_approve(p_user_code text) returns jsonb
  language plpgsql security definer set search_path = public as $$
declare
  r ac_link_requests%rowtype;
begin
  if auth.uid() is null then raise exception 'Hay que iniciar sesión' using errcode = '42501'; end if;
  if not exists (select 1 from players where user_id = auth.uid() and steam_id is not null) then
    raise exception 'Primero vincula tu SteamID a tu perfil';
  end if;
  select * into r from ac_link_requests where user_code = upper(trim(coalesce(p_user_code, ''))) for update;
  if r.id is null or r.expires_at <= now() or r.claimed_at is not null then
    raise exception 'El código no existe o venció';
  end if;
  if r.approved_by is not null and r.approved_by <> auth.uid() then
    raise exception 'El código no existe o venció';
  end if;
  update ac_link_requests set approved_by = auth.uid(), approved_at = coalesce(approved_at, now()) where id = r.id;
  return jsonb_build_object('device_name', r.device_name);
end $$;

create or replace function public.ac_link_claim(p_secret text, p_device_code text) returns jsonb
  language plpgsql security definer set search_path = public as $$
declare
  r         ac_link_requests%rowtype;
  v_access  text := ac_token('fraga_');
  v_refresh text := ac_token('fragr_');
  v_id      uuid;
begin
  perform ac_require_api(p_secret);
  select * into r from ac_link_requests where device_code_hash = ac_hash(p_device_code) for update;
  if r.id is null or r.claimed_at is not null or r.expires_at <= now() then
    return jsonb_build_object('status', 'expired');
  end if;
  if r.approved_by is null then return jsonb_build_object('status', 'pending'); end if;
  insert into ac_devices (user_id, name, agent_version, access_hash, access_expires_at, refresh_hash)
    values (r.approved_by, r.device_name, r.agent_version, ac_hash(v_access), now() + interval '15 minutes', ac_hash(v_refresh))
    returning id into v_id;
  update ac_link_requests set claimed_at = now() where id = r.id;
  return jsonb_build_object('status', 'approved', 'device_id', v_id, 'access_token', v_access, 'refresh_token', v_refresh, 'expires_in', 900);
end $$;

drop function public.ac_evasion_ban(uuid, uuid);
drop function public.ac_machine_resolve(jsonb);
drop function public.ac_machine_banned(uuid, uuid);
drop function public.ac_hw_weight(text);
drop function public.ac_hw_list(jsonb);

update public.bans set source = 'web' where source = 'evasion';
alter table public.bans drop column evades;
alter table public.bans drop constraint bans_source_check;
alter table public.bans add constraint bans_source_check check (source in ('web', 'server', 'import'));

alter table public.ac_link_requests drop column machine_id;
alter table public.ac_devices drop column machine_id;
drop table public.ac_blocked_attempts;
drop table public.ac_machine_exceptions;
drop table public.ac_machine_bans;
drop table public.ac_machine_ids;
drop table public.ac_machines;

notify pgrst, 'reload schema';

commit;