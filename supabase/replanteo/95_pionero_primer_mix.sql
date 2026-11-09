-- 95: Pionero para los del primer mix (bitácora docs/bitacora/2026-11-09-pionero-primer-mix/, Daniel 2026-11-09).
--
-- - first_match (Pionero) mira solo los mixes (kind = 'mix'): desde la 80 hay partidas de torneos históricos con fechas
--   viejas y sin jugadores con ficha, y la más vieja de todas dejaba la medalla sin nadie.
-- - medal_exclusions: un jugador que no recibe una medalla del motor aunque la cumpla (NOTIONSPAPU y Pionero). La
--   respetan medals_award (al guardar cada mix, el cron y la retroactiva) y medal_progress.
-- Necesita la 79. Inversa: docs/bitacora/2026-11-09-pionero-primer-mix/pruebas/95_inversa.sql.
begin;

do $$
begin
  if to_regclass('public.medal_definitions') is null then
    raise exception 'replanteo 95: falta la 79';
  end if;
  if to_regclass('public.medal_exclusions') is not null then
    raise exception 'replanteo 95: medal_exclusions ya existe (¿ya se aplicó?)';
  end if;
end $$;

create function pg_temp.reemplazar(fn regprocedure, cambios text[][]) returns void language plpgsql as $$
declare d text := pg_get_functiondef(fn); i int;
begin
  for i in 1 .. array_length(cambios, 1) loop
    if position(cambios[i][1] in d) = 0 then
      raise exception 'replanteo 95: en % no se encontró: %', fn, left(cambios[i][1], 80);
    end if;
    d := replace(d, cambios[i][1], cambios[i][2]);
  end loop;
  execute d;
end $$;

-- ---------- exclusiones ----------
create table public.medal_exclusions (
  player_id     uuid not null references public.players(id) on delete cascade,
  definition_id uuid not null references public.medal_definitions(id) on delete cascade,
  reason        text not null check (length(btrim(reason)) between 1 and 200),
  created_at    timestamptz not null default now(),
  created_by    uuid,
  primary key (player_id, definition_id)
);
alter table public.medal_exclusions enable row level security;   -- sin políticas: solo las funciones internas
revoke all on public.medal_exclusions from anon, authenticated;
comment on table public.medal_exclusions is 'Jugadores que no reciben una medalla del motor aunque la cumplan (replanteo 95)';

-- ---------- Pionero: solo mixes ----------
select pg_temp.reemplazar('public.medal_metric_values(text,text,jsonb,uuid[])', array[
  ['where m.status = ''finished'' order by coalesce(m.played_at, m.starts_at), m.id limit 1',
   'where m.status = ''finished'' and m.kind = ''mix'' order by coalesce(m.played_at, m.starts_at), m.id limit 1 /* (replanteo 95) */']]);

-- ---------- el motor respeta las exclusiones ----------
select pg_temp.reemplazar('public.medals_award(uuid[],uuid[])', array[
  ['where v.value is not null and v.value >= d.target',
   'where v.value is not null and v.value >= d.target
       and not exists (select 1 from medal_exclusions x where x.player_id = v.player_id and x.definition_id = d.id) /* (replanteo 95) */']]);

select pg_temp.reemplazar('public.medal_progress(uuid)', array[
  ['select d.id, coalesce((select v.value from medal_metric_values(d.metric, d.aggregation, d.filters, array[p_player]) v), 0)',
   'select d.id, case when exists (select 1 from medal_exclusions x where x.player_id = p_player and x.definition_id = d.id) then 0 /* (replanteo 95) */
               else coalesce((select v.value from medal_metric_values(d.metric, d.aggregation, d.filters, array[p_player]) v), 0) end']]);

commit;
