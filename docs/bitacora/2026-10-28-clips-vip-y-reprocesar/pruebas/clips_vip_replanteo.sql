-- Pruebas de los clips VIP con el replanteo aplicado (26: ficha con steam_owner; 28: aviso clip_ready). Todo con rollback.
begin;

create function pg_temp.ok(c boolean, msg text) returns void language plpgsql as $$
begin
  if not coalesce(c, false) then raise exception 'FALLA: %', msg; end if;
  raise notice 'OK: %', msg;
end $$;
create function pg_temp.s(n int) returns text language sql immutable as $$ select '7656119834' || lpad(n::text, 7, '0') $$;

-- V: VIP con un SteamID principal (1) y uno adicional (2). N: normal (3).
insert into auth.users (id, email, raw_user_meta_data, encrypted_password) values
  ('aaaaaaaa-3400-4000-8000-0000000000a1', 'v1-34@test.local', '{"tag":"Vip34"}', 'x'),
  ('aaaaaaaa-3400-4000-8000-000000000003', 'n-34@test.local', '{"tag":"Normal34"}', 'x');
insert into public.players(id, nick, steam_id, user_id) values
  ('dddddddd-3400-4000-8000-0000000000a1', 'Vip34', pg_temp.s(1), 'aaaaaaaa-3400-4000-8000-0000000000a1'),
  ('dddddddd-3400-4000-8000-000000000003', 'Normal34', pg_temp.s(3), 'aaaaaaaa-3400-4000-8000-000000000003');
insert into public.player_extra_steam_ids(steam_id, player_id, added_at) values (pg_temp.s(2), 'dddddddd-3400-4000-8000-0000000000a1', '1999-01-01');
insert into public.vip_memberships(user_id, starts_at, source) values ('aaaaaaaa-3400-4000-8000-0000000000a1', '1999-12-01', 'import');
insert into public.matches(id, kind, status, map, score1, score2, played_at, demo_status, tickrate) values
  ('cccccccc-3400-4000-8000-000000000001', 'mix', 'finished', 'de_dust2', 16, 10, '2000-01-01 20:00+00', 'uploaded', 100);
update public.clip_config set per_match = 5, per_player = 2, vip_per_match = 3 where id = 1;

-- El VIP: 2 jugadas con el principal y 2 con el adicional (4 en total, entran 3). El normal: 1.
insert into public.match_clips(match_id, round, player_steamid, player_name, round_won, kill_ticks)
select 'cccccccc-3400-4000-8000-000000000001', r, pg_temp.s(n), 'J', true, array[r * 1000 + 1, r * 1000 + 2, r * 1000 + 3]
  from (values (1, 1), (2, 1), (3, 2), (4, 2), (5, 3)) v(r, n);

select pg_temp.ok((select count(*) filter (where vip) = 3 and count(*) filter (where not vip) = 1
                     from public.match_clip_list where match_id = 'cccccccc-3400-4000-8000-000000000001'),
  'el SteamID adicional cuenta para el VIP de la ficha, con el tope de 3 por ficha');
select pg_temp.ok((select bool_and(player_id = 'dddddddd-3400-4000-8000-0000000000a1') from public.match_clip_list
                    where match_id = 'cccccccc-3400-4000-8000-000000000001' and vip), 'los clips VIP son de la ficha');

-- Aviso clip_ready: al grabarse, salvo un reprocesado, que avisa al aprobarlo.
update public.match_clips set video_status = 'done', video_key = 'clips/' || match_id || '/' || id || '-abcd.mp4', video_bytes = 1000, video_seconds = 10, video_rendered_at = now()
 where match_id = 'cccccccc-3400-4000-8000-000000000001' and round = 5;
select pg_temp.ok((select count(*) = 1 from public.notifications where user_id = 'aaaaaaaa-3400-4000-8000-000000000003' and type = 'clip_ready'),
  'clip_ready al grabarse');
select public.clip_reprocess((select id from public.match_clips where match_id = 'cccccccc-3400-4000-8000-000000000001' and round = 5));
update public.match_clips set video_status = 'done', video_key = 'clips/' || match_id || '/' || id || '-efgh.mp4', video_bytes = 1000, video_seconds = 10, video_rendered_at = now()
 where match_id = 'cccccccc-3400-4000-8000-000000000001' and round = 5;
select pg_temp.ok((select count(*) = 1 from public.notifications where user_id = 'aaaaaaaa-3400-4000-8000-000000000003' and type = 'clip_ready'),
  'un reprocesado grabado no avisa todavía');
select public.clip_review_ok((select id from public.match_clips where match_id = 'cccccccc-3400-4000-8000-000000000001' and round = 5));
select pg_temp.ok((select count(*) = 2 from public.notifications where user_id = 'aaaaaaaa-3400-4000-8000-000000000003' and type = 'clip_ready'),
  'avisa al aprobarlo');

rollback;
