-- Pruebas de supabase/migrations/20261028180000_clips_vip_reprocesar.sql, sobre la base de producción (también corren con
-- el replanteo aplicado). Todo con rollback.
begin;

create function pg_temp.ok(c boolean, msg text) returns void language plpgsql as $$
begin
  if not coalesce(c, false) then raise exception 'FALLA: %', msg; end if;
  raise notice 'OK: %', msg;
end $$;
create function pg_temp.como(u text) returns void language sql as $$
  select set_config('request.jwt.claims', format('{"sub":"%s","role":"authenticated"}', u), true) $$;
create function pg_temp.error(q text) returns text language plpgsql as $$
begin
  execute q;
  return null;
exception when others then return sqlerrm;
end $$;
create function pg_temp.s(n int) returns text language sql immutable as $$ select '7656119833' || lpad(n::text, 7, '0') $$;
grant execute on function pg_temp.ok(boolean, text), pg_temp.como(text), pg_temp.error(text), pg_temp.s(int) to authenticated, anon;

-- Mix del 2000-01-01 (el más viejo: el bot lo toma primero). Jugadores: N1 a N4 normales; V1 VIP desde antes del mix;
-- V2 VIP desde después del mix (no cuenta); V3 VIP en el mix, revocado después (cuenta).
insert into auth.users (id, email, raw_user_meta_data, encrypted_password) values
  ('aaaaaaaa-3300-4000-8000-0000000000ad', 'admin33@test.local', '{"tag":"Admin33"}', 'x'),
  ('aaaaaaaa-3300-4000-8000-000000000001', 'u1-33@test.local', '{"tag":"Uno33"}', 'x'),
  ('aaaaaaaa-3300-4000-8000-0000000000a1', 'v1-33@test.local', '{"tag":"Vip1x33"}', 'x'),
  ('aaaaaaaa-3300-4000-8000-0000000000a2', 'v2-33@test.local', '{"tag":"Vip2x33"}', 'x'),
  ('aaaaaaaa-3300-4000-8000-0000000000a3', 'v3-33@test.local', '{"tag":"Vip3x33"}', 'x');
update public.profiles set role = 'admin' where id = 'aaaaaaaa-3300-4000-8000-0000000000ad';
insert into public.players(nick, steam_id, user_id) values
  ('N1x33', pg_temp.s(1), null), ('N2x33', pg_temp.s(2), null), ('N3x33', pg_temp.s(3), null), ('N4x33', pg_temp.s(4), null),
  ('Vip1x33', pg_temp.s(11), 'aaaaaaaa-3300-4000-8000-0000000000a1'),
  ('Vip2x33', pg_temp.s(12), 'aaaaaaaa-3300-4000-8000-0000000000a2'),
  ('Vip3x33', pg_temp.s(13), 'aaaaaaaa-3300-4000-8000-0000000000a3');
insert into public.vip_memberships(user_id, starts_at, ends_at, source, revoked_at, revoke_reason) values
  ('aaaaaaaa-3300-4000-8000-0000000000a1', '1999-12-01', null, 'import', null, null),
  ('aaaaaaaa-3300-4000-8000-0000000000a2', '2000-02-01', null, 'import', null, null),
  ('aaaaaaaa-3300-4000-8000-0000000000a3', '1999-12-01', null, 'import', '2000-03-01', 'prueba');
insert into public.matches(id, kind, status, map, score1, score2, played_at, demo_status, tickrate) values
  ('cccccccc-3300-4000-8000-000000000001', 'mix', 'finished', 'de_dust2', 16, 10, '2000-01-01 20:00+00', 'uploaded', 100);
update public.clip_config set per_match = 5, per_player = 2, vip_per_match = 3 where id = 1;
insert into public.render_workers(name, token_hash) values ('Render 33', encode(sha256(convert_to('token-render-33', 'UTF8')), 'hex'));

