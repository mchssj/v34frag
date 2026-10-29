-- Replanteo 35: notificaciones programadas, la segunda etapa de la 28 (plan docs/bitacora/2026-10-29-notificaciones-programadas).
--   1. Tipos nuevos: match_soon (tournament), pcw_soon y pcw_expired (pcw), season_ending (season), match_no_result (admin)
--      y vip_expiring (account).
--   2. notification_sent: qué aviso ya se mandó (kind, ref), para no repetirlo aunque notifications se recorte a 100.
--   3. notify_due(): una corrida de todos los avisos que dependen del paso del tiempo. La llama el timer del VPS cada
--      10 minutos con la clave de servicio (pnpm notify:tick). Cada aviso mira una ventana, así una corrida perdida no
--      deja avisos sin mandar mientras todavía sirvan.
-- Necesita la 24 (temporadas), la 28 (notificaciones), la 32 (VIP) y la 33 (notification_category).
-- NO aplicar en producción antes del corte (ver README.md).
begin;

do $$
begin
  if to_regprocedure('public.notify(uuid[], text, jsonb, text, boolean)') is null or to_regclass('public.seasons') is null
     or to_regclass('public.vip_memberships') is null or to_regprocedure('public.season_rank(timestamptz, timestamptz, integer)') is null
     or public.notification_category('event_lineup') is null then
    raise exception 'replanteo 35: faltan la 24, la 28, la 32 o la 33';
  end if;
  if to_regclass('public.notification_sent') is not null then
    raise exception 'replanteo 35: notification_sent ya existe (¿ya se aplicó?)';
  end if;
end $$;

-- =====================================================================================================
-- 1. Tipos nuevos
-- =====================================================================================================
create or replace function public.notification_category(p_type text) returns text language sql immutable as $$
  select case
    when p_type in ('team_invite', 'team_join_request', 'team_invite_answered', 'team_join_answered', 'team_captain', 'team_removed',
                    'team_member_left', 'team_role_changed', 'team_added', 'team_deleted', 'team_request_answered') then 'team'
    when p_type in ('event_registration', 'event_fixture', 'match_scheduled', 'veto_turn', 'veto_done', 'veto_reset',
                    'match_result', 'event_progress', 'event_cancelled', 'event_lineup', 'match_soon') then 'tournament' -- (replanteo 35) match_soon
    when p_type in ('pcw_accepted', 'pcw_cancelled', 'pcw_result', 'pcw_soon', 'pcw_expired') then 'pcw' -- (replanteo 35) pcw_soon y pcw_expired
    when p_type in ('level_changed', 'mix_review_resolved', 'mix_deleted', 'elo_adjusted', 'clip_ready') then 'elo'
    when p_type in ('season_ranked', 'season_closed', 'medal_granted', 'season_ending') then 'season' -- (replanteo 35) season_ending
    when p_type in ('steam_claimed', 'steam_request_answered', 'alias_changed', 'role_changed', 'password_changed',
                    'vip_granted', 'vip_revoked', 'vip_expiring') then 'account' -- (replanteo 35) vip_expiring
    when p_type in ('event_new', 'season_started') then 'news'
    when p_type in ('admin_steam_request', 'admin_team_request', 'admin_mix_review', 'admin_demo_failed', 'admin_season_delayed',
                    'match_no_result') then 'admin' -- (replanteo 35) match_no_result
  end $$;

-- =====================================================================================================
-- 2. Avisos ya mandados
-- =====================================================================================================
-- Un aviso por ref, para todas las cuentas a la vez. Si alguien tenía la categoría apagada y la prende después, ese
-- aviso ya no le llega (igual que en la 28: prender una categoría no trae las viejas).
create table public.notification_sent (
  kind    text not null,
  ref     text not null,
  sent_at timestamptz not null default now(),
  primary key (kind, ref)
);
comment on table public.notification_sent is 'Avisos programados ya mandados (notify_due). Se borran a los 60 días';
alter table public.notification_sent enable row level security;
revoke all on table public.notification_sent from anon, authenticated;

-- =====================================================================================================
-- 3. notify_due()
-- =====================================================================================================
-- Ventanas: partida o PCW en 1 hora, de 0 a 60 minutos antes; temporada, de 0 a 24 horas antes; VIP, de 0 a 3 días antes;
-- PCW vencida y partida sin resultado, hasta 7 días después (más tarde ya no sirve, y una base vieja no manda una avalancha).
create function public.notify_due() returns jsonb
  language plpgsql security definer set search_path = public as $$
declare
  v_now timestamptz := now();
  r record;
  p record;
  v_soon int := 0; v_pcw_soon int := 0; v_pcw_expired int := 0; v_season int := 0; v_no_result int := 0; v_vip int := 0;
