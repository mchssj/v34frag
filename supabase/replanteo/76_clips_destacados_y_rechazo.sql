-- Replanteo 76: clips destacados en el perfil y rechazar un clip (plan docs/bitacora/2026-11-04-clips-destacados-perfil,
-- pedido por Daniel el 2026-11-04, aprobado con el diseño el 2026-11-05).
--   1. clip_config: featured_max (3) y featured_max_vip (10). clip_set_featured los cambia (solo admins).
--   2. player_clip_prefs (modo auto o manual) y player_featured_clips (los elegidos, en orden). Sin acceso directo.
--   3. featured_clips_shown: los destacados que se ven de cada jugador, en los dos modos y con el tope de hoy.
--      Automático: los mejores con video según la escala de clip_config y, a igual tipo, el más nuevo.
--   4. clip_my_featured / clip_featured_set (Mi Perfil) y player_featured_clips_list (la ficha pública).
--   5. clip_archive_due no archiva un clip mientras se vea como destacado.
--   6. Rechazar: match_clips.video_review admite 'rejected', con quién, cuándo y el motivo. match_clip_ranked es la vista de
--      siempre (el ranking cuenta al rechazado, así no entra otro en su lugar) y match_clip_list la misma sin los rechazados:
--      deja de verse en la web, no sale en Discord y no se graba. clip_reject manda el video a la papelera; clip_unreject lo
--      vuelve a grabar y lo deja para revisar (solo con la demo guardada). tg_notify_match_clips no avisa nada al rechazar.
--   7. manual_valores: los dos topes de destacados, para el manual.
begin;

do $$
begin
  if to_regclass('public.match_clip_list') is null then
    raise exception 'replanteo 76: falta match_clip_list (clips)';
  end if;
  if to_regclass('public.match_clip_ranked') is not null then
    raise exception 'replanteo 76: match_clip_ranked ya existe (¿ya se aplicó?)';
  end if;
end $$;

-- ---------- 1. Configuración ----------

alter table public.clip_config
  add column featured_max smallint not null default 3 check (featured_max between 1 and 50),
  add column featured_max_vip smallint not null default 10 check (featured_max_vip between 1 and 50);
comment on column public.clip_config.featured_max is 'Clips destacados que muestra la ficha de un jugador. Replanteo 76';
comment on column public.clip_config.featured_max_vip is 'Clips destacados que muestra la ficha de un VIP. Replanteo 76';

create function public.clip_set_featured(p_max integer, p_max_vip integer) returns void
  language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is not null and not is_admin() then
    raise exception 'Solo un admin puede cambiar la configuración de los clips' using errcode = '42501';
  end if;
  if p_max is null or p_max not between 1 and 50 or p_max_vip is null or p_max_vip not between 1 and 50 then
    raise exception 'Los destacados tienen que estar entre 1 y 50' using errcode = '22023';
  end if;
  update clip_config set featured_max = p_max, featured_max_vip = p_max_vip, updated_at = now(), updated_by = auth.uid() where id = 1;
end $$;

-- ---------- 6a. Rechazados: columnas y vistas (antes que lo demás, que usa match_clip_list) ----------

alter table public.match_clips drop constraint match_clips_video_review_check;
alter table public.match_clips add constraint match_clips_video_review_check
  check (video_review is null or video_review in ('pending', 'approved', 'rejected'));
alter table public.match_clips
  add column video_rejected_at timestamptz,
  add column video_rejected_by uuid references auth.users (id) on delete set null,
  add column video_reject_reason text check (char_length(video_reject_reason) <= 300);
comment on column public.match_clips.video_rejected_at is 'Un admin lo rechazó: no se ve, no sale en Discord y no se graba. Replanteo 76';

-- La vista de siempre, con otro nombre: el ranking de cada partida cuenta a los rechazados.
do $$ begin
  execute 'create view public.match_clip_ranked as ' || pg_get_viewdef('public.match_clip_list'::regclass, true);
