-- Replanteo 152: banear una IP o rango desde la web sin ficha (plan docs/bitacora/2026-11-26-baneo-ip-sin-ficha).
-- Como el !banip del servidor (151), pero desde la web, solo admins y con el tope de 30 días (Daniel, 2026-11-26).
begin;

do $$
begin
  if not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'ban_ips' and column_name = 'server_id') then
    raise exception 'replanteo 152: falta el 151';
  end if;
  if to_regprocedure('public.admin_ban_ip_add_loose(text,text,integer,uuid[],uuid[])') is not null then raise exception 'replanteo 152: ya se aplicó'; end if;
  if current_user not in ('postgres', 'supabase_admin') then raise exception 'replanteo 152: correr como postgres o supabase_admin'; end if;
end $$;
do $$ begin if current_user = 'supabase_admin' then execute 'set local role postgres'; end if; end $$;

create function public.admin_ban_ip_add_loose(p_ip text, p_reason text, p_minutes integer,
                                              p_except_players uuid[] default '{}', p_except_users uuid[] default '{}')
  returns uuid
  language plpgsql security definer set search_path = public as $$
declare v inet; v_id uuid; v_reason text := left(nullif(btrim(coalesce(p_reason, '')), ''), 200);
begin
  if not is_admin() then raise exception 'Solo un admin puede banear IPs' using errcode = '42501'; end if;
  if v_reason is null then raise exception 'Falta el motivo' using errcode = 'P0001'; end if;
  if p_minutes is null or p_minutes < 1 or p_minutes > 43200 then
    raise exception 'La duración va de 1 minuto a 30 días' using errcode = 'P0001';
  end if;
  v := ban_ip_parse(p_ip);
  insert into ban_ips (ban_id, ip, expires_at, created_by, reason, source)
  values (null, v, now() + p_minutes * interval '1 minute', auth.uid(), v_reason, 'web')
  returning id into v_id;
  insert into ban_ip_exceptions (ban_ip_id, player_id, created_by)
  select v_id, x, auth.uid() from unnest(coalesce(p_except_players, '{}')) x on conflict do nothing;
  insert into ban_ip_exceptions (ban_ip_id, user_id, created_by)
  select v_id, x, auth.uid() from unnest(coalesce(p_except_users, '{}')) x on conflict do nothing;
  return v_id;
end $$;

revoke all on function public.admin_ban_ip_add_loose(text, text, integer, uuid[], uuid[]) from public, anon, authenticated;
grant execute on function public.admin_ban_ip_add_loose(text, text, integer, uuid[], uuid[]) to authenticated, service_role;

notify pgrst, 'reload schema';
commit;
