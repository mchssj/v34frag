-- 92: repetición 2D y mapa de calor (bitácora docs/bitacora/2026-11-12-repeticion-2d-y-mapa-de-calor, Kyan 2026-11-12).
--
--   1. match_kills: cada kill de la partida con la posición del que mata y del que muere (coordenadas del juego).
--      Llega en el resultado del reporter 2.11.0 ("kill_pos") y la guarda csstv_kills_save desde csstv_after_ingest,
--      igual que los clips. Guarda el SteamID que mandó el servidor: la ficha se busca al leer (steam_owner), así
--      un SteamID adicional que se suma después también trae sus kills viejas.
--   2. matches.track_key: dónde quedó el .trk en R2 (tracks/AAAA/MM/<uid>.trk). Lo marca el Worker de demos con
--      track_mark (mismo token que demo_mark).
--   3. player_heatmap(p_player, p_map, p_kind, p_matches): puntos para el mapa de calor de un jugador en un mapa,
--      de sus últimas p_matches partidas terminadas: 'kills' (desde dónde mató) o 'deaths' (dónde murió).
--   4. match_kills se lee también sin sesión (como las estadísticas de una partida).
-- Necesita las migraciones de clips (csstv_clips_save en csstv_after_ingest) y de demos externas (demo_auth), y la 15.
-- Inversa: docs/bitacora/2026-10-14-replanteo-modelo-datos/reversas/92_repeticion_2d.sql.
begin;

do $$
begin
  if to_regclass('public.match_kills') is not null then raise exception 'replanteo 92: ya se aplicó (match_kills existe)'; end if;
  if to_regprocedure('public.csstv_after_ingest(uuid, jsonb, text)') is null
     or to_regprocedure('public.demo_auth(text)') is null
     or to_regprocedure('public.steam_owner(text)') is null then
    raise exception 'replanteo 92: faltan csstv_after_ingest, demo_auth o steam_owner';
  end if;
end $$;

create or replace function pg_temp.reemplazar(fn regprocedure, cambios text[][]) returns void language plpgsql as $$
declare d text := pg_get_functiondef(fn); i int; a text; b text;
begin
  for i in 1 .. array_length(cambios, 1) loop
    a := replace(cambios[i][1], E'\r', ''); b := replace(cambios[i][2], E'\r', '');
    if position(a in d) = 0 then
      raise exception 'replanteo 92: en % no se encontró: %', fn, left(a, 80);
    end if;
    d := replace(d, a, b);
  end loop;
  execute d;
end $$;

-- ---------- 1. Kills con posición ----------
create table public.match_kills (
  id           bigint generated always as identity primary key,
  match_id     uuid not null references public.matches(id) on delete cascade,
  round        smallint not null check (round between 1 and 200),
  killer_steam text,                       -- null: el mundo, un suicidio o un bot
  victim_steam text not null,
  weapon       text not null default '' check (length(weapon) <= 32),
  headshot     boolean not null default false,
  kx           integer,                    -- dónde estaba el que mató (null si no hubo)
  ky           integer,
  vx           integer not null,           -- dónde murió
  vy           integer not null,
  check ((kx is null) = (ky is null))
);
create index match_kills_match on public.match_kills (match_id, round);
create index match_kills_killer on public.match_kills (killer_steam) where killer_steam is not null;
create index match_kills_victim on public.match_kills (victim_steam);
alter table public.match_kills enable row level security;
create policy match_kills_read on public.match_kills for select using (true);

-- Lee "kill_pos" del resultado: [ronda, "mata", "muere", "arma", hs, x, y, vx, vy]. Rehace las de la partida
-- (una partida en vivo que se reenvía trae todas). Un registro inválido se descarta con un aviso, sin tirar la ingesta.
create function public.csstv_kills_save(p_match uuid, p jsonb)
returns void language plpgsql security definer set search_path = public as $$
declare
  k jsonb;
  v_killer text;
  v_victim text;
