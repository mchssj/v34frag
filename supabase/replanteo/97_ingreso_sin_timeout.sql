-- 97: el resultado de un mix no se corta por tiempo (bitácora docs/bitacora/2026-11-09-ingreso-sin-timeout/).
--
-- El 2026-11-09 el resultado de la sala cb04b97c (#2, de_mirage_rc1, 8-16) no entró: la última parte de
-- ingest_server_chunk (crear el mix, vincularlo a la sala, ELO, medallas y clips) pasaba de los 3 s del rol
-- anon y la base la cortaba con 57014 en cada reintento.
--
-- 1. ingest_server_chunk con su propio statement_timeout de 30 s. PostgREST (v12.1 en adelante; el VPS
--    tiene la v14) lo aplica a la transacción antes de llamar a la función. El resto de anon sigue en 3 s.
-- 2. Las medallas salen del envío: los triggers de medal_queue solo anotan a los jugadores en la cola y
--    las evalúa el cron del VPS (cmleague-medals.timer, cada 5 minutos). Antes, medal_evaluate_now corría
--    en cada insert y en cada update de match_player_stats (elo_apply_match actualiza fila por fila) y su
--    "exception when others" no atrapa la cancelación por tiempo, así que unas medallas lentas tumbaban
--    el resultado entero.

begin;

alter function public.ingest_server_chunk(text, text, integer, integer, text) set statement_timeout = '30s';

create or replace function public.tg_medal_queue_stats() returns trigger
  language plpgsql security definer set search_path = public as $$
begin
  -- (replanteo 97) solo la cola: las evalúa el cron (medals:tick).
  perform medal_enqueue(array(select player_id from nuevas));
  return null;
end $$;

create or replace function public.tg_medal_queue_match() returns trigger
  language plpgsql security definer set search_path = public as $$
begin
  if new.status = 'finished' and old.status is distinct from 'finished' then
    -- (replanteo 97) solo la cola: las evalúa el cron (medals:tick).
    perform medal_enqueue(array(select distinct player_id from match_player_stats where match_id = new.id and player_id is not null));
  end if;
  return null;
end $$;

commit;
