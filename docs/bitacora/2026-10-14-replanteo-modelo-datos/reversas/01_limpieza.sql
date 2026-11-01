-- Inversa de supabase/replanteo/01_limpieza.sql.
-- Recrea la estructura tal como estaba en producción (supabase/schema/public.sql). Los datos borrados no
-- vuelven: la migración solo corre si esas tablas y columnas estaban vacías, así que no se pierde nada.
begin;

alter table public.events drop constraint if exists events_format_check;

create policy "Permitir lectura pública de jugadores" on public.players for select using (true);
create policy "todos ven partidas" on public.matches for select using (true);
create policy "admin gestiona partidas" on public.matches for all using (public.is_admin()) with check (public.is_admin());
create policy "todos ven eventos" on public.events for select using (true);
create policy "admin gestiona eventos" on public.events for all using (public.is_admin()) with check (public.is_admin());

alter table public.matches add column video_url text;
alter table public.matches add column demo_url text;
alter table public.player_medals add column color text default '#4a9be8'::text;
alter table public.profiles add column player_id uuid;
alter table public.profiles
  add constraint profiles_player_id_fkey foreign key (player_id) references public.players(id) on delete set null;

create table public.player_claims (
  id uuid default gen_random_uuid() not null,
  user_id uuid not null,
  player_id uuid not null,
  status text default 'pending'::text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  constraint player_claims_status_check check ((status = any (array['pending'::text, 'approved'::text, 'rejected'::text])))
);
alter table only public.player_claims add constraint player_claims_pkey primary key (id);
alter table only public.player_claims add constraint player_claims_player_id_key unique (player_id);
alter table only public.player_claims add constraint player_claims_user_id_key unique (user_id);
alter table only public.player_claims
  add constraint player_claims_player_id_fkey foreign key (player_id) references public.players(id) on delete cascade;
alter table only public.player_claims
  add constraint player_claims_user_id_fkey foreign key (user_id) references public.profiles(id) on delete cascade;
alter table public.player_claims enable row level security;
grant all on table public.player_claims to anon, authenticated, service_role;

commit;
