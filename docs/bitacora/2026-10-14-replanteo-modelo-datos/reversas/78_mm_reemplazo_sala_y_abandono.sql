-- Inversa del replanteo 78 (la sala en el link de reemplazo, el detalle como sala y el ELO del abandono).
-- Deja las funciones como las dejó la 75 y saca las columnas nuevas (se pierden las rondas de los reemplazos y los topes).
begin;

create or replace function pg_temp.reemplazar(fn regprocedure, cambios text[][]) returns void language plpgsql as $$
declare d text := pg_get_functiondef(fn); i int;
begin
  for i in 1 .. array_length(cambios, 1) loop
    if position(cambios[i][1] in d) = 0 then
      raise exception 'inversa 78: en % no se encontró: %', fn, left(cambios[i][1], 80);
    end if;
    d := replace(d, cambios[i][1], cambios[i][2]);
  end loop;
  execute d;
end $$;

select pg_temp.reemplazar('public.manual_valores()', array[
  [E'\n    ''mm.abandono_ganado_min'', m.abandon_win_min, ''mm.abandono_ganado_max'', m.abandon_win_max,\n'
   || E'    ''mm.abandono_perdido_min'', m.abandon_loss_min, ''mm.abandono_perdido_max'', m.abandon_loss_max,', '']
]);

select pg_temp.reemplazar('public.mm_set_config(jsonb)', array[
  [E'\n    abandon_win_min = coalesce((p->>''abandon_win_min'')::int, abandon_win_min),\n'
   || E'    abandon_win_max = coalesce((p->>''abandon_win_max'')::int, abandon_win_max),\n'
   || E'    abandon_loss_min = coalesce((p->>''abandon_loss_min'')::int, abandon_loss_min),\n'
   || E'    abandon_loss_max = coalesce((p->>''abandon_loss_max'')::int, abandon_loss_max),', '']
]);

drop function public.mm_game_room(uuid);

select pg_temp.reemplazar('public.mm_replace_info(text)', array[
  [E'    ''reason'', case when v_status = ''open'' then mm_replace_reason(me, x.lobby_id) end,\n'
   || E'    -- (replanteo 78) La sala en vista previa, sin el servidor (la IP y la contraseña, recién al tomarlo) ni lo de quien mira.\n'
   || E'    ''replaced_player_id'', (select id from players where user_id = x.replaced_user_id),\n'
   || E'    ''replaced_nick'', (select nick from players where user_id = x.replaced_user_id),\n'
   || E'    ''left_round'', x.left_round,\n'
   || E'    ''room'', case when v_status = ''open'' then mm_lobby_json(x.lobby_id, me) - ''server'' - ''reported'' - ''commended'' - ''elo_stake'' end);',
   '    ''reason'', case when v_status = ''open'' then mm_replace_reason(me, x.lobby_id) end);']
]);

select pg_temp.reemplazar('public.mm_lobby_json(uuid,uuid)', array[
  [E'    ''replacements'', mm_lobby_replacements(l.id),   -- (replanteo 78)\n', '']
]);
drop function public.mm_lobby_replacements(uuid);

select pg_temp.reemplazar('public.mm_replace_arrived(uuid,uuid)', array[
  [', joined_round = mm_replace_round(p_lobby)', '']
]);
select pg_temp.reemplazar('public.mm_replace_open(uuid,smallint,uuid,text)', array[
  [E'  update mm_replacements set left_round = mm_replace_round(p_lobby) where id = v_id;   -- (replanteo 78)\n', '']
]);
drop function public.mm_replace_round(uuid);
alter table public.mm_replacements drop column left_round, drop column joined_round;

select pg_temp.reemplazar('public.mm_elo_delta(uuid,text,integer,double precision,double precision,integer)', array[
  [E'    -- (replanteo 78) Pierde poco: la sanción fuerte es la espera. Ganó su equipo: de abandon_win_min a _max. Perdió o\n'
   || E'    -- empató: de abandon_loss_min a _max, pero nunca menos que una derrota normal. f: la parte de la partida que no jugó.\n'
   || E'    select greatest(coalesce(g.score1, 0) + coalesce(g.score2, 0), coalesce(max(rounds), 0)) into v_total\n'
   || E'      from match_player_stats where match_id = p_game and team in (1, 2);\n'
   || E'    select coalesce(max(s.rounds), 0) into v_rounds from match_player_stats s where s.match_id = p_game and elo_key(s.steam_id) = p_key;\n'
   || E'    f := coalesce(least(greatest((v_total - v_rounds) / nullif(v_total, 0), 0), 1), 1);\n'
   || E'    if p_res = 1 then\n'
   || E'      return -(c.abandon_win_min + round((c.abandon_win_max - c.abandon_win_min) * f))::int;\n'
   || E'    end if;\n'
   || E'    return least(round(2 * coalesce((select base from elo_config where id = 1), 30) * (0 - p_prob))::int,\n'
   || E'                 -(c.abandon_loss_min + round((c.abandon_loss_max - c.abandon_loss_min) * f))::int, -1);\n',
   E'    -- Derrota completa, sin ajuste por participación ni bonus, más el fijo.\n'
   || E'    return least(round(2 * coalesce((select base from elo_config where id = 1), 30) * (0 - p_prob))::int - c.abandon_extra_elo, -1);\n']
]);

comment on column public.mm_config.abandon_extra_elo is null;
alter table public.mm_config drop constraint mm_config_abandon_ranges,
  drop column abandon_win_min, drop column abandon_win_max, drop column abandon_loss_min, drop column abandon_loss_max;

notify pgrst, 'reload schema';

commit;
