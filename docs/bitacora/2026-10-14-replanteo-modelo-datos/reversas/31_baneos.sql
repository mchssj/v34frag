-- Inversa de supabase/replanteo/31_baneos.sql: borra los baneos (tabla, funciones y vista) y el rol moderator.
-- Aborta si hay cuentas con rol moderator: pasarlas antes a otro rol con set_user_role.
begin;

do $$
begin
  if exists (select 1 from public.profiles where role = 'moderator') then
    raise exception 'inversa 31: hay cuentas con rol moderator';
  end if;
end $$;

drop view public.ban_list;
drop function public.csstv_ban_lift(text, text, text, text);
drop function public.csstv_ban_add(text, text, text, text, text, int, text);
drop function public.csstv_bans_since(text, text);
drop function public.csstv_ban_check(text, text);
drop function public.ban_unix(timestamptz);
drop function public.ban_lift(uuid, text);
drop function public.ban_update(uuid, text, timestamptz, boolean);
drop function public.ban_create(uuid, text, text, timestamptz);
drop function public.ban_insert(uuid, text, text, text, timestamptz, text, uuid, text, text, uuid);
drop function public.ban_steams(uuid, text);
drop function public.ban_active_for(text);
drop function public.ban_owner(uuid, text);
drop table public.bans;
drop function public.bans_touch();

-- Como en la 10.
create or replace function public.set_user_role(p_user uuid, p_role text) returns void
  language plpgsql security definer set search_path = public as $$
begin
  if not is_admin() then raise exception 'Solo un administrador puede cambiar roles' using errcode = '42501'; end if;
  if p_role not in ('user', 'organizer') then raise exception 'El rol tiene que ser user u organizer'; end if;
  if (select role from profiles where id = p_user) = 'admin' then raise exception 'El rol de un admin se cambia en la base'; end if;
  update profiles set role = p_role where id = p_user;
  if not found then raise exception 'No existe ese usuario'; end if;
end $$;

drop function public.is_moderator();
alter table public.profiles drop constraint profiles_role_check;
alter table public.profiles add constraint profiles_role_check check (role in ('user', 'organizer', 'admin'));

commit;
