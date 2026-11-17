-- 127: sin logros de torneo dados a mano (bitácora docs/bitacora/2026-11-17-sin-logros-de-torneo/, Daniel 2026-11-17).
--
-- Los trofeos de torneo son pines (123): se consiguen con los torneos de la plataforma o con los históricos. Las medallas
-- «Campeón de torneo» y «Finalista de torneo» quedaron como manuales para torneos de afuera; ahora se borran, con todo lo
-- que las nombra: las medallas (en producción, 17 de campeón dadas a mano), los logros destacados del Resumen, los avisos
-- medal_granted y las dos definiciones. Las plantillas son event_result: la API no deja crear otras.
--
-- Todo queda en tablas *_127_respaldo (sin acceso desde la API), para la inversa:
-- docs/bitacora/2026-10-14-replanteo-modelo-datos/reversas/127_sin_logros_de_torneo.sql.
begin;

do $$
begin
  if to_regclass('public.medal_definitions_127_respaldo') is not null then
    raise exception 'replanteo 127: ya se aplicó (medal_definitions_127_respaldo existe)';
  end if;
end $$;

-- ---------- respaldo ----------
create table public.medal_definitions_127_respaldo as
  select * from public.medal_definitions where template in ('campeon_torneo', 'finalista_torneo');
create table public.player_medals_127_respaldo as
  select pm.* from public.player_medals pm
   where pm.definition_id in (select id from public.medal_definitions_127_respaldo);
create table public.player_medal_featured_127_respaldo as
  select f.* from public.player_medal_featured f
   where f.definition_id in (select id from public.medal_definitions_127_respaldo);
create table public.notifications_127_respaldo as
  select n.* from public.notifications n
   where n.type = 'medal_granted' and n.data->'medal'->>'template' in ('campeon_torneo', 'finalista_torneo');

do $$
declare t text;
begin
  foreach t in array array['medal_definitions_127_respaldo', 'player_medals_127_respaldo',
                           'player_medal_featured_127_respaldo', 'notifications_127_respaldo'] loop
    execute format('revoke all on public.%I from anon, authenticated', t);
    execute format('alter table public.%I enable row level security', t);
    execute format('comment on table public.%I is %L', t,
                   'Lo que la 127 borró de los logros de torneo, para la inversa. Se puede borrar después del 2026-12-17');
  end loop;
end $$;

-- ---------- borrado ----------
delete from public.notifications where id in (select id from public.notifications_127_respaldo);
delete from public.player_medal_featured f using public.medal_definitions_127_respaldo d where f.definition_id = d.id;
delete from public.player_medals pm using public.medal_definitions_127_respaldo d where pm.definition_id = d.id;
delete from public.medal_definitions where id in (select id from public.medal_definitions_127_respaldo);

do $$
declare v_def int; v_med int; v_feat int; v_avisos int;
begin
  if exists (select 1 from public.medal_definitions where template in ('campeon_torneo', 'finalista_torneo'))
     or exists (select 1 from public.player_medals pm
                 where pm.definition_id in (select id from public.medal_definitions_127_respaldo)) then
    raise exception 'replanteo 127: quedan logros de torneo';
  end if;
  select count(*) into v_def from public.medal_definitions_127_respaldo;
  select count(*) into v_med from public.player_medals_127_respaldo;
  select count(*) into v_feat from public.player_medal_featured_127_respaldo;
  select count(*) into v_avisos from public.notifications_127_respaldo;
  raise notice 'replanteo 127: se borraron % definiciones, % medallas, % destacados y % avisos', v_def, v_med, v_feat, v_avisos;
end $$;

notify pgrst, 'reload schema';

commit;
