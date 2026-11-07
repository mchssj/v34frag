-- Replanteo 83: una notificación por partida con jugadas, la sección Juega del inicio y equipos más parejos
-- (plan docs/bitacora/2026-11-07-jugadas-landing-emparejamiento, pedido y aprobado por Daniel el 2026-11-07).
--   1. clips_detected (categoría elo): un aviso por jugador y partida al guardar las jugadas (clips_notify_detected, desde
--      csstv_clips_save), con cuántas son y de qué tipo. ref = 'clips:<partida>:<SteamID>': una reingesta no lo repite.
--   2. tg_notify_match_clips deja de avisar cada video terminado: solo el clip reprocesado que un admin aprueba.
--   3. game_servers.name es el nombre público. internal_name (solo Administración) guarda cómo lo llamamos nosotros, y listed
--      dice si sale en el inicio. game_servers_public suma listed; admin_server_list, los dos.
--   4. mm_public_counts(): si la cola está abierta y cuántos hay en ella, para el inicio (solo números).
--   5. mm_config: el ELO de armado con más peso del rating (400, tope 200, 3 mapas previos), por defecto y en la fila de hoy
--      si sigue con los valores de antes (200, 100, 5).
begin;

do $$
begin
  if to_regprocedure('public.mm_balance_elos(uuid[], integer[])') is null then
    raise exception 'replanteo 83: falta el replanteo 73 (aplicar antes 73_mm_equipos_con_rating.sql)';
  end if;
  if to_regclass('public.match_clip_list') is null or to_regprocedure('public.csstv_clips_save(uuid, jsonb)') is null then
    raise exception 'replanteo 83: faltan los clips (match_clip_list y csstv_clips_save)';
  end if;
  if to_regprocedure('public.clips_notify_detected(uuid)') is not null then
    raise exception 'replanteo 83: clips_notify_detected ya existe (¿ya se aplicó?)';
  end if;
end $$;

create or replace function pg_temp.reemplazar(fn regprocedure, cambios text[][]) returns void language plpgsql as $$
declare d text := pg_get_functiondef(fn); i int; a text; b text;
begin
  for i in 1 .. array_length(cambios, 1) loop
    -- Sin \r: con el archivo en CRLF (autocrlf), los textos de varias líneas no coincidirían con la función.
    a := replace(cambios[i][1], E'\r', ''); b := replace(cambios[i][2], E'\r', '');
    if position(a in d) = 0 then
      raise exception 'replanteo 83: en % no se encontró: %', fn, left(a, 80);
    end if;
    d := replace(d, a, b);
  end loop;
  execute d;
end $$;

-- ---------- 1. Un aviso por partida con jugadas ----------

