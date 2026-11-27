-- 155: la sala oculta mientras se acepta la partida (bitácora docs/bitacora/2026-11-27-mm-sala-oculta-al-aceptar, Daniel 2026-11-27).
--
-- Con la sala en `accepting` se veía quién te tocó (nick, foto, equipo…) y se podía rechazar según eso.
--   1. mm_lobby_hidden(sala, quien mira): en `accepting`, o cancelada antes del veto, para quien es de la sala.
--   2. mm_hidden_card(n, fila): la tarjeta anónima, con las mismas claves que mm_player_card y solo `accepted`.
--   3. mm_lobby_json: con la sala oculta, la tarjeta completa solo para quien mira; los demás anónimos y por player_id.
--   4. mm_trg_notify: lobby.accept sin el user_id de quien aceptó (la web no lo usaba).
-- Compatible con la API y la web ya desplegadas. Va sin una sala en `accepting`.
-- Inversa: docs/bitacora/2026-10-14-replanteo-modelo-datos/reversas/155_mm_sala_oculta_al_aceptar.sql.
begin;

do $$
begin
  if to_regprocedure('public.mm_lobby_hidden(mm_lobbies, uuid)') is not null then raise exception 'replanteo 155: ya se aplicó'; end if;
  if to_regprocedure('public.mm_player_card(uuid, uuid, mm_lobby_players)') is null then raise exception 'replanteo 155: falta mm_player_card (48)'; end if;
  if current_user not in ('postgres', 'supabase_admin') then raise exception 'replanteo 155: correr como postgres o supabase_admin'; end if;
end $$;
do $$ begin if current_user = 'supabase_admin' then execute 'set local role postgres'; end if; end $$;

create or replace function pg_temp.reemplazar(fn regprocedure, cambios text[][]) returns void language plpgsql as $$
declare d text := pg_get_functiondef(fn); i int; a text; b text;
begin
  for i in 1 .. array_length(cambios, 1) loop
    a := replace(cambios[i][1], E'\r', ''); b := replace(cambios[i][2], E'\r', '');
    if position(a in d) = 0 then
      raise exception 'replanteo 155: en % no se encontró: %', fn, left(a, 80);
    end if;
    d := replace(d, a, b);
  end loop;
  execute d;
end $$;

/** La sala no se muestra todavía: se está aceptando (o se canceló antes del veto) y quien mira es de la sala. */
create function public.mm_lobby_hidden(l mm_lobbies, p_viewer uuid) returns boolean
  language sql stable security definer set search_path = public as $$
  select (l.status = 'accepting' or (l.status = 'cancelled' and l.match_id is null))
     and exists (select 1 from mm_lobby_players lp where lp.lobby_id = l.id and lp.user_id = p_viewer)
$$;

/** Tarjeta de otro jugador con la sala oculta: las claves de mm_player_card, sin nada que diga quién es. */
create function public.mm_hidden_card(p_n bigint, p_lp mm_lobby_players) returns jsonb
  language sql stable set search_path = public as $$
  select jsonb_build_object(
    'player_id', 'oculto-' || p_n, 'nick', '', 'photo_url', null, 'elo', null, 'level', null,
    'vip', false, 'verified', false, 'is_me', false, 'linked', false, 'country', null,
    'team', null, 'party_id', null, 'is_captain', false,
    'accepted', (p_lp).accepted_at is not null, 'connected', false, 'left_until', null, 'abandoned', false,
    'replacement', false, 'replaced', false, 'anticheat', false, 'form', '[]'::jsonb, 'fav_map', null,
    'elo_trend', null, 'recent', null, 'meetings', jsonb_build_object('with', '[]'::jsonb, 'against', '[]'::jsonb))
$$;

revoke execute on function public.mm_lobby_hidden(mm_lobbies, uuid) from public, anon, authenticated;
revoke execute on function public.mm_hidden_card(bigint, mm_lobby_players) from public, anon, authenticated;

select pg_temp.reemplazar('public.mm_lobby_json(uuid, uuid)', array[[
  $a$    'players', (select jsonb_agg(mm_player_card(lp.player_id, p_viewer, lp) order by lp.team, lp.elo desc) from mm_lobby_players lp where lp.lobby_id = l.id),$a$,
  $b$    -- (replanteo 155) ini: mientras se acepta, quien mira no ve con quién le tocó (ni el orden por equipo).
    'players', case when mm_lobby_hidden(l, p_viewer) then
        (select jsonb_agg(case when (x.lp).user_id = p_viewer then mm_player_card((x.lp).player_id, p_viewer, x.lp)
                               else mm_hidden_card(x.n, x.lp) end order by x.n)
           from (select lp, row_number() over (order by lp.player_id) n from mm_lobby_players lp where lp.lobby_id = l.id) x)
      else (select jsonb_agg(mm_player_card(lp.player_id, p_viewer, lp) order by lp.team, lp.elo desc) from mm_lobby_players lp where lp.lobby_id = l.id) end,
    -- (replanteo 155) fin$b$]]);

select pg_temp.reemplazar('public.mm_trg_notify()', array[[
  $a$jsonb_build_object(
        'user_id', new.user_id,
        'accepted',$a$,
  $b$jsonb_build_object(  -- (replanteo 155) sin el user_id de quien aceptó
        'accepted',$b$]]);

notify pgrst, 'reload schema';
commit;
