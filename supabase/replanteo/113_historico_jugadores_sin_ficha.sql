-- 113: jugadores sin ficha en los torneos históricos (bitácora docs/bitacora/2026-11-13-chat-y-jugadores-historicos/,
-- Daniel 2026-11-13).
--
-- En un histórico, quien lo gestiona carga de 0 a 10 jugadores por equipo. Hasta ahora tenían que ser fichas; ahora
-- también se puede cargar solo un nombre, para quien no está en la plataforma. El nombre vive en la inscripción
-- torneo-equipo (tournament_registrations.guest_names), así que en un equipo de la plataforma no aparece en su
-- plantel ni en su página: solo en los jugadores de ese torneo. No tiene perfil, títulos ni estadísticas.
-- event_register_historic() guarda fichas y nombres juntos, en una sola transacción, y llama a event_register
-- (replanteo 80) para las fichas.
-- Inversa en docs/bitacora/2026-10-14-replanteo-modelo-datos/reversas/113_historico_jugadores_sin_ficha.sql.

begin;

do $$
begin
  if exists (select 1 from information_schema.columns
              where table_schema = 'public' and table_name = 'tournament_registrations' and column_name = 'guest_names') then
    raise exception 'replanteo 113: ya se aplicó (tournament_registrations.guest_names existe)';
  end if;
  if not exists (select 1 from information_schema.columns
                  where table_schema = 'public' and table_name = 'events' and column_name = 'historic') then
    raise exception 'replanteo 113: falta la 80 (events.historic)';
  end if;
end $$;

alter table public.tournament_registrations
  add column guest_names text[] not null default '{}',
  add constraint tournament_registrations_guest_names_max check (cardinality(guest_names) <= 10);

comment on column public.tournament_registrations.guest_names is
  'Torneo histórico: jugadores sin ficha, solo el nombre (2 a 24 caracteres). Son de esta inscripción, no del equipo. Replanteo 113';

-- Fichas (p_players) y nombres (p_names) de un equipo en un histórico. Reemplaza los dos conjuntos.
create function public.event_register_historic(p_event uuid, p_team uuid, p_players uuid[], p_names text[],
                                               p_start_stage int default null) returns void
  language plpgsql security definer set search_path = public as $$
declare
  e       events%rowtype;
  nombres text[];
  n       text;
begin
  select * into e from events where id = p_event;
  if not found then raise exception 'No existe ese torneo' using errcode = 'P0002'; end if;
  if not e.historic then raise exception 'Los jugadores sin ficha se cargan solo en un torneo histórico'; end if;
  if not can_manage_event(p_event) then
    raise exception 'Los equipos de un torneo histórico los carga quien lo gestiona' using errcode = '42501';
  end if;

  -- Sin espacios de más; el orden es el de la carga.
  select coalesce(array_agg(x order by i), '{}') into nombres
    from (select regexp_replace(btrim(v), '\s+', ' ', 'g') as x, i
            from unnest(coalesce(p_names, '{}')) with ordinality as u(v, i)) s;
  foreach n in array nombres loop
    if char_length(n) < 2 or char_length(n) > 24 then
      raise exception 'Cada nombre tiene entre 2 y 24 caracteres (%)', n;
    end if;
  end loop;
  if cardinality(nombres) <> (select count(distinct lower(y)) from unnest(nombres) y) then
    raise exception 'Hay nombres repetidos';
  end if;
  if coalesce(cardinality(p_players), 0) + cardinality(nombres) > 10 then
    raise exception 'Hasta 10 jugadores por equipo, con o sin ficha';
  end if;

  perform event_register(p_event, p_team, coalesce(p_players, '{}'), '{}', p_start_stage);
  update tournament_registrations set guest_names = nombres where event_id = p_event and team_id = p_team;
end $$;
revoke all on function public.event_register_historic(uuid, uuid, uuid[], text[], int) from public, anon;
grant execute on function public.event_register_historic(uuid, uuid, uuid[], text[], int) to authenticated;

commit;
