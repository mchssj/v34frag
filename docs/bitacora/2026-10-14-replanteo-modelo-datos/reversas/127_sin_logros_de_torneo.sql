-- Inversa del replanteo 127: vuelven las definiciones «Campeón de torneo» y «Finalista de torneo», sus medallas, los
-- logros destacados y los avisos, desde las tablas *_127_respaldo, que después se borran.
begin;

do $$
begin
  if to_regclass('public.medal_definitions_127_respaldo') is null then
    raise exception 'inversa 127: no están los respaldos (medal_definitions_127_respaldo)';
  end if;
end $$;

-- El trigger medal_definitions_cambios pisa activated_at y updated_*: las filas vuelven tal cual estaban.
alter table public.medal_definitions disable trigger medal_definitions_cambios;
insert into public.medal_definitions select * from public.medal_definitions_127_respaldo;
alter table public.medal_definitions enable trigger medal_definitions_cambios;

-- Sin avisos nuevos: la medalla ya se había avisado (los avisos viejos vuelven abajo).
alter table public.player_medals disable trigger notify_player_medals;
insert into public.player_medals select * from public.player_medals_127_respaldo;
alter table public.player_medals enable trigger notify_player_medals;

insert into public.player_medal_featured select * from public.player_medal_featured_127_respaldo
  on conflict do nothing;   -- si el jugador ya ocupó ese lugar con otro logro, se queda con el nuevo

insert into public.notifications overriding system value select * from public.notifications_127_respaldo;

drop table public.notifications_127_respaldo, public.player_medal_featured_127_respaldo,
           public.player_medals_127_respaldo, public.medal_definitions_127_respaldo;

notify pgrst, 'reload schema';

commit;
