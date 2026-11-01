-- Devuelve a la cola los 5 clips del mix de dust2_ob de GO TO KNOW contra New™ (flow-20261029T234042-496d,
-- partida 26a5034f-aa3b-47e3-95ee-67998891ad90) que fallaron con "no apareció 'CML_PASO_14' en el log en 60 s".
-- Correr solo con el render nuevo ya en el portátil (git pull), y con la confirmación de Daniel.
update match_clips
   set video_status = null, video_claimed_at = null, video_attempts = 0, video_error = null
 where match_id = '26a5034f-aa3b-47e3-95ee-67998891ad90'
   and video_status = 'failed'
returning round, player_name, video_status, video_attempts;
