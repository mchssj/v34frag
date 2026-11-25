-- Inversa del replanteo 145: mm_left_last_round y mm_elo_delta vuelven a como estaban (77 y 78).
begin;

create or replace function pg_temp.reemplazar(fn regprocedure, cambios text[][]) returns void language plpgsql as $$
declare d text := pg_get_functiondef(fn); i int;
begin
  for i in 1 .. array_length(cambios, 1) loop
    if position(cambios[i][1] in d) = 0 then
      raise exception 'inversa 145: en % no se encontró: %', fn, left(cambios[i][1], 80);
    end if;
    d := replace(d, cambios[i][1], cambios[i][2]);
  end loop;
  execute d;
end $$;

select pg_temp.reemplazar('public.mm_elo_delta(uuid,text,integer,double precision,double precision,integer)', array[
  [E'  f numeric;\n'
   || E'  v_new boolean;        -- (replanteo 145) la partida es de abandon_rules_from o después\n'
   || E'  v_prev int := 0;      -- (replanteo 145) rondas de antes de que entrara el reemplazo que abandona\n',
   E'  f numeric;\n'],
  [E'  v_new := coalesce(g.played_at, g.starts_at) >= c.abandon_rules_from;\n', E''],
  [E'    -- (replanteo 145) sin las rondas de antes de que entrara, y con el resultado real: a quien abandona le pasan p_res = 0\n'
   || E'    if v_new then\n'
   || E'      select coalesce(max(mm_rounds_before(p_game, lp.player_id)), 0) into v_prev\n'
   || E'        from mm_lobby_players lp join players p on p.id = lp.player_id\n'
   || E'       where lp.lobby_id = v_lobby and lp.abandoned and elo_key(p.steam_id) = p_key;\n'
   || E'    end if;\n'
   || E'    f := coalesce(least(greatest((v_total - v_prev - v_rounds) / nullif(v_total, 0), 0), 1), 1);\n'
   || E'    if p_res = 1 or (v_new and g.winner_side = p_team) then\n',
   E'    f := coalesce(least(greatest((v_total - v_rounds) / nullif(v_total, 0), 0), 1), 1);\n'
   || E'    if p_res = 1 then\n'],
  [E'  select coalesce(max(s.rounds), 0), case when v_new then coalesce(max(mm_rounds_before(p_game, lp.player_id)), 0) else 0 end into v_rounds, v_prev\n',
   E'  select coalesce(max(s.rounds), 0) into v_rounds\n'],
  [E'  f := least(greatest((v_total - v_prev - v_rounds) / nullif(v_total, 0), 0), 1) * c.abandon_adjust_pct / 100;\n',
   E'  f := least(greatest((v_total - v_rounds) / nullif(v_total, 0), 0), 1) * c.abandon_adjust_pct / 100;\n']
]);

create or replace function public.mm_left_last_round(p_game uuid, p_player uuid) returns boolean
  language sql stable security definer set search_path = public as $$
  select coalesce((select max(s.rounds) from match_player_stats s where s.match_id = g.id and s.player_id = p_player), -1)
         >= greatest(coalesce(g.score1, 0) + coalesce(g.score2, 0),
                     (select coalesce(max(x.rounds), 0) from match_player_stats x where x.match_id = g.id and x.team in (1, 2))) - 1
    from matches g
   where g.id = p_game $$;

drop function public.mm_rounds_before(uuid, uuid);
alter table public.mm_config drop column abandon_rules_from;

commit;
