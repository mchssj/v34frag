-- Inversa del replanteo 83 (una notificación por partida con jugadas, la sección Juega del inicio y equipos más parejos).
-- Deja las funciones y vistas como estaban y saca las columnas nuevas (se pierden los nombres internos y qué servidores
-- salen en el inicio). Las notificaciones clips_detected se borran (el tipo deja de existir). mm_config vuelve a 200, 100
-- y 5 solo si sigue con los valores de la 83.
begin;

create or replace function pg_temp.reemplazar(fn regprocedure, cambios text[][]) returns void language plpgsql as $$
declare d text := pg_get_functiondef(fn); i int; a text; b text;
begin
  for i in 1 .. array_length(cambios, 1) loop
    a := replace(cambios[i][1], E'\r', ''); b := replace(cambios[i][2], E'\r', '');
    if position(a in d) = 0 then
      raise exception 'inversa 83: en % no se encontró: %', fn, left(a, 80);
    end if;
    d := replace(d, a, b);
  end loop;
  execute d;
end $$;

-- 5. Equipos
update public.mm_config
   set balance_rating_weight = 200, balance_rating_cap = 100, balance_rating_prior_maps = 5
 where id = 1 and balance_rating_weight = 400 and balance_rating_cap = 200 and balance_rating_prior_maps = 3;
alter table public.mm_config
  alter column balance_rating_weight set default 200,
  alter column balance_rating_cap set default 100,
  alter column balance_rating_prior_maps set default 5;

-- 4. La cola
drop function public.mm_public_counts();

-- 3. Servidores (las vistas como las dejaron la 27 y la 36)
drop view public.game_servers_public;
create view public.game_servers_public as
select id, name, connect_address, mode, region, tv_port from game_servers
 where active and (license_expires_at is null or license_expires_at > now()); -- (replanteo 12)

drop view public.admin_server_list;
create view public.admin_server_list with (security_invoker = true) as
select g.id, g.name, g.active, g.created_at, g.last_seen_at, g.connect_address, g.panel_server_id,
       g.license_expires_at, g.allowed_ip, g.last_ip, g.plugin_version,
       case when not g.active then 'revoked'
            when g.license_expires_at <= now() then 'expired'
            when g.license_expires_at <= now() + interval '7 days' then 'expiring'
            else 'ok' end as license_state,
       coalesce(g.last_seen_at > now() - interval '35 minutes', false) as online,
       g.panel_server_id is not null as has_panel,
       (select count(*)::int from matches m where m.server_id = g.id) as matches,
       (select max(coalesce(m.played_at, m.starts_at)) from matches m where m.server_id = g.id) as last_match_at,
       search_norm(concat_ws(' ', g.name, g.connect_address, g.allowed_ip, g.last_ip, g.plugin_version, g.region)) as search,
       g.mode, g.region, g.tv_port, g.hud_port, g.hud_enabled, g.hud_key, g.hud_seen_at, hud_streaming(g.id) as hud_streaming
  from game_servers g;

drop index public.game_servers_internal_name_key;
alter table public.game_servers drop column internal_name, drop column listed;
comment on column public.game_servers.name is null;

-- 2. El video terminado vuelve a avisar
create or replace function public.tg_notify_match_clips() returns trigger language plpgsql security definer set search_path = public as $$
begin
  if (new.video_status = 'done' and old.video_status is distinct from 'done' and new.video_review is distinct from 'pending')
     or (new.video_review = 'approved' and old.video_review is distinct from 'approved') then
    perform notify(users_of_steam(array[new.player_steamid]), 'clip_ready',
                   jsonb_build_object('clip_id', new.id, 'match_id', new.match_id, 'round', new.round,
                                      'kills', cardinality(new.kill_ticks), 'clutch_vs', new.clutch_vs));
  end if;
  return null;
end $$;

-- 1. El aviso por partida
select pg_temp.reemplazar('public.csstv_clips_save(uuid,jsonb)', array[
  [E'  perform clips_notify_detected(p_match);   -- (replanteo 83) un aviso por jugador\n', '']
]);
drop function public.clips_notify_detected(uuid);
delete from public.notifications where type = 'clips_detected';
select pg_temp.reemplazar('public.notification_category(text)', array[
  ['''clip_ready'', ''clips_detected'') then ''elo'' -- (replanteo 83) clips_detected', '''clip_ready'') then ''elo''']
]);

notify pgrst, 'reload schema';
commit;
