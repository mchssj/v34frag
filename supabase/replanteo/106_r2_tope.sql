-- 106: los buckets de R2 no pasan de 10 GB (bitácora docs/bitacora/2026-11-10-r2-tope-10gb/, Daniel 2026-11-10).
--
-- Dos veces por día, cada Worker lista su bucket y, si pasa de 10 GB, borra lo más viejo hasta quedar en 9,5 GB.
--   1. demo_evict (Worker de demos, token de demo_workers): antes de borrar las demos, sus partidas pasan a
--      'expired', como con demo_expire.
--   2. clip_r2_evict_due (Worker de clips, token de render_workers): los clips que se pueden sacar de R2 porque ya
--      están en Drive. Primero los que no se ven como destacados y, en cada grupo, el más viejo primero.
--   3. clip_r2_evicted: los marca como borrados de R2 (lo mismo que clip_archive_mark, de a muchos).
-- Inversa en docs/bitacora/2026-10-14-replanteo-modelo-datos/reversas/106_r2_tope.sql.

begin;

do $$
begin
  if to_regprocedure('public.demo_evict(text,text[])') is not null then
    raise exception 'replanteo 106: ya está aplicado';
  end if;
  if to_regprocedure('public.demo_auth(text)') is null or to_regprocedure('public.render_auth(text)') is null then
    raise exception 'replanteo 106: faltan demo_auth o render_auth';
  end if;
  if to_regclass('public.featured_clips_shown') is null then
    raise exception 'replanteo 106: falta featured_clips_shown (replanteo 76)';
  end if;
end $$;

-- ---------- 1. Demos ----------
create function public.demo_evict(p_token text, p_keys text[])
  returns integer language plpgsql security definer set search_path = public as $$
declare n integer;
begin
  perform demo_auth(p_token);
  if p_keys is null or cardinality(p_keys) = 0 then return 0; end if;
  if cardinality(p_keys) > 1000 then
    raise exception 'Hasta 1000 claves por llamada' using errcode = 'PT422';
  end if;
  update matches set demo_status = 'expired'
   where demo_status = 'uploaded' and demo_key = any(p_keys);
  get diagnostics n = row_count;
  return n;
end $$;

-- ---------- 2. Clips ----------
create function public.clip_r2_evict_due(p_token text, p_limit integer default 500)
  returns table(clip_id uuid, video_key text)
  language plpgsql security definer set search_path = public as $$
begin
  perform render_auth(p_token);
  return query
    select c.id, c.video_key from match_clips c
     where c.video_status = 'done' and c.video_r2_deleted_at is null and c.video_drive_id is not null
       and c.video_key is not null
     order by exists (select 1 from featured_clips_shown s where s.clip_id = c.id), c.video_rendered_at, c.id
     limit least(greatest(coalesce(p_limit, 500), 1), 1000);
end $$;

create function public.clip_r2_evicted(p_token text, p_clips uuid[])
  returns integer language plpgsql security definer set search_path = public as $$
declare n integer;
begin
  perform render_auth(p_token);
  if p_clips is null or cardinality(p_clips) = 0 then return 0; end if;
  if cardinality(p_clips) > 1000 then
    raise exception 'Hasta 1000 clips por llamada' using errcode = 'PT422';
  end if;
  update match_clips set video_r2_deleted_at = now()
   where id = any(p_clips) and video_status = 'done' and video_r2_deleted_at is null and video_drive_id is not null;
  get diagnostics n = row_count;
  return n;
end $$;

-- ---------- 3. Permisos ----------
-- Como las demás funciones de los Workers: entran con la clave pública y su token.
revoke all on function public.demo_evict(text, text[])            from public;
revoke all on function public.clip_r2_evict_due(text, integer)    from public;
revoke all on function public.clip_r2_evicted(text, uuid[])       from public;
grant execute on function public.demo_evict(text, text[])         to anon, authenticated, service_role;
grant execute on function public.clip_r2_evict_due(text, integer) to anon, authenticated, service_role;
grant execute on function public.clip_r2_evicted(text, uuid[])    to anon, authenticated, service_role;

commit;
