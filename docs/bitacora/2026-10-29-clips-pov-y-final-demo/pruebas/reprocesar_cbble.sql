-- Reprocesar los dos 3k de "New™ always" en de_cbble (mix flow-20261029T201550-b630, 2026-10-29).
-- Correr en el SQL Editor de PRODUCCIÓN, recién cuando el portátil tenga el render/ corregido
-- (si no, se vuelven a grabar con el mismo error).

-- 0. Cómo están ahora (tienen que estar en 'done').
select l.id, l.type, l.round, l.player_name, l.video_status, c.video_review, c.video_reprocess_count
  from match_clip_list l join match_clips c on c.id = l.id
 where l.id in ('6781a006-0547-470a-9f4a-3cb48b38ddce', '1b273a32-eb34-4bc7-9638-9c630de89114');

-- 1. Mandarlos a grabar de nuevo (el video viejo va a la papelera de R2 y Drive).
select clip_reprocess('6781a006-0547-470a-9f4a-3cb48b38ddce');  -- ronda 18
select clip_reprocess('1b273a32-eb34-4bc7-9638-9c630de89114');  -- ronda 29, la última

-- 2. Ver la cola: cuando video_status = 'done', el video nuevo está en Drive con " (reproceso 1)".
select l.id, l.round, l.video_status, c.video_error, c.video_reprocess_count
  from match_clips c join match_clip_list l on l.id = c.id
 where c.id in ('6781a006-0547-470a-9f4a-3cb48b38ddce', '1b273a32-eb34-4bc7-9638-9c630de89114');

-- 3. Revisar los videos. Si quedaron bien, aprobarlos (salen en Discord en la próxima corrida del bot):
-- select clip_review_ok('6781a006-0547-470a-9f4a-3cb48b38ddce');
-- select clip_review_ok('1b273a32-eb34-4bc7-9638-9c630de89114');
-- Si quedaron mal: otra vez el paso 1.
