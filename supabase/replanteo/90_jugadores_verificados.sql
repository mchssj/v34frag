-- 90: insignia de jugador verificado (bitácora docs/bitacora/2026-11-09-jugadores-verificados, Kyan 2026-11-09).
--
--   1. players.verified: null (sin insignia), 'gray' (verificado) o 'gold' (verificado destacado), con el motivo que
--      se lee en el tooltip (verified_note, hasta 60 caracteres), quién y cuándo.
--   2. admin_player_verify(p_player, p_kind, p_note): la pone, la cambia o la saca (p_kind null). Solo admins.
--      El jugador no la puede pedir ni poner.
-- La columna se lee con la ficha; la escribe solo la función (un trigger frena el UPDATE directo del dueño).
-- Inversa: docs/bitacora/2026-10-14-replanteo-modelo-datos/reversas/90_jugadores_verificados.sql.
begin;

do $$
begin
  if exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'players' and column_name = 'verified') then
    raise exception 'replanteo 90: ya se aplicó (players.verified existe)';
  end if;
end $$;

alter table public.players
  add column verified text check (verified in ('gray', 'gold')),
  add column verified_note text check (char_length(verified_note) <= 60),
  add column verified_at timestamptz,
  add column verified_by uuid references auth.users(id) on delete set null;
comment on column public.players.verified is 'Insignia de verificado (replanteo 90): gray, gold o null. La pone un admin';

-- Nadie la escribe directo, ni el dueño de la ficha. El dueño tiene UPDATE sobre su fila (bio, privacidad…) a nivel de
-- tabla, y eso le gana a un revoke por columna: lo frena un trigger. Desde admin_player_verify (security definer) el
-- usuario es el dueño de la función, no `authenticated`.
create function public.tg_players_verified_guard() returns trigger
  language plpgsql set search_path = public as $$
begin
  if current_user in ('anon', 'authenticated')
     and (new.verified, new.verified_note, new.verified_at, new.verified_by)
         is distinct from (old.verified, old.verified_note, old.verified_at, old.verified_by) then
    raise exception 'La insignia de verificado la pone un admin' using errcode = '42501';
  end if;
  return new;
end $$;
create trigger players_verified_guard before update on public.players
  for each row execute function public.tg_players_verified_guard();

create function public.admin_player_verify(p_player uuid, p_kind text, p_note text default null) returns void
  language plpgsql security definer set search_path = public as $$
declare v_note text := nullif(btrim(coalesce(p_note, '')), '');
begin
  if not coalesce(is_admin(), false) then raise exception 'Solo un admin puede verificar jugadores' using errcode = '42501'; end if;
  if p_kind is not null and p_kind not in ('gray', 'gold') then raise exception 'La insignia es gray o gold' using errcode = 'P0001'; end if;
  if char_length(v_note) > 60 then raise exception 'El motivo tiene más de 60 caracteres' using errcode = 'P0001'; end if;
  update players
     set verified = p_kind,
         verified_note = case when p_kind is null then null else v_note end,
         verified_at = case when p_kind is null then null else now() end,
         verified_by = case when p_kind is null then null else auth.uid() end
   where id = p_player;
  if not found then raise exception 'Ese jugador no existe' using errcode = 'P0002'; end if;
end $$;

revoke all on function public.admin_player_verify(uuid, text, text) from public, anon;
grant execute on function public.admin_player_verify(uuid, text, text) to authenticated;

notify pgrst, 'reload schema';

commit;
