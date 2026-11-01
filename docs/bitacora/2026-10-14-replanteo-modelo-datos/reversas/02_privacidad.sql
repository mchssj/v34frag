-- Inversa de supabase/replanteo/02_privacidad.sql.
-- Vuelve a admitir "members". Los perfiles que eran "members" quedaron "private" y siguen así
-- (al aplicar la migración no había ninguno).
begin;

alter table public.players drop constraint players_privacy_check;
alter table public.players
  add constraint players_privacy_check check ((privacy = any (array['public'::text, 'members'::text, 'private'::text])));

drop policy "perfil: ver segun privacidad" on public.profile_details;
create policy "perfil: ver segun privacidad" on public.profile_details for select using (
  (user_id = auth.uid()) or public.is_admin() or coalesce((
    select case p.privacy
             when 'public'::text then true
             when 'members'::text then (auth.uid() is not null)
             else false
           end
      from public.players p
     where p.user_id = profile_details.user_id
     limit 1), true)
);

commit;
