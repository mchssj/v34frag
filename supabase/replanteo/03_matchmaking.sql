-- Replanteo 03: borra el matchmaking viejo (decisión de Daniel, 2026-10-15).
-- Era inestable y se va a rehacer desde cero con su propio plan. Sus funciones usan teams.members y crean
-- equipos 'mix', que el replanteo elimina: si se dejaran, quedarían rotas. Los datos quedan en el respaldo
-- previo al corte. game_servers.connect_address y panel_server_id se quedan (el Worker de demos usa
-- panel_server_id).
-- NO aplicar en producción antes del corte (ver README.md).
begin;

do $$
begin
  if to_regclass('public.matchmaking_queue') is null then
    raise exception 'replanteo 03: matchmaking_queue ya no existe (¿ya se aplicó?)';
  end if;
  -- No cortar una partida de matchmaking en curso.
  if exists (select 1 from public.matchmaking_dispatch where dispatch_state in ('assigned', 'live'))
     or exists (select 1 from public.matchmaking_queue where status = 'waiting') then
    raise exception 'replanteo 03: hay matchmaking activo (cola en espera o envío asignado/en vivo)';
  end if;
end $$;

drop function public.matchmaking_admin_release_server(uuid);
drop function public.matchmaking_cancel();
drop function public.matchmaking_join(text);
drop function public.matchmaking_queue_state();
drop function public.matchmaking_server_mark_live(text, uuid);
drop function public.matchmaking_server_poll(text);
drop function public.matchmaking_set_mode(text, boolean);
drop function public.matchmaking_set_queue_open(boolean);
drop function public.matchmaking_status();
drop function public.matchmaking_try_match();
drop function public.matchmaking_try_match_unchecked();

drop table public.matchmaking_dispatch;
drop table public.matchmaking_queue;
drop table public.matchmaking_modes;
drop table public.matchmaking_settings;

alter table public.game_servers drop column matchmaking_enabled;
alter table public.game_servers drop column last_assigned_at;
alter table public.matches drop column matchmaking_mode;   -- arrastra matches_matchmaking_mode_check

commit;