end $$;
comment on view public.match_clip_ranked is 'Las jugadas de cada mix con su puesto, también las rechazadas (Administración). Replanteo 76';
revoke all on public.match_clip_ranked from public, anon, authenticated;
grant select on public.match_clip_ranked to authenticated, service_role;

create or replace view public.match_clip_list as
  select * from public.match_clip_ranked r where r.review is distinct from 'rejected';
comment on view public.match_clip_list is 'Las jugadas que se muestran: match_clip_ranked sin las rechazadas (replanteo 76)';

-- ---------- 2. Preferencias y elegidos ----------

create table public.player_clip_prefs (
  user_id uuid primary key references auth.users (id) on delete cascade,
  featured_mode text not null default 'auto' check (featured_mode in ('auto', 'manual')),
  updated_at timestamptz not null default now()
);
comment on table public.player_clip_prefs is 'Cómo elige cada cuenta sus clips destacados (auto: los mejores; manual: los que marcó). Replanteo 76';

create table public.player_featured_clips (
  user_id uuid not null references auth.users (id) on delete cascade,
  clip_id uuid not null references public.match_clips (id) on delete cascade,
  position smallint not null check (position between 1 and 50),
  created_at timestamptz not null default now(),
  primary key (user_id, clip_id)
);
comment on table public.player_featured_clips is 'Los clips que una cuenta eligió destacar, en orden (modo manual). Replanteo 76';
alter table public.player_clip_prefs enable row level security;
alter table public.player_featured_clips enable row level security;
revoke all on public.player_clip_prefs, public.player_featured_clips from public, anon, authenticated;

-- ---------- 3. Los destacados que se ven ----------

create view public.featured_clips_shown as
  with base as (
    select l.player_id, l.id, l.priority, l.created_at
      from match_clip_list l
     where l.player_id is not null and l.video_status = 'done' and l.review is distinct from 'pending'
  ), owners as (
    select p.id as player_id, p.user_id, coalesce(pr.featured_mode, 'auto') as mode,
           case when p.user_id is not null and is_vip(p.user_id) then c.featured_max_vip else c.featured_max end as max
      from players p
      left join player_clip_prefs pr on pr.user_id = p.user_id
      cross join clip_config c
     where c.id = 1 and exists (select 1 from base b where b.player_id = p.id)
  ), elegidos as (
    select o.player_id, f.clip_id, row_number() over (partition by o.player_id order by f.position) as pos
      from owners o
      join player_featured_clips f on f.user_id = o.user_id
      join base b on b.id = f.clip_id and b.player_id = o.player_id
     where o.mode = 'manual'
  ), solos as (
    select b.player_id, b.id as clip_id, row_number() over (partition by b.player_id order by b.priority, b.created_at desc, b.id) as pos
      from base b join owners o on o.player_id = b.player_id
     where o.mode = 'auto'
  )
  select x.player_id, x.clip_id, x.pos::integer as position
    from (select * from elegidos union all select * from solos) x
    join owners o on o.player_id = x.player_id
   where x.pos <= o.max;
comment on view public.featured_clips_shown is 'Los clips destacados que muestra la ficha de cada jugador, en orden (los dos modos, con el tope de hoy). Replanteo 76';
revoke all on public.featured_clips_shown from public, anon, authenticated;

-- ---------- 4. Mi Perfil y la ficha ----------

/** Mi Perfil › Clips: el modo, el tope, si soy VIP, los elegidos (modo manual) y los que se ven hoy. */
create function public.clip_my_featured() returns jsonb
  language plpgsql stable security definer set search_path = public as $$
declare
  me uuid := auth.uid();
  v_player uuid;
  v_vip boolean;
