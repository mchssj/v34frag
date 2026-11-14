-- Devuelve a la cola los 5 clips que quedaron "skipped" por la cámara (bitácora 2026-11-13-render-clutch-perdido-y-ancla-muerta):
--   - "New™ tam": el 3k de la ronda 18 (mirage_rc1, srv1-20261112T175117-f517) y el clutch 1v1 de la ronda 26
--     (dust2_ob, srv1-20261113T211038-37da). Ya los había reprocesado Daniel: siguen con review = 'pending' y salen
--     en Discord cuando él los apruebe.
--   - "lephyxzz漏斗": el 4k de la ronda 26 del mismo dust2_ob, y el clutch_2 y el clutch_3 de srv3-20261112T164548-42dd.
--     Nunca salieron en Discord: vuelven sin revisión, como cualquier clip nuevo.
-- Correr solo con el render nuevo ya en el portátil (git pull), y con la confirmación de Daniel (sudo sb psql en el VPS).
update match_clips
   set video_status = null, video_claimed_at = null, video_attempts = 0, video_error = null
 where id in ('beb6e58d-ff45-49fc-8973-2ce0796a3aa4', 'c3ec6102-db25-480a-9be5-38ffbdf37160',
              '9a26c6a1-821b-4847-b649-2116fca47001', 'a59dbcee-84eb-47c3-a314-4c51d54bdf72',
              'b10f6b10-3d12-4506-9db9-f258a714ba1a')
   and video_status = 'skipped'
   and video_error like 'Cámara: %'
returning id, round, player_name, video_status, video_review;
