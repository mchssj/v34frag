-- Replanteo 50: matchmaking sin mínimo de mixes (bitácora docs/bitacora/2026-11-02-mm-claim-en-sala).
-- Decidido por Daniel el 2026-11-02: con el matchmaking como única forma de jugar, un mínimo de mixes deja afuera para
-- siempre a los jugadores nuevos (no tienen dónde jugar esos mixes). Se puede volver a subir desde Administración.
begin;

do $$
begin
  if to_regclass('public.mm_config') is null then
    raise exception 'replanteo 50: falta mm_config (aplicar antes 48_matchmaking.sql)';
  end if;
end $$;

alter table public.mm_config alter column min_mixes set default 0;
update public.mm_config set min_mixes = 0;

commit;