-- Jugadas (r = ronda). 5 kills = ace (1), 4 = 4k (3), 3 = 3k (5).
create function pg_temp.clip(r int, n int, kills int) returns void language sql as $$
  insert into public.match_clips(match_id, round, player_steamid, player_name, round_won, kill_ticks)
  values ('cccccccc-3300-4000-8000-000000000001', r, pg_temp.s(n), 'J' || n, true,
          (select array_agg(r * 1000 + i) from generate_series(1, kills) i)) $$;
select pg_temp.clip(1, 1, 5), pg_temp.clip(2, 1, 4), pg_temp.clip(3, 1, 3),   -- N1: tope 2 por jugador → r1 y r2
       pg_temp.clip(4, 2, 3), pg_temp.clip(5, 2, 3),                          -- N2
       pg_temp.clip(6, 3, 3), pg_temp.clip(7, 4, 3),                          -- N3, N4
       pg_temp.clip(8, 11, 5), pg_temp.clip(9, 11, 3), pg_temp.clip(10, 11, 3), pg_temp.clip(11, 11, 3), -- V1: 4 jugadas
       pg_temp.clip(12, 12, 4),                                               -- V2 (no era VIP)
       pg_temp.clip(13, 13, 3);                                               -- V3 (VIP en el mix)
create function pg_temp.id(r int) returns uuid language sql as $$
  select id from public.match_clips where match_id = 'cccccccc-3300-4000-8000-000000000001' and round = r $$;
create function pg_temp.pos(r int) returns int language sql as $$
  select position from public.match_clip_list where id = pg_temp.id(r) $$;
grant execute on function pg_temp.id(int), pg_temp.pos(int) to authenticated, anon;

-- =====================================================================================================
-- 1. VIP en una fecha
-- =====================================================================================================
select pg_temp.ok(public.vip_at('aaaaaaaa-3300-4000-8000-0000000000a1', '2000-01-01'), 'vip_at: vigente en la fecha');
select pg_temp.ok(not public.vip_at('aaaaaaaa-3300-4000-8000-0000000000a2', '2000-01-01'), 'vip_at: empezó después');
select pg_temp.ok(public.vip_at('aaaaaaaa-3300-4000-8000-0000000000a3', '2000-01-01'), 'vip_at: revocado después cuenta');
select pg_temp.ok(not public.vip_at('aaaaaaaa-3300-4000-8000-0000000000a3', '2000-04-01'), 'vip_at: revocado antes no cuenta');
select pg_temp.ok(not public.vip_at(null, '2000-01-01'), 'vip_at: sin cuenta, no');

-- =====================================================================================================
-- 2. Lista
-- =====================================================================================================
-- Top (sin V1 ni V3): ace r1, 4k r12 (V2), 4k r2, 3k r7, 3k r6. VIP: ace r8, 3k r13, r11, r10. Afuera: r3 (tope), r4, r5, r9.
select pg_temp.ok((select array_agg(round order by position) from public.match_clip_list where match_id = 'cccccccc-3300-4000-8000-000000000001')
                  = array[1, 12, 2, 7, 6, 8, 13, 11, 10],
  'top de 5 sin los VIP y, después, las 3 mejores de cada VIP');
select pg_temp.ok((select bool_and(vip = (round in (8, 13, 11, 10))) from public.match_clip_list
                    where match_id = 'cccccccc-3300-4000-8000-000000000001'), 'vip marca las que entraron por ser de un VIP');
select pg_temp.ok(pg_temp.pos(9) is null, 'un VIP no pasa de 3');
select pg_temp.ok(pg_temp.pos(12) = 2, 'quien se hizo VIP después del mix compite en el top');
select pg_temp.ok(pg_temp.pos(13) = 7, 'quien era VIP en el mix y después lo perdió sigue con sus clips VIP');
update public.match_clips set video_forced = true where id = pg_temp.id(4);
select pg_temp.ok(pg_temp.pos(4) = 10, 'una forzada va después de los VIP');
update public.clip_config set vip_per_match = 0 where id = 1;
select pg_temp.ok((select count(*) = 6 and bool_and(not vip) from public.match_clip_list where match_id = 'cccccccc-3300-4000-8000-000000000001'),
  'con vip_per_match = 0, solo el top y la forzada (los VIP tampoco entran en el top)');
