-- Replanteo 158: estadísticas de aim del lado del servidor (plan docs/bitacora/2026-11-27-anticheat-deteccion). Va después de la 156.
--   El plugin cml_aimstats 1.0.0 manda, al terminar cada mix, por jugador: kills, headshots, kills con un giro de mira anormal
--   en los ticks previos (snaps), kills a través de un humo y el giro máximo. ac_aim_report las guarda y marca lo anormal en la
--   sesión del anticheat de ese jugador (si la tiene). No sanciona: son marcas para revisar.
begin;

do $$
begin
  if to_regclass('public.ac_flags') is null then raise exception 'replanteo 158: falta la 156 (ac_flags)'; end if;
  if to_regclass('public.ac_aim_stats') is not null then raise exception 'replanteo 158: ac_aim_stats ya existe (¿ya se aplicó?)'; end if;
end $$;

create table public.ac_aim_stats (
  id          bigint generated always as identity primary key,
  server_id   uuid not null references public.game_servers(id) on delete cascade,
  match_uid   text check (char_length(match_uid) <= 64),
  map         text check (char_length(map) <= 64),
  steam_id    text not null check (is_steam64(steam_id)),
  player_id   uuid references public.players(id) on delete set null,
  kills       integer not null check (kills between 0 and 1000),
  headshots   integer not null check (headshots between 0 and 1000),
  snaps       integer not null check (snaps between 0 and 1000),
  smoke_kills integer not null check (smoke_kills between 0 and 1000),
  max_snap    numeric(6, 1) not null default 0 check (max_snap between 0 and 3600),
  created_at  timestamptz not null default now()
);
create index ac_aim_stats_steam on public.ac_aim_stats (steam_id, created_at desc);
alter table public.ac_aim_stats enable row level security;
revoke all on public.ac_aim_stats from public, anon, authenticated;
comment on table public.ac_aim_stats is 'Por jugador y mix, del plugin cml_aimstats. Indicios para revisar, no pruebas';

-- p_rows: [{"steam": "7656…", "kills": 20, "hs": 9, "snaps": 2, "smoke": 1, "max_snap": 31.5}]
create function public.ac_aim_report(p_token text, p_rows jsonb, p_map text default null, p_match_uid text default null) returns jsonb
  language plpgsql security definer set search_path = public as $$
declare
  v_server uuid := csstv_auth(p_token);
  r jsonb;
  v_steam text;
  v_kills integer; v_hs integer; v_snaps integer; v_smoke integer; v_max numeric;
  v_sess uuid;
  v_stored integer := 0;
  v_flagged integer := 0;
  v_info jsonb;
begin
  if jsonb_typeof(p_rows) <> 'array' or jsonb_array_length(p_rows) > 64 then raise exception 'Lote inválido: hasta 64 jugadores'; end if;
  for r in select * from jsonb_array_elements(p_rows) loop
    v_steam := r->>'steam';
    if not coalesce(is_steam64(v_steam), false) then continue; end if;
    v_kills := least(greatest(coalesce((r->>'kills')::integer, 0), 0), 1000);
    v_hs := least(greatest(coalesce((r->>'hs')::integer, 0), 0), v_kills);
    v_snaps := least(greatest(coalesce((r->>'snaps')::integer, 0), 0), v_kills);
    v_smoke := least(greatest(coalesce((r->>'smoke')::integer, 0), 0), v_kills);
    v_max := least(greatest(coalesce((r->>'max_snap')::numeric, 0), 0), 3600);
    insert into ac_aim_stats (server_id, match_uid, map, steam_id, player_id, kills, headshots, snaps, smoke_kills, max_snap)
      values (v_server, left(p_match_uid, 64), left(p_map, 64), v_steam, steam_owner(v_steam), v_kills, v_hs, v_snaps, v_smoke, v_max);
    v_stored := v_stored + 1;

    -- La sesión del anticheat de ese jugador en este servidor: la abierta o la última de las 3 horas anteriores.
    select id into v_sess from ac_sessions
     where steam_id = v_steam and server_id = v_server and (status = 'open' or ended_at > now() - interval '3 hours')
     order by started_at desc limit 1;
    if v_sess is null or v_kills < 10 then continue; end if;
    v_info := jsonb_build_object('map', p_map, 'kills', v_kills, 'headshots', v_hs, 'snaps', v_snaps, 'smoke_kills', v_smoke, 'max_snap', v_max);
    if v_snaps::numeric / v_kills >= 0.3 then
      perform ac_flag(v_sess, 'aim_snap', 2::smallint, coalesce(p_match_uid, p_map, ''), v_info); v_flagged := v_flagged + 1;
    end if;
    if v_smoke >= 4 and v_smoke::numeric / v_kills >= 0.25 then
      perform ac_flag(v_sess, 'aim_smoke', 2::smallint, coalesce(p_match_uid, p_map, ''), v_info); v_flagged := v_flagged + 1;
    end if;
    if v_kills >= 15 and v_hs::numeric / v_kills >= 0.75 then
      perform ac_flag(v_sess, 'aim_headshot', 1::smallint, coalesce(p_match_uid, p_map, ''), v_info); v_flagged := v_flagged + 1;
    end if;
  end loop;
  return jsonb_build_object('stored', v_stored, 'flagged', v_flagged);
end $$;

revoke all on function public.ac_aim_report(text, jsonb, text, text) from public, anon, authenticated;
grant execute on function public.ac_aim_report(text, jsonb, text, text) to anon, authenticated;

notify pgrst, 'reload schema';

commit;
