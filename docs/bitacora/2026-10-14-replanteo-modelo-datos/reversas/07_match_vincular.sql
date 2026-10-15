-- Inversa de supabase/replanteo/07_match_vincular.sql.
-- Saca la vinculación con !match y las reglas de inscripción: los juegos vinculados quedan como mixes
-- comunes (sin parent) y las partidas oficiales conservan el resultado que ya tenían cargado.
begin;

create function pg_temp.reemplazar(fn regprocedure, cambios text[][]) returns void language plpgsql as $f$
declare d text := pg_get_functiondef(fn); i int;
begin
  for i in 1 .. array_length(cambios, 1) loop
    if position(cambios[i][1] in d) = 0 then
      raise exception 'inversa 07: en % no se encontró: %', fn, left(cambios[i][1], 80);
    end if;
    d := replace(d, cambios[i][1], cambios[i][2]);
  end loop;
  execute d;
end $f$;

select pg_temp.reemplazar('public.csstv_ingest(uuid, jsonb)', array[
  [E'  -- Las stats de cada jugador salen de la vista player_stats (replanteo 06): no hay nada que recalcular.\n  -- (replanteo 07) !match: si el plugin mandó un código, el juego se vincula a esa partida de torneo o PCW.\n  if v_status = ''finished'' and nullif(trim(p->>''link_code''), '''') is not null then\n    perform csstv_link_game(v_id, p->>''link_code'', case when p->>''link_side_a'' in (''1'', ''2'') then (p->>''link_side_a'')::int end);\n  end if;\n',
   E'  -- Las stats de cada jugador salen de la vista player_stats (replanteo 06): no hay nada que recalcular.\n']
]);

select pg_temp.reemplazar('public.pcw_make_side(text, uuid[], text[])', array[
  [E'if n < 1 or n > 7 then raise exception ''El roster tiene que tener entre 1 y 7 jugadores''; end if;\n  -- (replanteo 07) mínimo de jugadores con cuenta para una PCW\n  if coalesce(array_length(p_players, 1), 0) < 4 then raise exception ''El roster tiene que tener al menos 4 jugadores con cuenta en la web''; end if;',
   'if n < 1 or n > 7 then raise exception ''El roster tiene que tener entre 1 y 7 jugadores''; end if;']
]);

drop trigger tournament_registrations_plantel on public.tournament_registrations;
drop function public.tournament_registrations_plantel();
drop function public.csstv_link_game(uuid, text, int);
drop function public.csstv_match_lookup(text, text);
drop function public.csstv_steam2(text);
drop trigger matches_link_code on public.matches;
drop function public.matches_link_code();
drop function public.csstv_new_link_code();
drop index public.matches_parent;
drop index public.matches_link_code;
alter table public.matches drop constraint matches_juego_vinculado;
alter table public.matches drop constraint matches_link_code_formato;
alter table public.matches drop column parent_side1, drop column parent_match_id, drop column link_code;

commit;
