-- Inversa de supabase/replanteo/19_listado_servidor.sql: deja match_list como estaba después de la 17.
-- create or replace no puede quitar columnas: se borra y se vuelve a crear (no hay vistas que dependan de ella).
begin;

do $$
begin
  if not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'match_list' and column_name = 'server_id') then
    raise exception 'inversa 19: match_list no tiene server_id (¿no se aplicó la 19?)';
  end if;
end $$;

drop view public.match_list;
create view public.match_list with (security_invoker = true) as
select m.id, m.kind, m.status, m.event_id, e.name as event_name, m.stage, m.phase, m.grp, m.round, m.pos, m.bye,
       m.best_of, m.map, m.starts_at, m.played_at, coalesce(m.played_at, m.starts_at) as at, m.score1, m.score2, m.winner_side, m.side1_name, m.side2_name,
       m.team1 as team1_id, t1.name as team1_name, t1.tag as team1_tag,
       m.team2 as team2_id, t2.name as team2_name, t2.tag as team2_tag,
       m.end_reason, m.demo_status, m.parent_match_id,
       max(m.round) over (partition by m.event_id, m.stage, m.phase) as last_round,
       case m.stage when 'swiss' then 0 when 'group' then 0 when 'group_upper' then 0 when 'group_lower' then 0
                    when 'upper' then 1 when 'ko' then 1 when 'lower' then 2
                    when 'third' then 3 when 'grand' then 4 end as stage_order,
       search_norm(concat_ws(' ', t1.name, t1.tag, t2.name, t2.tag, m.side1_name, m.side2_name, e.name)) as search,
       array(select distinct s.player_id from match_player_stats s
              where s.player_id is not null
                and (s.match_id = m.id or s.match_id in (select c.id from matches c where c.parent_match_id = m.id))) as player_ids,
       m.cancel_reason,
       case when mc.match_id is null then null when mc.decision is null then 'pending' else mc.decision end as review,
       mc.max_rounds as review_max_rounds
  from matches m
  left join teams t1 on t1.id = m.team1
  left join teams t2 on t2.id = m.team2
  left join events e on e.id = m.event_id
  left join match_crashes mc on mc.match_id = m.id;

commit;
