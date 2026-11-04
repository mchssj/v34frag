-- Inversa del replanteo 74: admin_account_status como en el 72 (sin el correo).
begin;

create or replace function public.admin_account_status(p_user uuid) returns jsonb
  language plpgsql stable security definer set search_path = public as $$
declare r jsonb;
begin
  if not is_admin() then raise exception 'Solo un administrador puede hacer esto.' using errcode = '42501'; end if;
  select jsonb_build_object('confirmed', u.email_confirmed_at is not null, 'last_sign_in_at', u.last_sign_in_at) into r
    from auth.users u where u.id = p_user;
  if r is null then raise exception 'La cuenta no existe.' using errcode = 'P0002'; end if;
  return r;
end $$;

notify pgrst, 'reload schema';
commit;
