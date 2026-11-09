-- Inversa de la 97: vuelve el límite de anon para ingest_server_chunk y la evaluación de medallas en el momento.

begin;

alter function public.ingest_server_chunk(text, text, integer, integer, text) reset statement_timeout;

create or replace function public.tg_medal_queue_stats() returns trigger
  language plpgsql security definer set search_path = public as $$
begin
  perform medal_enqueue(array(select player_id from nuevas));
  perform medal_evaluate_now(array(select distinct n.player_id from nuevas n
                                     join matches m on m.id = n.match_id and m.status = 'finished'
                                    where n.player_id is not null));
  return null;
end $$;

create or replace function public.tg_medal_queue_match() returns trigger
  language plpgsql security definer set search_path = public as $$
declare v_players uuid[];
begin
  if new.status = 'finished' and old.status is distinct from 'finished' then
    v_players := array(select distinct player_id from match_player_stats where match_id = new.id and player_id is not null);
    perform medal_enqueue(v_players);
    perform medal_evaluate_now(v_players);
  end if;
  return null;
end $$;

commit;
