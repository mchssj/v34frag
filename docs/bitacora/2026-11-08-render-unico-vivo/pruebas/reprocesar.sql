-- Devuelve a la cola los clips que fallaron con "no hay ningún jugador vivo con nombre escribible para llegar a ...":
--   - mirage_rc1 del #1 (srv1-20261107T215859-3025, partida 6ff0f34f-ef00-4dc3-a4a1-f6f885a81aec): 10 clips.
--   - mirage_rc1 de flow (flow-20261107T002859-44a2, partida a7493de9-6988-47d2-9e98-f8e394a49746): 5 clips. El 3k de
--     "New™ Malapraxis" (ronda 17) va a volver a fallar, solo y sin reintentos: los 5 vivos tienen nombres no escribibles.
-- Correr solo con el render nuevo ya en el portátil (git pull), y con la confirmación de Daniel.
update match_clips
   set video_status = null, video_claimed_at = null, video_attempts = 0, video_error = null
 where match_id in ('6ff0f34f-ef00-4dc3-a4a1-f6f885a81aec', 'a7493de9-6988-47d2-9e98-f8e394a49746')
   and video_status = 'failed'
   and video_error like 'Sesión del juego: no hay ningún jugador vivo con nombre escribible%'
returning match_id, round, player_name, video_status, video_attempts;
