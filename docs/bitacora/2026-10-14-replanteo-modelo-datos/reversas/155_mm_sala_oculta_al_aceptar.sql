-- Inversa del replanteo 155: mm_lobby_json vuelve a mandar la sala completa en `accepting` y lobby.accept el user_id.
begin;

do $$ begin if current_user = 'supabase_admin' then execute 'set local role postgres'; end if; end $$;

create or replace function pg_temp.reemplazar(fn regprocedure, cambios text[][]) returns void language plpgsql as $$
declare d text := pg_get_functiondef(fn); i int; a text; b text;
begin
  for i in 1 .. array_length(cambios, 1) loop
    a := replace(cambios[i][1], E'\r', ''); b := replace(cambios[i][2], E'\r', '');
    if position(a in d) = 0 then
      raise exception 'inversa 155: en % no se encontró: %', fn, left(a, 80);
    end if;
    d := replace(d, a, b);
  end loop;
  execute d;
end $$;

select pg_temp.reemplazar('public.mm_lobby_json(uuid, uuid)', array[[
  $a$    -- (replanteo 155) ini: mientras se acepta, quien mira no ve con quién le tocó (ni el orden por equipo).
    'players', case when mm_lobby_hidden(l, p_viewer) then
        (select jsonb_agg(case when (x.lp).user_id = p_viewer then mm_player_card((x.lp).player_id, p_viewer, x.lp)
                               else mm_hidden_card(x.n, x.lp) end order by x.n)
           from (select lp, row_number() over (order by lp.player_id) n from mm_lobby_players lp where lp.lobby_id = l.id) x)
      else (select jsonb_agg(mm_player_card(lp.player_id, p_viewer, lp) order by lp.team, lp.elo desc) from mm_lobby_players lp where lp.lobby_id = l.id) end,
    -- (replanteo 155) fin$a$,
  $b$    'players', (select jsonb_agg(mm_player_card(lp.player_id, p_viewer, lp) order by lp.team, lp.elo desc) from mm_lobby_players lp where lp.lobby_id = l.id),$b$]]);

select pg_temp.reemplazar('public.mm_trg_notify()', array[[
  $a$jsonb_build_object(  -- (replanteo 155) sin el user_id de quien aceptó
        'accepted',$a$,
  $b$jsonb_build_object(
        'user_id', new.user_id,
        'accepted',$b$]]);

drop function public.mm_hidden_card(bigint, mm_lobby_players);
drop function public.mm_lobby_hidden(mm_lobbies, uuid);

notify pgrst, 'reload schema';
commit;
