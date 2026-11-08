-- Replanteo 72: acciones de cuenta en Administración › Usuarios (plan docs/bitacora/2026-11-03-admin-cuentas-usuarios,
-- aprobado por Daniel el 2026-11-03): reenviar la activación, enviar el correo de contraseña y contraseña aleatoria.
--   - account_admin_actions: quién hizo qué sobre qué cuenta. Nunca la contraseña.
--   - admin_account_status: si la cuenta confirmó el correo y su último inicio de sesión. Solo admins.
--   - admin_account_action: comprueba las reglas, registra y le devuelve a la API el correo de la cuenta. Solo admins. La
--     contraseña aleatoria no se puede usar sobre la cuenta propia ni sobre otro admin.
--   - admin_account_close_sessions: cierra las sesiones de la cuenta. Solo admins.
-- La API hace lo demás: pedirle los correos a GoTrue y cambiar la contraseña con la clave de administrador.
begin;

create table public.account_admin_actions (
  id bigint generated always as identity primary key,
  admin_id uuid references auth.users (id) on delete set null,
  user_id uuid references auth.users (id) on delete set null,
  action text not null check (action in ('resend_confirmation', 'password_reset_email', 'random_password')),
  created_at timestamptz not null default now()
);
comment on table public.account_admin_actions is 'Acciones de un admin sobre una cuenta. Se registra el pedido, nunca la contraseña. Replanteo 72';
create index account_admin_actions_user on public.account_admin_actions (user_id, created_at desc);
alter table public.account_admin_actions enable row level security;
revoke all on table public.account_admin_actions from public, anon, authenticated;
grant select on table public.account_admin_actions to authenticated;
create policy "admins leen las acciones" on public.account_admin_actions for select to authenticated using (is_admin());

create function public.admin_account_status(p_user uuid) returns jsonb
  language plpgsql stable security definer set search_path = public as $$
declare r jsonb;
begin
  if not is_admin() then raise exception 'Solo un administrador puede hacer esto.' using errcode = '42501'; end if;
  select jsonb_build_object('confirmed', u.email_confirmed_at is not null, 'last_sign_in_at', u.last_sign_in_at) into r
    from auth.users u where u.id = p_user;
  if r is null then raise exception 'La cuenta no existe.' using errcode = 'P0002'; end if;
  return r;
end $$;

create function public.admin_account_action(p_user uuid, p_action text) returns jsonb
  language plpgsql security definer set search_path = public as $$
declare v_email text; v_confirmed boolean;
begin
  if not is_admin() then raise exception 'Solo un administrador puede hacer esto.' using errcode = '42501'; end if;
  select u.email, u.email_confirmed_at is not null into v_email, v_confirmed from auth.users u where u.id = p_user;
  if not found then raise exception 'La cuenta no existe.' using errcode = 'P0002'; end if;
  if v_email is null then raise exception 'La cuenta no tiene correo.' using errcode = 'P0001'; end if;
  if p_action = 'random_password' then
    if p_user = auth.uid() then
      raise exception 'Tu propia contraseña se cambia en Mi perfil.' using errcode = '42501';
    end if;
    if exists (select 1 from profiles p where p.id = p_user and p.role = 'admin') then
      raise exception 'No se le puede cambiar la contraseña a otro admin.' using errcode = '42501';
    end if;
  elsif p_action = 'resend_confirmation' then
    if v_confirmed then raise exception 'Esa cuenta ya confirmó su correo.' using errcode = '23505'; end if;
  elsif p_action <> 'password_reset_email' then
    raise exception 'Acción desconocida.' using errcode = 'P0001';
  end if;
  insert into account_admin_actions (admin_id, user_id, action) values (auth.uid(), p_user, p_action);
  return jsonb_build_object('email', v_email);
end $$;

create function public.admin_account_close_sessions(p_user uuid) returns void
  language plpgsql security definer set search_path = public as $$
begin
  if not is_admin() then raise exception 'Solo un administrador puede hacer esto.' using errcode = '42501'; end if;
  delete from auth.sessions where user_id = p_user;
end $$;

revoke all on function public.admin_account_status(uuid), public.admin_account_action(uuid, text),
  public.admin_account_close_sessions(uuid) from public, anon;
grant execute on function public.admin_account_status(uuid), public.admin_account_action(uuid, text),
  public.admin_account_close_sessions(uuid) to authenticated;

notify pgrst, 'reload schema';
commit;