begin
  -- Partida de torneo o PCW en menos de 1 hora. La ref lleva el horario: si se reprograma, se avisa de nuevo.
  for r in
    with c as (
      select m.id, m.kind, 'match_soon:' || m.id || ':' || extract(epoch from m.starts_at)::bigint as ref
        from matches m
       where m.kind in ('official', 'pcw') and m.status = 'upcoming' and m.parent_match_id is null and m.bye is not true
         and m.team1 is not null and m.team2 is not null
         and m.starts_at > v_now and m.starts_at <= v_now + interval '1 hour')
    insert into notification_sent(kind, ref)
    select case c.kind when 'pcw' then 'pcw_soon' else 'match_soon' end, c.ref from c
    on conflict do nothing
    returning kind, ref
  loop
    perform notify(match_users(split_part(r.ref, ':', 2)::uuid), r.kind, match_ref(split_part(r.ref, ':', 2)::uuid), r.ref);
    if r.kind = 'pcw_soon' then v_pcw_soon := v_pcw_soon + 1; else v_soon := v_soon + 1; end if;
  end loop;

  -- Anuncio de PCW que nadie aceptó y cuyo horario ya pasó: a quien lo publicó.
  for r in
    insert into notification_sent(kind, ref)
    select 'pcw_expired', 'pcw_expired:' || pp.id
      from pcw_posts pp
     where pp.status = 'open' and pp.starts_at <= v_now and pp.starts_at > v_now - interval '7 days'
    on conflict do nothing
    returning ref
  loop
    select pp.* into p from pcw_posts pp where pp.id = split_part(r.ref, ':', 2)::uuid;
    perform notify(array[p.by_user], 'pcw_expired',
                   jsonb_build_object('post_id', p.id, 'starts_at', p.starts_at, 'best_of', p.best_of, 'maps', p.maps),
                   r.ref, true);
    v_pcw_expired := v_pcw_expired + 1;
  end loop;

  -- Temporada que termina en menos de 24 horas: a quien jugó al menos la mitad de los mixes que pide el ranking.
  for r in
    insert into notification_sent(kind, ref)
    select 'season_ending', 'season_ending:' || s.id
      from seasons s
     where s.status = 'active' and s.ends_at > v_now and s.ends_at <= v_now + interval '24 hours'
    on conflict do nothing
    returning ref
  loop
    for p in
      select s.id as season_id, s.number, s.name, s.ends_at, s.min_matches, k.player_id, k.matches,
             case when k.eligible then k.rank end as position
        from seasons s, season_rank(s.starts_at, v_now, s.min_matches) k
       where s.id = split_part(r.ref, ':', 2)::uuid and k.matches >= ceil(s.min_matches / 2.0)
    loop
      perform notify(users_of_players(array[p.player_id]), 'season_ending',
                     jsonb_build_object('season', jsonb_build_object('id', p.season_id, 'number', p.number, 'name', p.name),
                                        'ends_at', p.ends_at, 'position', p.position, 'matches', p.matches,
                                        'min_matches', p.min_matches),
                     r.ref);
      v_season := v_season + 1;
    end loop;
  end loop;

  -- Partida de torneo sin resultado 3 horas después de su horario: al organizador del torneo y a los admins.
  for r in
    insert into notification_sent(kind, ref)
    select 'match_no_result', 'match_no_result:' || m.id || ':' || extract(epoch from m.starts_at)::bigint
      from matches m
     where m.kind = 'official' and m.status in ('upcoming', 'live') and m.parent_match_id is null and m.bye is not true
       and m.team1 is not null and m.team2 is not null
       and m.starts_at <= v_now - interval '3 hours' and m.starts_at > v_now - interval '7 days'
    on conflict do nothing
    returning ref
  loop
    perform notify(notify_admin_ids() || coalesce(
                     (select array_agg(e.organizer_id) from matches m join events e on e.id = m.event_id
                        join profiles pr on pr.id = e.organizer_id and pr.role = 'organizer'
                       where m.id = split_part(r.ref, ':', 2)::uuid), '{}'),
                   'match_no_result', match_ref(split_part(r.ref, ':', 2)::uuid), r.ref);
    v_no_result := v_no_result + 1;
  end loop;

  -- VIP que termina en menos de 3 días, sin revocar y sin otro período que lo continúe. Un lifetime no tiene fin.
  for r in
    insert into notification_sent(kind, ref)
    select 'vip_expiring', 'vip_expiring:' || v.id
      from vip_memberships v
     where v.revoked_at is null and v.ends_at > v_now and v.ends_at <= v_now + interval '3 days'
       and not exists (select 1 from vip_memberships n
                        where n.user_id = v.user_id and n.id <> v.id and n.revoked_at is null
                          and n.starts_at <= v.ends_at and (n.ends_at is null or n.ends_at > v.ends_at))
    on conflict do nothing
    returning ref
  loop
    select v.user_id, v.ends_at into p from vip_memberships v where v.id = split_part(r.ref, ':', 2)::uuid;
    perform notify(array[p.user_id], 'vip_expiring', jsonb_build_object('ends_at', p.ends_at), r.ref, true);
    v_vip := v_vip + 1;
  end loop;

  delete from notification_sent where sent_at < v_now - interval '60 days';

  return jsonb_build_object('match_soon', v_soon, 'pcw_soon', v_pcw_soon, 'pcw_expired', v_pcw_expired,
                            'season_ending', v_season, 'match_no_result', v_no_result, 'vip_expiring', v_vip);
end $$;

revoke all on function public.notify_due() from public, anon, authenticated;
grant execute on function public.notify_due() to service_role;

commit;
