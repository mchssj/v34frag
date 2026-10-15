-- Replanteo 01: limpieza de lo que no se usa (plan, sección 2.6).
-- NO aplicar en producción antes del corte (ver README.md).
begin;

-- Estado esperado: nada de esto aplicado todavía y sin datos que se perderían.
do $$
begin
  if to_regclass('public.player_claims') is null then
    raise exception 'replanteo 01: player_claims ya no existe (¿ya se aplicó?)';
  end if;
  if exists (select 1 from public.player_claims) then
    raise exception 'replanteo 01: player_claims tiene filas; revisar antes de borrarla';
  end if;
  if exists (select 1 from public.profiles where player_id is not null) then
    raise exception 'replanteo 01: profiles.player_id tiene datos; revisar antes de borrarla';
  end if;
  if exists (select 1 from public.matches where demo_url is not null or video_url is not null) then
    raise exception 'replanteo 01: hay partidas con demo_url o video_url; revisar antes de borrarlas';
  end if;
  if exists (select 1 from public.events where format = 'swiss') then
    raise exception 'replanteo 01: hay torneos con formato swiss';
  end if;
end $$;

-- Tabla vieja de reclamos de perfil (la reemplazó profile_requests; después vendrá !claim).
drop table public.player_claims;

-- Columnas sin uso.
alter table public.profiles drop column player_id;       -- el vínculo real es players.user_id
alter table public.player_medals drop column color;      -- la web nunca lo usó
alter table public.matches drop column demo_url;         -- las demos van a R2 (demo_key, demo_status)
alter table public.matches drop column video_url;

-- Políticas duplicadas (idénticas a las que quedan; verificado comparando qual y with_check).
drop policy "admin gestiona eventos" on public.events;     -- queda "torneos: admin gestiona"
drop policy "todos ven eventos" on public.events;          -- queda "torneos: todos ven"
drop policy "admin gestiona partidas" on public.matches;   -- queda "partidas: admin gestiona"
drop policy "todos ven partidas" on public.matches;        -- queda "partidas: todos ven"
drop policy "Permitir lectura pública de jugadores" on public.players;  -- queda "todos ven jugadores"

-- Formatos de torneo que el motor sabe generar ('swiss' era heredado y no tenía fixture).
alter table public.events
  add constraint events_format_check check (format is null or format in ('playoffs', 'single', 'double', 'rr', 'groups'));

commit;
