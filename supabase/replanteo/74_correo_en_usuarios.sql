-- Replanteo 74: el correo de la cuenta en Administración › Usuarios, solo lectura (plan docs/bitacora/2026-11-04-correo-en-usuarios,
-- aprobado por Daniel el 2026-11-04). admin_account_status devuelve también el correo. Solo admins, como en el 72.
begin;

create or replace function public.admin_account_status(p_user uuid) returns jsonb
  language plpgsql stable security definer set search_path = public as $$
declare r jsonb;
begin
  if not is_admin() then raise exception 'Solo un administrador puede hacer esto.' using errcode = '42501'; end if;
  select jsonb_build_object('confirmed', u.email_confirmed_at is not null, 'last_sign_in_at', u.last_sign_in_at, 'email', u.email) into r
    from auth.users u where u.id = p_user;
  if r is null then raise exception 'La cuenta no existe.' using errcode = 'P0002'; end if;
  return r;
end $$;

notify pgrst, 'reload schema';
commit;