update public.clip_config set vip_per_match = 3 where id = 1;
set local role anon;
select pg_temp.ok((select count(*) = 10 from public.match_clip_list where match_id = 'cccccccc-3300-4000-8000-000000000001'),
  'la lista se ve sin sesión');
reset role;

-- =====================================================================================================
-- 3. Configuración
-- =====================================================================================================
set local role authenticated;
select pg_temp.como('aaaaaaaa-3300-4000-8000-0000000000ad');
select public.clip_set_config((select priorities from public.clip_config), 2, 5, 8, 3, 2);
select pg_temp.ok((select vip_per_match = 3 from public.clip_config), 'clip_set_config sin p_vip_per_match no lo cambia');
select public.clip_set_config((select priorities from public.clip_config), 2, 5, 8, 3, 2, 4);
select pg_temp.ok((select vip_per_match = 4 from public.clip_config), 'clip_set_config cambia vip_per_match');
select pg_temp.ok(pg_temp.error($q$select public.clip_set_config((select priorities from public.clip_config), 2, 5, 8, 3, 2, 11)$q$)
                  = 'Los clips por VIP tienen que estar entre 0 y 10', 'vip_per_match fuera de rango');
select public.clip_set_config((select priorities from public.clip_config), 2, 5, 8, 3, 2, 3);
reset role;

-- =====================================================================================================
-- 4. Reprocesar
-- =====================================================================================================
-- Todas las de la lista grabadas.
update public.match_clips c set video_status = 'done', video_key = 'clips/' || c.match_id || '/' || c.id || '-abcd.mp4',
       video_bytes = 1000, video_seconds = 10, video_drive_id = 'drive' || c.round || 'xxxxxxx', video_rendered_at = now()
 where c.id in (select id from public.match_clip_list where match_id = 'cccccccc-3300-4000-8000-000000000001');
update public.match_clips set discord_posted_at = now(), discord_message_id = '123456' where id = pg_temp.id(1);

set local role authenticated;
select pg_temp.como('aaaaaaaa-3300-4000-8000-000000000001');
select pg_temp.ok(pg_temp.error($q$select public.clip_reprocess(pg_temp.id(1))$q$) = 'Solo un admin puede reprocesar un clip', 'un usuario no reprocesa');
select pg_temp.ok(pg_temp.error($q$select public.clip_review_ok(pg_temp.id(1))$q$) = 'Solo un admin puede aprobar un clip', 'un usuario no aprueba');
select pg_temp.como('aaaaaaaa-3300-4000-8000-0000000000ad');
select pg_temp.ok(pg_temp.error($q$select public.clip_reprocess(pg_temp.id(3))$q$) = 'Esa jugada no está entre los clips del mix', 'solo una de la lista');
select pg_temp.ok(pg_temp.error($q$select public.clip_reprocess(gen_random_uuid())$q$) = 'Esa jugada no existe', 'una que no existe');
select pg_temp.ok(pg_temp.error($q$select public.clip_review_ok(pg_temp.id(2))$q$) = 'Esa jugada no espera revisión', 'aprobar una sin reprocesar');
select pg_temp.ok(public.clip_reprocess(pg_temp.id(1)) = 'pending', 'reprocesar devuelve pending');
reset role;
select pg_temp.ok((select video_status is null and video_key is null and video_drive_id is null and video_attempts = 0
                          and video_review = 'pending' and video_reprocess_count = 1 and discord_posted_at is null
                     from public.match_clips where id = pg_temp.id(1)), 'vuelve a la cola, espera revisión y se vuelve a publicar');
select pg_temp.ok(exists (select 1 from public.clip_video_trash where video_drive_id = 'drive1xxxxxxx' and video_key like '%-abcd.mp4'),
  'el video viejo va a la papelera');
select pg_temp.ok(pg_temp.pos(1) = 1 and (select review = 'pending' from public.match_clip_list where id = pg_temp.id(1)),
  'sigue en su puesto, con review pending');
