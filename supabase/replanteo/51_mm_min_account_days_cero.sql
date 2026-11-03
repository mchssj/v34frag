-- Replanteo 51: matchmaking sin antigüedad mínima de la cuenta (bitácora docs/bitacora/2026-11-02-mm-claim-en-sala).
-- Decidido por Daniel el 2026-11-02: esperar días es un freno muy grande para los jugadores nuevos. Contra quien se hace
-- otra cuenta para evadir un baneo alcanza el SteamID: !claim no vincula uno que ya es de otra ficha, y el baneo de una
-- ficha alcanza a todos sus SteamID en todos los servidores. Se puede volver a subir desde Administración.
begin;

do $$
begin
  if to_regclass('public.mm_config') is null then
    raise exception 'replanteo 51: falta mm_config (aplicar antes 48_matchmaking.sql)';
  end if;
end $$;

alter table public.mm_config alter column min_account_days set default 0;
update public.mm_config set min_account_days = 0;

commit;
