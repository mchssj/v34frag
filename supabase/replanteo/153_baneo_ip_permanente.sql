-- Replanteo 153: banear una IP o rango de forma permanente desde la web (plan docs/bitacora/2026-11-26-baneo-ip-permanente).
--   1. admin_ban_ip_add (de una ficha) suma p_full: hasta que venza el baneo (permanente si el baneo lo es). Sin p_full,
--      como antes: como mucho 30 días.
--   2. admin_ban_ip_add_loose (sin ficha): 0 minutos = permanente.
--   3. admin_ban_ips: expires_at null = permanente (antes 'infinity').
begin;

do $$
begin
  if to_regprocedure('public.admin_ban_ip_add_loose(text,text,integer,uuid[],uuid[])') is null then raise exception 'replanteo 153: falta el 152'; end if;
  if to_regprocedure('public.admin_ban_ip_add(uuid,text,uuid[],uuid[],boolean)') is not null then raise exception 'replanteo 153: ya se aplicó'; end if;
  if current_user not in ('postgres', 'supabase_admin') then raise exception 'replanteo 153: correr como postgres o supabase_admin'; end if;
end $$;
do $$ begin if current_user = 'supabase_admin' then execute 'set local role postgres'; end if; end $$;

-- 1. De una ficha. Se reemplaza (no se suma otra versión): PostgREST no elige entre dos con los mismos nombres.
drop function public.admin_ban_ip_add(uuid, text, uuid[], uuid[]);
create function public.admin_ban_ip_add(p_ban uuid, p_ip text, p_except_players uuid[] default '{}', p_except_users uuid[] default '{}',
                                        p_full boolean default false)
  returns uuid
  language plpgsql security definer set search_path = public as $$
declare b bans; v inet; v_exp timestamptz; v_id uuid;
begin
  if not is_admin() then raise exception 'Solo un admin puede banear IPs' using errcode = '42501'; end if;
  select * into b from bans where id = p_ban for update;
  if b.id is null then raise exception 'Ese baneo no existe' using errcode = 'P0002'; end if;
  if b.lifted_at is not null or (b.expires_at is not null and b.expires_at <= now()) then
    raise exception 'Ese baneo ya no está activo' using errcode = 'P0001';
  end if;
  v := ban_ip_parse(p_ip);
  v_exp := coalesce(b.expires_at, 'infinity'::timestamptz);
  if not coalesce(p_full, false) then v_exp := least(v_exp, now() + interval '30 days'); end if;
  insert into ban_ips (ban_id, ip, expires_at, created_by) values (p_ban, v, v_exp, auth.uid())
  on conflict (ban_id, ip) do update set lifted_at = null, lifted_by = null, expires_at = v_exp
  returning id into v_id;
  insert into ban_ip_exceptions (ban_ip_id, player_id, created_by)
  select v_id, x, auth.uid() from unnest(coalesce(p_except_players, '{}')) x
   where x is distinct from b.player_id   -- la ficha baneada no se exceptúa
  on conflict do nothing;
  insert into ban_ip_exceptions (ban_ip_id, user_id, created_by)
  select v_id, x, auth.uid() from unnest(coalesce(p_except_users, '{}')) x
  on conflict do nothing;
  return v_id;
end $$;

-- 2. Sin ficha: 0 minutos = permanente.
create or replace function public.admin_ban_ip_add_loose(p_ip text, p_reason text, p_minutes integer,
                                                         p_except_players uuid[] default '{}', p_except_users uuid[] default '{}')
  returns uuid
  language plpgsql security definer set search_path = public as $$
declare v inet; v_id uuid; v_reason text := left(nullif(btrim(coalesce(p_reason, '')), ''), 200);
begin
  if not is_admin() then raise exception 'Solo un admin puede banear IPs' using errcode = '42501'; end if;
  if v_reason is null then raise exception 'Falta el motivo' using errcode = 'P0001'; end if;
  if p_minutes is null or p_minutes < 0 or p_minutes > 43200 then
    raise exception 'La duración va de 1 minuto a 30 días, o 0 para permanente' using errcode = 'P0001';
  end if;
  v := ban_ip_parse(p_ip);
  insert into ban_ips (ban_id, ip, expires_at, created_by, reason, source)
  values (null, v, case when p_minutes = 0 then 'infinity'::timestamptz else now() + p_minutes * interval '1 minute' end,
          auth.uid(), v_reason, 'web')
  returning id into v_id;
  insert into ban_ip_exceptions (ban_ip_id, player_id, created_by)
  select v_id, x, auth.uid() from unnest(coalesce(p_except_players, '{}')) x on conflict do nothing;
  insert into ban_ip_exceptions (ban_ip_id, user_id, created_by)
  select v_id, x, auth.uid() from unnest(coalesce(p_except_users, '{}')) x on conflict do nothing;
  return v_id;
end $$;

-- 3. Las IPs de un baneo, con null para permanente.
create or replace function public.admin_ban_ips(p_ban uuid)
  returns table (id uuid, ip text, expires_at timestamptz, created_at timestamptz, created_by_alias text, active boolean, exceptions jsonb)
  language plpgsql stable security definer set search_path = public as $$
begin
  if not is_admin() then raise exception 'Solo un admin puede ver las IPs' using errcode = '42501'; end if;
  return query
    select i.id, ip_text(i.ip), case when i.expires_at = 'infinity' then null else i.expires_at end, i.created_at, p.tag,
           i.lifted_at is null and i.expires_at > now() and b.lifted_at is null and (b.expires_at is null or b.expires_at > now()),
           coalesce((select jsonb_agg(jsonb_build_object('id', e.id, 'player_id', e.player_id, 'user_id', e.user_id,
                                                         'alias', coalesce(pu.tag, pr.tag, pl.nick)) order by e.created_at)
                       from ban_ip_exceptions e
                       left join players pl on pl.id = e.player_id
                       left join profiles pr on pr.id = pl.user_id
                       left join profiles pu on pu.id = e.user_id
                      where e.ban_ip_id = i.id), '[]'::jsonb)
      from ban_ips i join bans b on b.id = i.ban_id left join profiles p on p.id = i.created_by
     where i.ban_id = p_ban and i.lifted_at is null
     order by i.created_at;
end $$;

revoke all on function public.admin_ban_ip_add(uuid, text, uuid[], uuid[], boolean) from public, anon, authenticated;
grant execute on function public.admin_ban_ip_add(uuid, text, uuid[], uuid[], boolean) to authenticated, service_role;

notify pgrst, 'reload schema';
commit;