begin
  if p_match is null or jsonb_typeof(p->'kill_pos') is distinct from 'array' then return; end if;
  delete from match_kills where match_id = p_match;
  for k in select value from jsonb_array_elements(p->'kill_pos') limit 600 loop
    begin
      if jsonb_typeof(k) <> 'array' or jsonb_array_length(k) < 9 then
        raise exception 'formato';
      end if;
      v_killer := nullif(trim(k->>1), '');
      v_victim := nullif(trim(k->>2), '');
      if v_victim is null then raise exception 'sin víctima'; end if;
      insert into match_kills(match_id, round, killer_steam, victim_steam, weapon, headshot, kx, ky, vx, vy)
      values (p_match, (k->>0)::smallint,
              case when v_killer is null then null else coalesce(csstv_steam64(v_killer), left(v_killer, 40)) end,
              coalesce(csstv_steam64(v_victim), left(v_victim, 40)),
              left(coalesce(k->>3, ''), 32),
              (k->>4) in ('1', 'true'),
              case when v_killer is null then null else (k->>5)::integer end,
              case when v_killer is null then null else (k->>6)::integer end,
              (k->>7)::integer, (k->>8)::integer);
    exception when others then
      raise warning 'csstv_kills_save: kill descartada en %: % (%)', p_match, sqlerrm, left(k::text, 200);
    end;
  end loop;
end $$;

select pg_temp.reemplazar('public.csstv_after_ingest(uuid, jsonb, text)', array[
  array[$q$  perform csstv_clips_save(p_match, p);$q$,
        $q$  perform csstv_clips_save(p_match, p);
  -- Kills con posición para el mapa de calor (replanteo 92)
  perform csstv_kills_save(p_match, p);$q$]]);

-- ---------- 2. El .trk en R2 ----------
alter table public.matches add column track_key text
  check (track_key is null or track_key ~ '^tracks/[0-9]{4}/[0-9]{2}/[A-Za-z0-9_-]{6,80}\.trk$');

-- El Worker subió el .trk de la partida. Devuelve la ruta guardada.
create function public.track_mark(p_token text, p_uid text, p_key text)
returns text language plpgsql security definer set search_path = public as $$
declare v_key text;
begin
  perform demo_auth(p_token);
  if p_key is null or p_key !~ '^tracks/[0-9]{4}/[0-9]{2}/[A-Za-z0-9_-]{6,80}\.trk$' then
    raise exception 'Ruta de R2 inválida' using errcode = 'PT422';
  end if;
  update matches set track_key = p_key where external_id = p_uid returning track_key into v_key;
  if v_key is null then raise exception 'La partida no existe' using errcode = 'PT422'; end if;
  return v_key;
end $$;

-- ---------- 3. Mapa de calor de un jugador ----------
-- Sus SteamID (principal y adicionales), sus últimas p_matches partidas terminadas en el mapa y los puntos.
create function public.player_heatmap(p_player uuid, p_map text, p_kind text default 'kills', p_matches integer default 30)
returns table(x integer, y integer, match_id uuid)
language plpgsql stable security definer set search_path = public as $$
declare v_steams text[];
begin
  if p_kind not in ('kills', 'deaths') then
    raise exception 'Tipo inválido: usá kills o deaths' using errcode = 'PT422';
  end if;
  select array_remove(array[p.steam_id] || coalesce(array_agg(x.steam_id) filter (where x.steam_id is not null), '{}'), null)
    into v_steams
    from players p left join player_extra_steam_ids x on x.player_id = p.id
   where p.id = p_player
   group by p.steam_id;
  if coalesce(cardinality(v_steams), 0) = 0 then return; end if;
  return query
    with partidas as (
      select m.id
        from matches m
       where m.map = p_map and m.status = 'finished'
         and exists (select 1 from match_kills k where k.match_id = m.id
                      and (k.killer_steam = any(v_steams) or k.victim_steam = any(v_steams)))
       order by m.played_at desc
       limit least(greatest(coalesce(p_matches, 30), 1), 100)
    )
    select case when p_kind = 'kills' then k.kx else k.vx end,
           case when p_kind = 'kills' then k.ky else k.vy end,
           k.match_id
      from match_kills k join partidas pa on pa.id = k.match_id
     where case when p_kind = 'kills' then k.killer_steam = any(v_steams) and k.kx is not null
                else k.victim_steam = any(v_steams) end;
end $$;

-- ---------- 4. Permisos ----------
revoke all on function public.csstv_kills_save(uuid, jsonb) from public, anon, authenticated;
revoke all on function public.track_mark(text, text, text) from public;
grant execute on function public.track_mark(text, text, text) to anon, authenticated;
grant execute on function public.player_heatmap(uuid, text, text, integer) to anon, authenticated, service_role;
grant select on public.match_kills to anon, authenticated;
-- matches se lee columna por columna (replanteo 10, para esconder link_code): la columna nueva también.
grant select (track_key) on public.matches to anon, authenticated;
grant all on public.match_kills to service_role;

commit;