begin
  if me is null then raise exception 'Tenés que iniciar sesión' using errcode = '42501'; end if;
  select id into v_player from players where user_id = me;
  v_vip := is_vip(me);
  return jsonb_build_object(
    'player_id', v_player,
    'mode', coalesce((select featured_mode from player_clip_prefs where user_id = me), 'auto'),
    'vip', v_vip,
    'max', (select case when v_vip then featured_max_vip else featured_max end from clip_config where id = 1),
    'max_vip', (select featured_max_vip from clip_config where id = 1),
    'picked', coalesce((select jsonb_agg(f.clip_id order by f.position) from player_featured_clips f where f.user_id = me), '[]'),
    'shown', coalesce((select jsonb_agg(s.clip_id order by s.position) from featured_clips_shown s where s.player_id = v_player), '[]'));
end $$;

/** Guarda el modo y, en manual, los elegidos en orden. Tienen que ser míos, con video y no esperar revisión. */
create function public.clip_featured_set(p_mode text, p_clips uuid[]) returns jsonb
  language plpgsql security definer set search_path = public as $$
declare
  me uuid := auth.uid();
  v_player uuid;
  v_max int;
  v_ids uuid[] := coalesce(p_clips, '{}');
begin
  if me is null then raise exception 'Tenés que iniciar sesión' using errcode = '42501'; end if;
  if p_mode is null or p_mode not in ('auto', 'manual') then raise exception 'Modo inválido' using errcode = '22023'; end if;
  select id into v_player from players where user_id = me;
  if v_player is null then raise exception 'Tu cuenta todavía no tiene una ficha de jugador'; end if;
  if cardinality(v_ids) <> (select count(distinct x) from unnest(v_ids) x) then
    raise exception 'Hay un clip repetido' using errcode = '22023';
  end if;
  select case when is_vip(me) then featured_max_vip else featured_max end into v_max from clip_config where id = 1;
  if cardinality(v_ids) > v_max then
    raise exception 'Puedes destacar hasta % clips', v_max using errcode = 'V3901',
      detail = jsonb_build_object('max', v_max)::text;
  end if;
  if exists (select 1 from unnest(v_ids) x where not exists (
               select 1 from match_clip_list l where l.id = x and l.player_id = v_player
                  and l.video_status = 'done' and l.review is distinct from 'pending')) then
    raise exception 'Solo puedes destacar tus clips que ya tienen video';
  end if;
  insert into player_clip_prefs (user_id, featured_mode) values (me, p_mode)
    on conflict (user_id) do update set featured_mode = excluded.featured_mode, updated_at = now();
  delete from player_featured_clips where user_id = me;
  insert into player_featured_clips (user_id, clip_id, position)
    select me, x, o from unnest(v_ids) with ordinality u(x, o);
  return clip_my_featured();
end $$;

/** Los destacados que se ven de un jugador, en orden (la ficha pública). */
create function public.player_featured_clips_list(p_player uuid) returns setof uuid
  language sql stable security definer set search_path = public as $$
  select clip_id from featured_clips_shown where player_id = p_player order by position
$$;

-- ---------- 5. El archivo de la noche no se lleva un destacado ----------

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
       -- (replanteo 76) mientras se vea como destacado en una ficha, queda en R2
       and not exists (select 1 from featured_clips_shown s where s.clip_id = c.id)
     order by c.video_rendered_at
     limit least(greatest(coalesce(p_limit, 100), 1), 500);
end $$;

-- ---------- 6b. Rechazar y recuperar ----------

/** Rechaza un clip: deja de verse y de grabarse, y su video va a la papelera. */
create function public.clip_reject(p_clip uuid, p_reason text default null) returns text
  language plpgsql security definer set search_path = public as $$
