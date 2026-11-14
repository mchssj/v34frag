-- Inversa de la 113: se borran event_register_historic y tournament_registrations.guest_names (con los nombres
-- cargados en los torneos históricos).

begin;

drop function if exists public.event_register_historic(uuid, uuid, uuid[], text[], int);
alter table public.tournament_registrations drop column if exists guest_names;

commit;