select pg_temp.reemplazar('public.notification_category(text)', array[
  ['''clip_ready'') then ''elo''', '''clip_ready'', ''clips_detected'') then ''elo'' -- (replanteo 83) clips_detected']
]);

create function public.clips_notify_detected(p_match uuid) returns void
  language plpgsql security definer set search_path = public as $$
declare
  r record;
  v_ref text;
  v_map text;
begin
  select m.map into v_map from matches m where m.id = p_match;
  for r in
    select l.player_steamid,
           count(*)::int as n,
           coalesce(array_agg(l.kills order by l.round) filter (where l.clutch_vs is null), '{}') as kills,
           coalesce(array_agg(l.clutch_vs order by l.round) filter (where l.clutch_vs is not null), '{}') as clutches
      from match_clip_list l
     where l.match_id = p_match and l.player_steamid is not null
     group by l.player_steamid
  loop
    v_ref := 'clips:' || p_match || ':' || r.player_steamid;
    continue when exists (select 1 from notifications where ref = v_ref);
    perform notify(users_of_steam(array[r.player_steamid]), 'clips_detected',
                   jsonb_build_object('match_id', p_match, 'map', v_map, 'count', r.n,
                                      'kills', to_jsonb(r.kills), 'clutches', to_jsonb(r.clutches)),
                   v_ref, true);
  end loop;
end $$;
revoke all on function public.clips_notify_detected(uuid) from public, anon, authenticated;
comment on function public.clips_notify_detected(uuid) is
  'Un aviso clips_detected por jugador con jugadas visibles en la partida; no repite (ref clips:<partida>:<SteamID>). Replanteo 83';

select pg_temp.reemplazar('public.csstv_clips_save(uuid,jsonb)', array[
  [E'  delete from match_clips\n   where match_id = p_match and not ((round || ''|'' || player_steamid) = any(v_keys));\n',
   E'  delete from match_clips\n   where match_id = p_match and not ((round || ''|'' || player_steamid) = any(v_keys));\n'
   || E'  perform clips_notify_detected(p_match);   -- (replanteo 83) un aviso por jugador\n']
]);

-- ---------- 2. El video terminado ya no avisa ----------

create or replace function public.tg_notify_match_clips() returns trigger language plpgsql security definer set search_path = public as $$
begin
  -- (replanteo 83) Las jugadas se avisan juntas al detectarse (clips_detected). Queda el clip reprocesado que aprueba un
  -- admin, que llega días después.
  if new.video_review = 'approved' and old.video_review is distinct from 'approved' then
    perform notify(users_of_steam(array[new.player_steamid]), 'clip_ready',
                   jsonb_build_object('clip_id', new.id, 'match_id', new.match_id, 'round', new.round,
                                      'kills', cardinality(new.kill_ticks), 'clutch_vs', new.clutch_vs));
  end if;
  return null;
end $$;

-- ---------- 3. Nombre público, nombre interno y el inicio ----------

alter table public.game_servers
  add column internal_name text constraint game_servers_internal_name_len
    check (internal_name is null or char_length(trim(internal_name)) between 2 and 60),
  add column listed boolean not null default true;
create unique index game_servers_internal_name_key on public.game_servers (lower(trim(internal_name))) where internal_name is not null;
comment on column public.game_servers.name is 'Nombre público: el que ve todo el mundo (inicio, sala, avisos). Replanteo 83';
comment on column public.game_servers.internal_name is 'Cómo lo llamamos nosotros (flow, MVZG…). Solo Administración. Replanteo 83';
comment on column public.game_servers.listed is 'Sale en la lista de servidores del inicio. Replanteo 83';
update public.game_servers set internal_name = left(trim(name), 60) where internal_name is null;

create or replace view public.game_servers_public as
select id, name, connect_address, mode, region, tv_port, listed from game_servers
 where active and (license_expires_at is null or license_expires_at > now()); -- (replanteo 12); listed (replanteo 83)

create or replace view public.admin_server_list with (security_invoker = true) as
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
       search_norm(concat_ws(' ', g.name, g.internal_name, g.connect_address, g.allowed_ip, g.last_ip, g.plugin_version, g.region)) as search,
       g.mode, g.region, g.tv_port, g.hud_port, g.hud_enabled, g.hud_key, g.hud_seen_at, hud_streaming(g.id) as hud_streaming,
       g.internal_name, g.listed   -- (replanteo 83)
  from game_servers g;

-- ---------- 4. La cola, en números, para el inicio ----------

create function public.mm_public_counts() returns jsonb
  language sql stable security definer set search_path = public as $$
  select jsonb_build_object('open', coalesce((select open from mm_config where id = 1), false),
                            'in_queue', (select count(*)::int from mm_queue))
$$;
revoke all on function public.mm_public_counts() from public;
grant execute on function public.mm_public_counts() to anon, authenticated, service_role;
comment on function public.mm_public_counts() is 'Si la cola está abierta y cuántos hay en ella (sin nombres), para el inicio. Replanteo 83';

-- ---------- 5. Equipos más parejos ----------

alter table public.mm_config
  alter column balance_rating_weight set default 400,
  alter column balance_rating_cap set default 200,
  alter column balance_rating_prior_maps set default 3;
update public.mm_config
   set balance_rating_weight = 400, balance_rating_cap = 200, balance_rating_prior_maps = 3
 where id = 1 and balance_rating_weight = 200 and balance_rating_cap = 100 and balance_rating_prior_maps = 5;

notify pgrst, 'reload schema';
commit;
