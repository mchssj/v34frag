-- Replanteo 150: excepciones en los baneos por IP (Daniel, 2026-11-26; plan docs/bitacora/2026-11-26-baneo-por-ip).
-- Un rango (181.21.*.*) alcanza a todos los que usan ese proveedor, no solo al cheater. Cada IP o rango baneado puede
-- tener excepciones por ficha o por cuenta: esa persona sigue buscando partida desde ahí.
--   1. ban_ip_exceptions (ban_ip_id + ficha o cuenta).
--   2. ip_banned_for(ip, usuario): como ip_banned, sin los rangos que exceptúan a ese usuario (por su cuenta o su ficha).
--      request_ip_banned() pasa a usarla con auth.uid() (sin sesión, como el registro, no hay excepción posible).
--   3. admin_ban_ip_add (una IP o rango, con sus excepciones, de una vez), admin_ban_ip_exception_add y _remove.
--      admin_ban_ips devuelve las excepciones y admin_ip_range_accounts la cuenta y si la ficha está baneada.
begin;

do $$
begin
  if to_regclass('public.ban_ips') is null then raise exception 'replanteo 150: falta el 149 (ban_ips)'; end if;
  if to_regclass('public.ban_ip_exceptions') is not null then raise exception 'replanteo 150: ya se aplicó'; end if;
  if current_user not in ('postgres', 'supabase_admin') then raise exception 'replanteo 150: correr como postgres o supabase_admin'; end if;
end $$;
do $$ begin if current_user = 'supabase_admin' then execute 'set local role postgres'; end if; end $$;

create table public.ban_ip_exceptions (
  id         uuid primary key default gen_random_uuid(),
  ban_ip_id  uuid not null references public.ban_ips (id) on delete cascade,
  player_id  uuid references public.players (id) on delete cascade,
  user_id    uuid references auth.users (id) on delete cascade,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  check ((player_id is null) <> (user_id is null)),
  unique nulls not distinct (ban_ip_id, player_id, user_id)
);
comment on table public.ban_ip_exceptions is
  'Excepciones de una IP o rango baneado (replanteo 150): esa ficha o cuenta sigue buscando partida desde ahí. Solo admin';
alter table public.ban_ip_exceptions enable row level security;
create policy ban_ip_exceptions_admin_read on public.ban_ip_exceptions for select to authenticated using (is_admin());

-- Banear: la IP está en un rango activo que no exceptúa a ese usuario (por su cuenta o por su ficha).
create function public.ip_banned_for(p_ip inet, p_user uuid) returns boolean
  language sql stable security definer set search_path = public as $$
  select p_ip is not null and exists (
    select 1 from ban_ips i join bans b on b.id = i.ban_id
     where p_ip <<= i.ip and i.lifted_at is null and i.expires_at > now()
       and b.lifted_at is null and (b.expires_at is null or b.expires_at > now())
       and not exists (
         select 1 from ban_ip_exceptions e
          where e.ban_ip_id = i.id and p_user is not null
            and (e.user_id = p_user or e.player_id in (select pl.id from players pl where pl.user_id = p_user))))
$$;

create or replace function public.request_ip_banned() returns boolean
  language sql stable security definer set search_path = public as $$
  select ip_banned_for(request_ip(), auth.uid())
$$;

-- Una IP o rango, con las fichas y cuentas exceptuadas, en un solo paso. Devuelve el id de la IP baneada.
create function public.admin_ban_ip_add(p_ban uuid, p_ip text, p_except_players uuid[] default '{}', p_except_users uuid[] default '{}')
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
  v_exp := least(coalesce(b.expires_at, 'infinity'::timestamptz), now() + interval '30 days');
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

create function public.admin_ban_ip_exception_add(p_ban_ip uuid, p_player uuid default null, p_user uuid default null)
  returns uuid
  language plpgsql security definer set search_path = public as $$
declare v_id uuid;
begin
  if not is_admin() then raise exception 'Solo un admin puede cambiar las excepciones' using errcode = '42501'; end if;
  if (p_player is null) = (p_user is null) then raise exception 'Elegí una ficha o una cuenta' using errcode = 'P0001'; end if;
  if not exists (select 1 from ban_ips where id = p_ban_ip) then raise exception 'Esa IP no está baneada' using errcode = 'P0002'; end if;
  insert into ban_ip_exceptions (ban_ip_id, player_id, user_id, created_by) values (p_ban_ip, p_player, p_user, auth.uid())
  on conflict do nothing returning id into v_id;
  if v_id is null then
    select id into v_id from ban_ip_exceptions
     where ban_ip_id = p_ban_ip and player_id is not distinct from p_player and user_id is not distinct from p_user;
  end if;
  return v_id;
