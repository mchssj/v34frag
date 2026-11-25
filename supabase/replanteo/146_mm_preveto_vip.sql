-- 146: preveto de mapas para VIP (bitácora docs/bitacora/2026-11-25-preveto-vip, Daniel 2026-11-25).
--
--   1. mm_config.vip_preveto_max: cuántos mapas se prevetan como máximo por partida (0: apagado).
--   2. mm_prevetos: el mapa que eligió cada VIP en cada modo. mm_set_preveto(modo, mapa) lo elige (solo VIP, del pool
--      activo del modo) o lo saca (mapa nulo, cualquiera).
--   3. mm_start_veto: antes del primer turno banea los mapas con más prevetos de los VIP vigentes de la sala; entre
--      empatados, al azar. Siempre quedan al menos 2 para los capitanes (mm_preveto_slots).
--   4. match_vetos.vip_votes: los prevetos que tuvo el mapa; nulo en los baneos de siempre. Quién votó no se publica.
--   5. mm_lobby_json, mm_my_profile, mm_set_config, mm_set_mode_maps y manual_valores.
-- No necesita las 139 a 145. Va antes que la API y la web.
-- Inversa: docs/bitacora/2026-10-14-replanteo-modelo-datos/reversas/146_mm_preveto_vip.sql.
begin;

do $$
begin
  if to_regclass('public.mm_prevetos') is not null then raise exception 'replanteo 146: ya se aplicó (mm_prevetos existe)'; end if;
  if to_regprocedure('public.is_vip(uuid)') is null then raise exception 'replanteo 146: falta is_vip (32)'; end if;
end $$;

create or replace function pg_temp.reemplazar(fn regprocedure, cambios text[][]) returns void language plpgsql as $$
declare d text := pg_get_functiondef(fn); i int; a text; b text;
begin
  for i in 1 .. array_length(cambios, 1) loop
    a := replace(cambios[i][1], E'\r', ''); b := replace(cambios[i][2], E'\r', '');
    if position(a in d) = 0 then
      raise exception 'replanteo 146: en % no se encontró: %', fn, left(a, 80);
    end if;
    d := replace(d, a, b);
  end loop;
  execute d;
end $$;

alter table public.mm_config add column vip_preveto_max integer not null default 2 check (vip_preveto_max between 0 and 10);
comment on column public.mm_config.vip_preveto_max is 'Mapas que los VIP prevetan como máximo por partida (0: apagado). Replanteo 146';

alter table public.match_vetos add column vip_votes integer check (vip_votes > 0);
comment on column public.match_vetos.vip_votes is 'Prevetos de VIP que tuvo el mapa (baneado antes del veto); nulo en los demás. Replanteo 146';

create table public.mm_prevetos (
  user_id uuid not null references auth.users(id) on delete cascade,
  mode text not null references public.game_modes(code) on delete cascade,
  map text not null references public.map_pool(name) on update cascade on delete cascade,
  updated_at timestamptz not null default now(),
  primary key (user_id, mode)
);
comment on table public.mm_prevetos is 'El mapa que preveta cada VIP en cada modo del matchmaking. Solo por funciones. Replanteo 146';
alter table public.mm_prevetos enable row level security;
revoke all on public.mm_prevetos from anon, authenticated;

/** Cuántos mapas se prevetan como máximo en un modo: lo configurado, dejando al menos 2 para los capitanes. */
create function public.mm_preveto_slots(p_mode text) returns integer
  language sql stable security definer set search_path = public as $$
  select greatest(0, least((select vip_preveto_max from mm_config where id = 1),
                           (select count(*)::int from mm_mode_maps where mode = p_mode) - 2))
$$;

create function public.mm_set_preveto(p_mode text, p_map text) returns void
  language plpgsql security definer set search_path = public as $$
declare me uuid := auth.uid();
begin
  if me is null then raise exception 'Tienes que iniciar sesión' using errcode = '42501'; end if;
  if p_map is null then
    delete from mm_prevetos where user_id = me and mode = p_mode;
    return;
  end if;
  if not is_vip(me) then raise exception 'Prevetar mapas es exclusivo para VIP' using errcode = '42501'; end if;
  if not exists (select 1 from mm_mode_settings where mode = p_mode and enabled) then raise exception 'Ese modo no está habilitado'; end if;
  if mm_preveto_slots(p_mode) = 0 then raise exception 'El preveto de mapas está apagado'; end if;
  if not exists (select 1 from mm_mode_maps where mode = p_mode and map = p_map) then raise exception 'Ese mapa no está en el pool'; end if;
  insert into mm_prevetos (user_id, mode, map) values (me, p_mode, p_map)
  on conflict (user_id, mode) do update set map = excluded.map, updated_at = now();
