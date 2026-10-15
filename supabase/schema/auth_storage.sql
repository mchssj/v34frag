-- Lo que el esquema `public` necesita y que vive fuera de él: el trigger de registro
-- (esquema auth) y los buckets con sus políticas (esquema storage).
-- Copiado a mano de la Supabase real el 2026-10-14 (pg_trigger, storage.buckets, pg_policies).
-- Se carga después de public.sql.

-- Registro: crea profiles y profile_details para cada usuario nuevo.
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Buckets (todos públicos para lectura).
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types) values
  ('photos',  'photos',  true, null,    null),
  ('avatars', 'avatars', true, 1048576, array['image/jpeg', 'image/png', 'image/webp']),
  ('proofs',  'proofs',  true, 3145728, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- photos: fotos de jugadores, solo admin sube y borra.
create policy "fotos publicas" on storage.objects for select
  using (bucket_id = 'photos');
create policy "admin sube fotos" on storage.objects for insert
  with check (bucket_id = 'photos' and public.is_admin());
create policy "admin borra fotos" on storage.objects for delete
  using (bucket_id = 'photos' and public.is_admin());

-- avatars: cada usuario en su carpeta <uid>/.
create policy "avatars: todos ven" on storage.objects for select
  using (bucket_id = 'avatars');
create policy "avatars: subir el propio" on storage.objects for insert to authenticated
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "avatars: actualizar el propio" on storage.objects for update to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "avatars: borrar el propio" on storage.objects for delete to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

-- proofs: capturas de los reportes, en la carpeta <match_id>/.
create policy "proofs: todos ven" on storage.objects for select
  using (bucket_id = 'proofs');
create policy "proofs: el capitan sube" on storage.objects for insert to authenticated
  with check (bucket_id = 'proofs' and exists (
    select 1 from public.matches m
    where m.id::text = (storage.foldername(objects.name))[1]
      and m.status <> 'finished'
      and public.is_match_captain(m.id)));
create policy "proofs: admin borra" on storage.objects for delete to authenticated
  using (bucket_id = 'proofs' and public.is_admin());