end $$;

create function public.admin_ban_ip_exception_remove(p_id uuid) returns void
  language plpgsql security definer set search_path = public as $$
begin
  if not is_admin() then raise exception 'Solo un admin puede cambiar las excepciones' using errcode = '42501'; end if;
  delete from ban_ip_exceptions where id = p_id;
  if not found then raise exception 'Esa excepción no existe' using errcode = 'P0002'; end if;
end $$;

-- Las IPs de un baneo, ahora con sus excepciones.
drop function public.admin_ban_ips(uuid);
create function public.admin_ban_ips(p_ban uuid)
  returns table (id uuid, ip text, expires_at timestamptz, created_at timestamptz, created_by_alias text, active boolean, exceptions jsonb)
  language plpgsql stable security definer set search_path = public as $$
begin
  if not is_admin() then raise exception 'Solo un admin puede ver las IPs' using errcode = '42501'; end if;
  return query
    select i.id, ip_text(i.ip), i.expires_at, i.created_at, p.tag,
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

-- A quién afecta un rango, ahora con la cuenta y si la ficha ya está baneada (para proponer excepciones).
drop function public.admin_ip_range_accounts(text);
create function public.admin_ip_range_accounts(p_range text)
  returns table (player_id uuid, user_id uuid, alias text, sources text[], ips integer, last_seen_at timestamptz, banned boolean)
  language plpgsql stable security definer set search_path = public as $$
declare r inet;
begin
  if not is_admin() then raise exception 'Solo un admin puede ver las IPs' using errcode = '42501'; end if;
  r := ban_ip_parse(p_range);
  return query
    with hits as (
      select s.player_id as pid, pl.user_id as uid, coalesce(pr.tag, pl.nick) as alias, 'servidor'::text as src, i.ip, i.last_seen_at as l
        from player_ips i
        join player_steam_all s on s.steam_id = i.steam_id
        join players pl on pl.id = s.player_id
        left join profiles pr on pr.id = pl.user_id
       where i.ip <<= r
      union all
      select pl.id, a.user_id, pr.tag, 'web', a.ip, a.last_seen_at
        from account_ips a
        join profiles pr on pr.id = a.user_id
        left join players pl on pl.user_id = a.user_id
       where a.ip <<= r
    )
    select h.pid, max(h.uid::text)::uuid, h.alias, array_agg(distinct h.src order by h.src), count(distinct h.ip)::int, max(h.l),
           h.pid is not null and exists (select 1 from bans b where b.player_id = h.pid and b.lifted_at is null
                                           and (b.expires_at is null or b.expires_at > now()))
      from hits h group by h.pid, h.alias
     order by max(h.l) desc;
end $$;

revoke all on table public.ban_ip_exceptions from public, anon, authenticated, service_role;
grant select on table public.ban_ip_exceptions to authenticated;
grant all on table public.ban_ip_exceptions to service_role;
revoke all on function public.ip_banned_for(inet, uuid) from public, anon, authenticated;
revoke all on function public.request_ip_banned() from public, anon, authenticated;
revoke all on function public.admin_ban_ip_add(uuid, text, uuid[], uuid[]) from public, anon, authenticated;
revoke all on function public.admin_ban_ip_exception_add(uuid, uuid, uuid) from public, anon, authenticated;
revoke all on function public.admin_ban_ip_exception_remove(uuid) from public, anon, authenticated;
revoke all on function public.admin_ban_ips(uuid) from public, anon, authenticated;
revoke all on function public.admin_ip_range_accounts(text) from public, anon, authenticated;
grant execute on function public.ip_banned_for(inet, uuid) to service_role;
grant execute on function public.request_ip_banned() to anon, authenticated, service_role;
grant execute on function public.admin_ban_ip_add(uuid, text, uuid[], uuid[]) to authenticated, service_role;
grant execute on function public.admin_ban_ip_exception_add(uuid, uuid, uuid) to authenticated, service_role;
grant execute on function public.admin_ban_ip_exception_remove(uuid) to authenticated, service_role;
grant execute on function public.admin_ban_ips(uuid) to authenticated, service_role;
grant execute on function public.admin_ip_range_accounts(text) to authenticated, service_role;

notify pgrst, 'reload schema';
commit;