end $$;

revoke all on function public.mm_preveto_slots(text), public.mm_set_preveto(text, text) from public, anon, authenticated;
grant execute on function public.mm_preveto_slots(text), public.mm_set_preveto(text, text) to service_role;
grant execute on function public.mm_set_preveto(text, text) to authenticated;

select pg_temp.reemplazar('public.mm_start_veto(uuid)', array[[
  $a$    returning id into v_match;$a$,
  $b$    returning id into v_match;
  -- (replanteo 146) ini: los prevetos de los VIP; los más votados y, entre empatados, al azar. Sin bando ni autor.
  insert into match_vetos (match_id, seq, map, action, vip_votes)
    select v_match, row_number() over (order by x.votes desc, x.r), x.map, 'ban', x.votes
      from (select pv.map, count(*)::int as votes, random() as r
              from mm_lobby_players lp
              join mm_prevetos pv on pv.user_id = lp.user_id and pv.mode = l.mode
              join mm_mode_maps mm on mm.mode = pv.mode and mm.map = pv.map
             where lp.lobby_id = p_lobby and is_vip(lp.user_id)
             group by pv.map) x
     order by x.votes desc, x.r
     limit mm_preveto_slots(l.mode);
  -- (replanteo 146) fin$b$]]);

select pg_temp.reemplazar('public.mm_lobby_json(uuid, uuid)', array[[
  $a$'auto', v.by_user is null) order by v.seq)$a$,
  $b$'auto', v.by_user is null and v.vip_votes is null, 'vip_votes', v.vip_votes) order by v.seq)$b$]]);

select pg_temp.reemplazar('public.mm_my_profile()', array[[
  $a$    'auto_accept', jsonb_build_object('enabled', mm_auto_accept_on(me), 'allowed', v_vip),$a$,
  $b$    'auto_accept', jsonb_build_object('enabled', mm_auto_accept_on(me), 'allowed', v_vip),
    -- (replanteo 146) ini: preveto de mapas; null si está apagado. Los mapas, solo para quien puede elegir.
    'preveto', case when c.vip_preveto_max > 0 then jsonb_build_object('allowed', v_vip,
        'modes', case when v_vip then (select coalesce(jsonb_agg(jsonb_build_object('mode', s.mode, 'max', mm_preveto_slots(s.mode),
            'map', (select pv.map from mm_prevetos pv join mm_mode_maps mm on mm.mode = pv.mode and mm.map = pv.map where pv.user_id = me and pv.mode = s.mode),
            'pool', (select coalesce(jsonb_agg(jsonb_build_object('name', mm.map, 'label', initcap(regexp_replace(mm.map, '^[a-z]+_', '')), 'image_url', mp.image_url) order by mm.position), '[]')
                       from mm_mode_maps mm join map_pool mp on mp.name = mm.map where mm.mode = s.mode)) order by s.position), '[]')
          from mm_mode_settings s where s.enabled) else '[]'::jsonb end) end,
    -- (replanteo 146) fin$b$]]);

select pg_temp.reemplazar('public.mm_set_config(jsonb)', array[[
  $a$    block_changes_week = coalesce((p->>'block_changes_week')::int, block_changes_week)$a$,
  $b$    block_changes_week = coalesce((p->>'block_changes_week')::int, block_changes_week),
    vip_preveto_max = coalesce((p->>'vip_preveto_max')::int, vip_preveto_max)  -- (replanteo 146)$b$]]);

select pg_temp.reemplazar('public.mm_set_mode_maps(text, text[])', array[[
  $a$from unnest(p_maps) with ordinality t(n, o);$a$,
  $b$from unnest(p_maps) with ordinality t(n, o);
  perform mm_emit('mm.config', null, null);  -- (replanteo 146) las opciones del preveto salen del pool$b$]]);

select pg_temp.reemplazar('public.manual_valores()', array[[
  $a$    'mm.veto', m.veto_seconds,$a$,
  $b$    'mm.veto', m.veto_seconds, 'mm.preveto_max', m.vip_preveto_max,$b$]]);

notify pgrst, 'reload schema';
commit;
