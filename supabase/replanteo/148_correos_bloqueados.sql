-- Replanteo 148: correos temporales bloqueados al registrarse (plan docs/bitacora/2026-11-26-correos-bloqueados).
--   1. email_domain_blocks: los dominios bloqueados. source 'lista' (la lista pública de correos temporales, que se carga
--      aparte) o 'admin' (los que agrega un admin). blocked = false es una excepción: un admin desbloqueó un dominio de
--      la lista y una nueva carga de la lista no lo vuelve a bloquear. Solo la ven los admins.
--   2. email_domain_blocked(email): si el dominio, o uno de los que lo contienen (x.anonmart.com → anonmart.com), está
--      bloqueado. Manda el más específico, así una excepción de un subdominio gana. La puede llamar anon: la API la usa
--      antes del registro y solo responde sí o no.
--   3. Trigger en auth.users (alta y cambio de correo): rechaza un correo bloqueado aunque se use Supabase Auth directo,
--      sin la API.
--   4. Admin: admin_email_domain_block, admin_email_domain_unblock y admin_email_domain_accounts (las cuentas que ya
--      usan un dominio bloqueado; no se tocan).
-- Corre como supabase_admin (el trigger va en auth.users). Lo de public se crea como postgres, como el resto.
begin;

do $$
begin
  if to_regclass('public.email_domain_blocks') is not null then
    raise exception 'replanteo 148: email_domain_blocks ya existe (¿ya se aplicó?)';
  end if;
  if to_regprocedure('public.is_admin()') is null or to_regclass('public.bans') is null then
    raise exception 'replanteo 148: faltan is_admin() o bans';
  end if;
  if current_user <> 'supabase_admin' then
    raise exception 'replanteo 148: correr como supabase_admin (el trigger va en auth.users)';
  end if;
end $$;

set local role postgres;

