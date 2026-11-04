-- Inversa de supabase/replanteo/41_admin_torneos.sql.
-- Los mixes vinculados a mano y los resultados cargados se quedan como están (son datos de las partidas).
-- El start_stage que la siembra le puso a cada inscripción también se queda.
begin;

do $$
begin
  if to_regprocedure('public.can_own_event(uuid)') is null then
    raise exception 'inversa 41: no existe can_own_event (¿no se aplicó la 41?)';
  end if;
end $$;

drop function public.match_set_maps(uuid, jsonb);
drop function public.match_game_candidates(uuid);
drop function public.match_game_side(uuid, uuid);
drop function public.event_seed_ranking(uuid);
drop trigger events_seed_stages on public.events;
drop function public.events_seed_stages();
drop trigger events_owner_only on public.events;
drop function public.events_owner_only();

drop policy "torneos: borrar" on public.events;
create policy "torneos: borrar" on public.events for delete using (can_manage_event(id));
drop function public.can_own_event(uuid);

create or replace function public.can_manage_event(p_event uuid) returns boolean
  language sql stable security definer set search_path = public as $$
  select is_admin() or exists (
    select 1 from events e join profiles p on p.id = e.organizer_id
     where e.id = p_event and e.organizer_id = auth.uid() and p.role = 'organizer')
$$;

commit;
