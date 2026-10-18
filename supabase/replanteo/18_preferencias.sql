-- Replanteo 18: preferencias de la cuenta (plan docs/bitacora/2026-10-18-preferencias-perfil).
--   - user_preferences: una fila por cuenta con un objeto de preferencias; solo la lee y la cambia el propio usuario.
--   - theme_fx: efectos al cambiar de tema en el frontend ("full" con sonido, "silent" sin sonido, "off" desactivados).
--   - set_my_preferences une los cambios con lo guardado (una clave en null se borra).
-- NO aplicar en producción antes del corte (ver README.md).
begin;

do $$
begin
  if to_regprocedure('public.event_draw(uuid)') is null then
    raise exception 'replanteo 18: falta event_draw (aplicar antes 17_grupos_doble.sql)';
  end if;
  if to_regclass('public.user_preferences') is not null then
    raise exception 'replanteo 18: user_preferences ya existe (¿ya se aplicó?)';
  end if;
end $$;

create table public.user_preferences (
  user_id     uuid primary key references auth.users(id) on delete cascade,
  preferences jsonb not null default '{}',
  updated_at  timestamptz not null default now(),
  constraint user_preferences_object check (jsonb_typeof(preferences) = 'object'),
  constraint user_preferences_theme_fx check (preferences->'theme_fx' is null or preferences->>'theme_fx' in ('full', 'silent', 'off'))
);
comment on table public.user_preferences is 'Preferencias de cada cuenta (solo las ve y las cambia el propio usuario). theme_fx: full, silent u off';

alter table public.user_preferences enable row level security;
create policy "preferencias: ver las propias" on public.user_preferences for select using (user_id = auth.uid());
create policy "preferencias: crear las propias" on public.user_preferences for insert with check (user_id = auth.uid());
create policy "preferencias: editar las propias" on public.user_preferences for update using (user_id = auth.uid()) with check (user_id = auth.uid());
revoke all on public.user_preferences from anon, authenticated;
grant select, insert, update on public.user_preferences to authenticated;

-- Une los cambios con las preferencias guardadas del usuario que llama. Una clave en null se borra; las que no vienen
-- no se tocan. Corre con los permisos de quien llama, así aplica la RLS. Devuelve lo que quedó guardado.
create function public.set_my_preferences(p_changes jsonb) returns jsonb
  language plpgsql set search_path = public as $$
declare out jsonb;
begin
  if auth.uid() is null then raise exception 'Iniciá sesión' using errcode = '42501'; end if;
  if jsonb_typeof(p_changes) is distinct from 'object' then raise exception 'Las preferencias tienen que ser un objeto' using errcode = '22023'; end if;
  insert into user_preferences(user_id, preferences) values (auth.uid(), jsonb_strip_nulls(p_changes))
  on conflict (user_id) do update
    set preferences = jsonb_strip_nulls(user_preferences.preferences || p_changes), updated_at = now()
  returning preferences into out;
  return out;
end $$;
revoke all on function public.set_my_preferences(jsonb) from public, anon;
grant execute on function public.set_my_preferences(jsonb) to authenticated;

commit;
