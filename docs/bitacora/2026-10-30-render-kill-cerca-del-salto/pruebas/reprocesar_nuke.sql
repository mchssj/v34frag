-- Devuelve a la cola los 6 clips de nuke_old_blue_ep (flow-20261029T210433-5ce4, partida
-- f511d386-46a7-4b28-803f-cfddc954d501) que quedaron failed con "la demo pasó de largo el tick 70272 (3 veces)".
-- Correr solo con el render nuevo ya en el portátil (git pull), y con la confirmación de Daniel.
update match_clips
   set video_status = null, video_claimed_at = null, video_attempts = 0, video_error = null
 where match_id = 'f511d386-46a7-4b28-803f-cfddc954d501'
   and video_status = 'failed'
returning round, player_name, video_status, video_attempts;
