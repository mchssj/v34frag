-- 140: partidas favoritas para VIP (bitácora docs/bitacora/2026-11-24-comparador-y-favoritas-vip, Kyan y Daniel 2026-11-24).
--
--   1. match_favorites: las partidas que marcó cada cuenta. Cada una ve solo las suyas (RLS) y se escribe solo con la función.
--   2. match_favorite_set(partida, sí o no): marcar exige VIP y que la partida exista y la cuenta la pueda ver (la 80);
--      desmarcar, solo sesión. Al vencer el VIP, lo marcado queda: se ve y se puede sacar, pero no se suma nada nuevo.
-- El filtro "Favoritas" del listado es de la 141 (match_search).
-- Inversa: docs/bitacora/2026-10-14-replanteo-modelo-datos/reversas/140_partidas_favoritas.sql.
begin;

do $$
begin
  if to_regclass('public.match_favorites') is not null then raise exception 'replanteo 140: ya se aplicó (match_favorites existe)'; end if;
  if to_regprocedure('public.is_vip(uuid)') is null then raise exception 'replanteo 140: falta is_vip'; end if;
  if to_regprocedure('public.event_visible(uuid)') is null then raise exception 'replanteo 140: falta la 80 (event_visible)'; end if;
end $$;

create table public.match_favorites (
  user_id    uuid not null references auth.users(id) on delete cascade,
  match_id   uuid not null references public.matches(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, match_id)
);
comment on table public.match_favorites is 'Partidas favoritas de cada cuenta: marcar es VIP (replanteo 140)';
create index match_favorites_match on public.match_favorites (match_id);

alter table public.match_favorites enable row level security;
revoke all on public.match_favorites from public, anon, authenticated;
grant select on public.match_favorites to authenticated;
create policy "favoritas: ver las propias" on public.match_favorites for select to authenticated using (user_id = auth.uid());

create function public.match_favorite_set(p_match uuid, p_on boolean) returns void
  language plpgsql security definer set search_path = public as $$
declare v_user uuid := auth.uid();
begin
  if v_user is null then raise exception 'Para guardar una partida tienes que iniciar sesión' using errcode = '28000'; end if;
  if not p_on then
    delete from match_favorites where user_id = v_user and match_id = p_match;
    return;
  end if;
  if not exists (select 1 from matches m where m.id = p_match and m.kind in ('mix', 'pcw', 'official')
                    and (m.event_id is null or event_visible(m.event_id))) then
    raise exception 'Esa partida no existe' using errcode = 'P0002';
  end if;
  if not is_vip(v_user) then raise exception 'Guardar partidas favoritas es para los VIP' using errcode = 'V8901'; end if;
  insert into match_favorites(user_id, match_id) values (v_user, p_match) on conflict do nothing;
end $$;
comment on function public.match_favorite_set(uuid, boolean) is 'Marcar (VIP) o desmarcar una partida favorita (replanteo 140)';
revoke all on function public.match_favorite_set(uuid, boolean) from public, anon, authenticated;
grant execute on function public.match_favorite_set(uuid, boolean) to authenticated;

notify pgrst, 'reload schema';

commit;
