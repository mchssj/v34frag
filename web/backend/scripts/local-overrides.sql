-- Ajustes SOLO para la Supabase local de pruebas (los aplica scripts/db-local.sh al final).
-- Nunca se corren en producción.

-- La Supabase local sirve Storage por http://127.0.0.1:54321; producción exige https.
-- Se acepta también http para poder probar la subida del avatar de punta a punta.
alter table public.profile_details drop constraint if exists avatar_url_propio;
alter table public.profile_details add constraint avatar_url_propio check (
  avatar_url is null or avatar_url ~~ 'http%://%/storage/v1/object/public/avatars/%'
) not valid;