set local role authenticated;
select pg_temp.ok(pg_temp.error($q$select public.clip_reprocess(pg_temp.id(1))$q$) = 'Esa jugada todavía no se grabó: ya está en la cola',
  'no se reprocesa lo que está en la cola');
select pg_temp.ok(pg_temp.error($q$select public.clip_review_ok(pg_temp.id(1))$q$) = 'El video nuevo todavía no está listo', 'aprobar sin video');
reset role;

-- Discord: el reprocesado no sale ni frena al resto; los VIP (puestos 6 a 9) sí salen.
select pg_temp.ok((select count(*) = 9 and bool_and((x->>'clip_id')::uuid <> pg_temp.id(1))
                          and count(*) filter (where (x->>'vip')::boolean) = 4
                     from jsonb_array_elements(public.clip_discord_pending('token-render-33', 5, 50)) x
                    where x->>'match_id' = 'cccccccc-3300-4000-8000-000000000001'),
  'Discord: el top sin el reprocesado, los 4 VIP y la forzada');

-- El bot lo toma con review y reprocess, y lo graba.
select pg_temp.ok((select c->>'review' = 'pending' and (c->>'reprocess')::int = 1 and jsonb_array_length(j->'clips') = 1
                     from (select public.clip_render_claim('token-render-33') j) t, jsonb_array_elements(j->'clips') c),
  'el claim trae solo el reprocesado, con review y reprocess');
select pg_temp.ok(public.clip_render_done('token-render-33', pg_temp.id(1),
                    'clips/cccccccc-3300-4000-8000-000000000001/' || pg_temp.id(1) || '-efgh.mp4', 2000, 11, 'drivenuevo1234'),
  'el bot lo termina');
select pg_temp.ok(not exists (select 1 from jsonb_array_elements(public.clip_discord_pending('token-render-33', 5, 50)) x
                               where (x->>'clip_id')::uuid = pg_temp.id(1)), 'grabado pero sin aprobar: no sale en Discord');
set local role authenticated;
select pg_temp.ok(public.clip_review_ok(pg_temp.id(1)), 'el admin lo aprueba');
reset role;
select pg_temp.ok((select video_review = 'approved' and video_reviewed_by = 'aaaaaaaa-3300-4000-8000-0000000000ad'
                     from public.match_clips where id = pg_temp.id(1)), 'queda aprobado, con quién');
select pg_temp.ok(exists (select 1 from jsonb_array_elements(public.clip_discord_pending('token-render-33', 5, 50)) x
                           where (x->>'clip_id')::uuid = pg_temp.id(1)), 'aprobado: sale en Discord otra vez');
select pg_temp.ok(public.clip_discord_mark('token-render-33', pg_temp.id(1), '7654321'), 'se publica de nuevo');

-- Otros ticks (un reenvío después de un !rr): vuelve a la cola sin revisión.
update public.match_clips set kill_ticks = array[1001, 1002, 1003, 1004, 1006] where id = pg_temp.id(1);
select pg_temp.ok((select video_status is null and video_review is null and video_reviewed_at is null
                     from public.match_clips where id = pg_temp.id(1)), 'con otros ticks, sin revisión pendiente');

-- Grabándose y demo vencida.
update public.match_clips set video_status = 'processing' where id = pg_temp.id(2);
set local role authenticated;
select pg_temp.ok(pg_temp.error($q$select public.clip_reprocess(pg_temp.id(2))$q$) = 'Esa jugada se está grabando ahora: espera a que termine',
  'no se reprocesa mientras se graba');
reset role;
update public.matches set demo_status = 'expired' where id = 'cccccccc-3300-4000-8000-000000000001';
set local role authenticated;
select pg_temp.ok(pg_temp.error($q$select public.clip_reprocess(pg_temp.id(7))$q$) = 'La demo de ese mix ya no está: no se puede volver a grabar',
  'sin demo no se reprocesa');
reset role;

rollback;