-- =====================================================================================================
-- 1. Dominios bloqueados
-- =====================================================================================================
create table public.email_domain_blocks (
  domain     text primary key
             check (char_length(domain) <= 253
                    and domain ~ '^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?(\.[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?)+$'),
  source     text not null check (source in ('lista', 'admin')),
  blocked    boolean not null default true,
  reason     text check (char_length(reason) <= 200),
  updated_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
comment on table public.email_domain_blocks is
  'Dominios de correo bloqueados al registrarse (replanteo 148). source lista o admin; blocked false = excepción de un admin. Solo admin';

alter table public.email_domain_blocks enable row level security;
create policy email_domain_blocks_admin_read on public.email_domain_blocks for select to authenticated using (is_admin());
-- Solo lectura para los admins (por la política); los cambios van por las funciones de abajo.
revoke all on table public.email_domain_blocks from public, anon, authenticated, service_role;
grant select on table public.email_domain_blocks to authenticated;
grant all on table public.email_domain_blocks to service_role;

-- El dominio de un correo, en minúsculas y sin el punto final. null si no tiene @.
create function public.email_domain_of(p_email text) returns text
  language sql immutable set search_path = public as $$
  select nullif(rtrim(lower(btrim(substring(btrim(coalesce(p_email, '')) from '@([^@]+)$'))), '.'), '')
$$;

create function public.email_domain_blocked(p_email text) returns boolean
  language plpgsql stable security definer set search_path = public as $$
declare d text; parts text[]; cands text[] := '{}'; n int;
begin
  d := email_domain_of(p_email);
  if d is null then return false; end if;
  parts := string_to_array(d, '.');
  n := coalesce(array_length(parts, 1), 0);
  -- a.b.com → {a.b.com, b.com}: el dominio y sus padres, sin el TLD solo.
  for i in 1 .. n - 1 loop
    cands := cands || array_to_string(parts[i:n], '.');
  end loop;
  return coalesce((select b.blocked from email_domain_blocks b where b.domain = any (cands)
                   order by char_length(b.domain) desc limit 1), false);
end $$;

-- =====================================================================================================
-- 2. Trigger en auth.users
-- =====================================================================================================
-- email_change: GoTrue guarda ahí el correo nuevo hasta que se confirma; se frena desde el pedido.
create function public.auth_users_email_domain_check() returns trigger
  language plpgsql security definer set search_path = public as $$
begin
  if (new.email is not null and (tg_op = 'INSERT' or new.email is distinct from old.email)
      and email_domain_blocked(new.email))
     or (coalesce(new.email_change, '') <> '' and (tg_op = 'INSERT' or new.email_change is distinct from old.email_change)
         and email_domain_blocked(new.email_change)) then
    raise exception 'No aceptamos correos temporales. Usa otro correo, por ejemplo Gmail u Outlook.'
      using errcode = 'P0001', hint = 'EMAIL_DOMAIN_BLOCKED';
  end if;
  return new;
end $$;

-- =====================================================================================================
-- 3. Admin
-- =====================================================================================================
create function public.admin_email_domain_block(p_domain text, p_reason text default null)
  returns public.email_domain_blocks
  language plpgsql security definer set search_path = public as $$
declare d text; r email_domain_blocks;
begin
  if not is_admin() then raise exception 'Solo un admin puede bloquear correos' using errcode = '42501'; end if;
  d := rtrim(lower(btrim(coalesce(p_domain, ''))), '.');
  d := regexp_replace(d, '^.*@', '');   -- acepta "x@dominio.com" o "@dominio.com"
  if d !~ '^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?(\.[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?)+$' or char_length(d) > 253 then
    raise exception 'Ese dominio no es válido. Escríbelo como anonmart.com' using errcode = 'P0001';
  end if;
  insert into email_domain_blocks (domain, source, blocked, reason, updated_by)
  values (d, 'admin', true, left(nullif(btrim(p_reason), ''), 200), auth.uid())
  on conflict (domain) do update
     set blocked = true,
         reason = coalesce(excluded.reason, email_domain_blocks.reason),
         updated_by = auth.uid(),
         updated_at = now()
  returning * into r;
  return r;
end $$;

-- Desbloquear: uno agregado por un admin se borra; uno de la lista queda como excepción (blocked = false).
create function public.admin_email_domain_unblock(p_domain text) returns jsonb
  language plpgsql security definer set search_path = public as $$
declare d text := rtrim(lower(btrim(coalesce(p_domain, ''))), '.'); r email_domain_blocks;
begin
  if not is_admin() then raise exception 'Solo un admin puede desbloquear correos' using errcode = '42501'; end if;
  select * into r from email_domain_blocks where domain = d for update;
  if r.domain is null then raise exception 'Ese dominio no está en la lista' using errcode = 'P0002'; end if;
  if r.source = 'admin' then
    delete from email_domain_blocks where domain = d;
    return jsonb_build_object('domain', d, 'removed', true);
  end if;
  update email_domain_blocks set blocked = false, updated_by = auth.uid(), updated_at = now() where domain = d;
  return jsonb_build_object('domain', d, 'removed', false);
end $$;

-- Las cuentas que ya usan un dominio bloqueado (no se tocan: un admin decide). Con su ficha y si está baneada.
create function public.admin_email_domain_accounts()
  returns table (user_id uuid, email text, alias text, domain text, created_at timestamptz, confirmed boolean,
                 player_id uuid, banned boolean)
  language plpgsql stable security definer set search_path = public as $$
begin
  if not is_admin() then raise exception 'Solo un admin puede ver las cuentas' using errcode = '42501'; end if;
  return query
    select u.id, u.email::text, p.tag, email_domain_of(u.email), u.created_at, u.email_confirmed_at is not null,
           pl.id,
           exists (select 1 from bans b where b.player_id = pl.id and b.lifted_at is null
                     and (b.expires_at is null or b.expires_at > now()))
      from auth.users u
      left join profiles p on p.id = u.id
      left join players pl on pl.user_id = u.id
     where email_domain_blocked(u.email);
end $$;

-- Permisos: sin los de por defecto de Supabase (anon y authenticated en todo).
revoke all on function public.email_domain_of(text) from public, anon, authenticated;
revoke all on function public.email_domain_blocked(text) from public, anon, authenticated;
revoke all on function public.auth_users_email_domain_check() from public, anon, authenticated, service_role;
revoke all on function public.admin_email_domain_block(text, text) from public, anon, authenticated;
revoke all on function public.admin_email_domain_unblock(text) from public, anon, authenticated;
revoke all on function public.admin_email_domain_accounts() from public, anon, authenticated;
grant execute on function public.email_domain_of(text) to authenticated, service_role;
grant execute on function public.email_domain_blocked(text) to anon, authenticated, service_role;
grant execute on function public.admin_email_domain_block(text, text) to authenticated, service_role;
grant execute on function public.admin_email_domain_unblock(text) to authenticated, service_role;
grant execute on function public.admin_email_domain_accounts() to authenticated, service_role;

reset role;

-- El trigger, como dueño de auth.users. Los dominios de la lista pública se cargan después (cargar_lista.py).
create trigger email_domain_check
  before insert or update of email, email_change on auth.users
  for each row execute function public.auth_users_email_domain_check();

-- Los dos que empezaron todo (2026-11-26), por si la carga de la lista falla o los saca.
insert into public.email_domain_blocks (domain, source, reason)
values ('anonmart.com', 'admin', 'Cuentas de un cheater (2026-11-26)'),
       ('afronewz.com', 'admin', 'Cuentas de un cheater (2026-11-26)');

notify pgrst, 'reload schema';
commit;
