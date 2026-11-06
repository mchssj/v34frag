-- Inversa del replanteo 76: sin clips destacados ni rechazo. Borra las preferencias y los elegidos de cada cuenta, vuelve
-- match_clip_list a ser la vista de siempre y clip_archive_due a archivar todo. Los clips rechazados vuelven a mostrarse y,
-- sin video, a la cola del render (video_review queda en null).
begin;

do $$
declare d text := pg_get_functiondef('public.manual_valores()'::regprocedure);
begin
  execute replace(d, ' ''clips.destacados'', c.featured_max, ''clips.destacados_vip'', c.featured_max_vip,', '');
end $$;

drop function public.clip_set_featured(integer, integer), public.clip_my_featured(), public.clip_featured_set(text, uuid[]),
  public.player_featured_clips_list(uuid), public.clip_reject(uuid, text), public.clip_unreject(uuid);

create or replace function public.clip_archive_due(p_token text, p_days integer default 15, p_limit integer default 100)
  returns table(clip_id uuid, video_key text)
  language plpgsql security definer set search_path = public as $$
begin
  perform render_auth(p_token);
  if p_days is null or p_days not between 1 and 3650 then
    raise exception 'Días inválidos' using errcode = 'PT422';
  end if;
  return query
    select c.id, c.video_key from match_clips c
     where c.video_status = 'done' and c.video_r2_deleted_at is null and c.video_drive_id is not null
       and c.video_rendered_at < now() - make_interval(days => p_days)
     order by c.video_rendered_at
     limit least(greatest(coalesce(p_limit, 100), 1), 500);
end $$;

drop view public.featured_clips_shown;
drop table public.player_featured_clips, public.player_clip_prefs;

do $$ begin
  execute 'create or replace view public.match_clip_list as ' || pg_get_viewdef('public.match_clip_ranked'::regclass, true);
end $$;
comment on view public.match_clip_list is null;
drop view public.match_clip_ranked;

update public.match_clips set video_review = null where video_review = 'rejected';
alter table public.match_clips
  drop column video_rejected_at, drop column video_rejected_by, drop column video_reject_reason;
alter table public.match_clips drop constraint match_clips_video_review_check;
alter table public.match_clips add constraint match_clips_video_review_check
  check (video_review is null or video_review in ('pending', 'approved'));

alter table public.clip_config drop column featured_max, drop column featured_max_vip;

notify pgrst, 'reload schema';
commit;