declare c match_clips; v_key text;
begin
  if auth.uid() is not null and not is_admin() then
    raise exception 'Solo un admin puede rechazar un clip' using errcode = '42501';
  end if;
  select * into c from match_clips where id = p_clip for update;
  if c.id is null then raise exception 'Esa jugada no existe' using errcode = 'P0002'; end if;
  if c.video_review = 'rejected' then raise exception 'Esa jugada ya está rechazada'; end if;
  if c.video_status = 'processing' then raise exception 'Esa jugada se está grabando ahora: espera a que termine'; end if;
  v_key := case when c.video_r2_deleted_at is null then c.video_key end;
  if v_key is not null or c.video_drive_id is not null then
    insert into clip_video_trash(video_key, video_drive_id) values (v_key, c.video_drive_id);
  end if;
  update match_clips
     set video_status = null, video_key = null, video_bytes = null, video_seconds = null, video_drive_id = null,
         video_attempts = 0, video_error = null, video_claimed_at = null, video_rendered_at = null, video_r2_deleted_at = null,
         video_review = 'rejected', video_reviewed_at = null, video_reviewed_by = null,
         video_rejected_at = now(), video_rejected_by = auth.uid(), video_reject_reason = nullif(btrim(p_reason), '')
   where id = p_clip;
  delete from player_featured_clips where clip_id = p_clip;
  return 'rejected';
end $$;

/** Recupera un rechazado: se vuelve a grabar y queda para revisar. Solo con la demo guardada. */
create function public.clip_unreject(p_clip uuid) returns text
  language plpgsql security definer set search_path = public as $$
declare c match_clips; v_demo text;
begin
  if auth.uid() is not null and not is_admin() then
    raise exception 'Solo un admin puede recuperar un clip' using errcode = '42501';
  end if;
  select * into c from match_clips where id = p_clip for update;
  if c.id is null then raise exception 'Esa jugada no existe' using errcode = 'P0002'; end if;
  if c.video_review is distinct from 'rejected' then raise exception 'Esa jugada no está rechazada'; end if;
  select demo_status into v_demo from matches where id = c.match_id;
  if v_demo is distinct from 'uploaded' then
    raise exception 'La demo de ese mix ya no está: no se puede volver a grabar';
  end if;
  update match_clips
     set video_review = 'pending', video_reprocessed_at = now(), video_reprocess_count = video_reprocess_count + 1,
         video_rejected_at = null, video_rejected_by = null, video_reject_reason = null, discord_posted_at = null
   where id = p_clip;
  return 'pending';
end $$;

-- ---------- 7. El manual muestra los topes ----------

do $$
declare d text := pg_get_functiondef('public.manual_valores()'::regprocedure);
begin
  if position('''clips.por_jugador'', c.per_player,' in d) = 0 then
    raise exception 'replanteo 76: manual_valores no tiene clips.por_jugador';
  end if;
  execute replace(d, '''clips.por_jugador'', c.per_player,',
    '''clips.por_jugador'', c.per_player, ''clips.destacados'', c.featured_max, ''clips.destacados_vip'', c.featured_max_vip,');
end $$;

-- ---------- Permisos ----------

revoke all on function public.clip_set_featured(integer, integer), public.clip_my_featured(), public.clip_featured_set(text, uuid[]),
  public.player_featured_clips_list(uuid), public.clip_reject(uuid, text), public.clip_unreject(uuid) from public, anon, authenticated;
grant execute on function public.clip_set_featured(integer, integer), public.clip_my_featured(), public.clip_featured_set(text, uuid[]),
  public.clip_reject(uuid, text), public.clip_unreject(uuid) to authenticated;
grant execute on function public.player_featured_clips_list(uuid) to anon, authenticated;

comment on function public.clip_my_featured() is 'Mi Perfil › Clips: modo, tope, elegidos y los que se ven. Replanteo 76';
comment on function public.clip_featured_set(text, uuid[]) is 'Guardar el modo y los clips destacados elegidos, en orden. Replanteo 76';
comment on function public.player_featured_clips_list(uuid) is 'Los clips destacados que se ven en la ficha de un jugador, en orden. Replanteo 76';
comment on function public.clip_reject(uuid, text) is 'Rechazar un clip: no se ve, no sale en Discord, no se graba; el video a la papelera. Replanteo 76';
comment on function public.clip_unreject(uuid) is 'Recuperar un clip rechazado: se vuelve a grabar y queda para revisar. Replanteo 76';

notify pgrst, 'reload schema';
commit;
