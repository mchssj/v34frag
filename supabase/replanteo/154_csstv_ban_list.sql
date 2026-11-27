-- Replanteo 154: la lista de baneos activos para !banlist en los servidores (reporter 2.12.1).
-- Texto compacto, como csstv_bans_compact (151): registros separados por ';' y campos por '|', sin comillas ni
-- barras (se cambian por espacios), así el plugin no tiene que leer JSON. Los más nuevos primero, como mucho 200.
--   s|STEAM_0:x:y|vence (unix; 0 = permanente)|nombre|motivo|origen (web o server)
--   i|181.21.0.0/16|vence|nombre de la ficha (o vacío)|motivo|cantidad de excepciones
begin;

do $$
begin
  if to_regprocedure('public.csstv_bans_compact(text)') is null then raise exception 'replanteo 154: falta el 151'; end if;
  if to_regprocedure('public.csstv_ban_list(text)') is not null then raise exception 'replanteo 154: ya se aplicó'; end if;
  if current_user not in ('postgres', 'supabase_admin') then raise exception 'replanteo 154: correr como postgres o supabase_admin'; end if;
end $$;
do $$ begin if current_user = 'supabase_admin' then execute 'set local role postgres'; end if; end $$;

create function public.csstv_ban_list_clean(p text, p_len int) returns text
  language sql immutable set search_path = public as $$
  select left(btrim(regexp_replace(translate(coalesce(p, ''), '|;"' || chr(92), '    '), '[[:cntrl:][:space:]]+', ' ', 'g')), p_len)
$$;

create function public.csstv_ban_list(p_token text) returns text
  language plpgsql security definer set search_path = public as $$
declare v text;
begin
  perform csstv_auth(p_token);
  with s as (
    select b.created_at,
           's|' || coalesce(csstv_steam0((ban_steams(b.player_id, b.steam_id))[1]), '?')
           || '|' || coalesce(extract(epoch from b.expires_at)::bigint, 0)
           || '|' || csstv_ban_list_clean(coalesce(pr.tag, pl.nick, b.nick), 32)
           || '|' || csstv_ban_list_clean(b.reason, 80)
           || '|' || coalesce(b.source, '') as r
      from bans b
      left join players pl on pl.id = b.player_id
      left join profiles pr on pr.id = pl.user_id
     where b.lifted_at is null and (b.expires_at is null or b.expires_at > now())
    union all
    select i.created_at,
           'i|' || ip_text(i.ip)
           || '|' || case when i.expires_at = 'infinity' then 0 else extract(epoch from i.expires_at)::bigint end
           || '|' || csstv_ban_list_clean(coalesce(pr.tag, pl.nick, b.nick), 32)
           || '|' || csstv_ban_list_clean(coalesce(b.reason, i.reason), 80)
           || '|' || (select count(*) from ban_ip_exceptions e where e.ban_ip_id = i.id) as r
      from ban_ips i
      left join bans b on b.id = i.ban_id
      left join players pl on pl.id = b.player_id
      left join profiles pr on pr.id = pl.user_id
     where i.lifted_at is null and i.expires_at > now()
       and (i.ban_id is null or (b.lifted_at is null and (b.expires_at is null or b.expires_at > now())))
  )
  select coalesce(string_agg(r, ';' order by created_at desc), '') into v
    from (select * from s order by created_at desc limit 200) x;
  return v;
end $$;

revoke all on function public.csstv_ban_list_clean(text, int) from public, anon, authenticated;
revoke all on function public.csstv_ban_list(text) from public;
grant execute on function public.csstv_ban_list(text) to anon, authenticated, service_role;

notify pgrst, 'reload schema';
commit;
