-- Replanteo 02: privacidad solo "public" o "private" (plan, sección 2.4).
-- Privado oculta los datos personales (profile_details); las stats y los mixes siguen siendo públicos.
-- NO aplicar en producción antes del corte (ver README.md).
begin;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'players_privacy_check'
                 and pg_get_constraintdef(oid) like '%members%') then
    raise exception 'replanteo 02: players_privacy_check no tiene "members" (¿ya se aplicó?)';
  end if;
end $$;

-- "Solo miembros" pasa a privado (hoy no hay ninguno).
update public.players set privacy = 'private' where privacy = 'members';

alter table public.players drop constraint players_privacy_check;
alter table public.players add constraint players_privacy_check check (privacy in ('public', 'private'));

-- Detalles del perfil: dueño y admin siempre; el resto solo si el jugador vinculado es público.
-- Una cuenta sin jugador vinculado sigue siendo visible (como hasta ahora).
drop policy "perfil: ver segun privacidad" on public.profile_details;
create policy "perfil: ver segun privacidad" on public.profile_details for select using (
  user_id = auth.uid()
  or public.is_admin()
  or coalesce((select p.privacy = 'public' from public.players p where p.user_id = profile_details.user_id limit 1), true)
);

commit;
