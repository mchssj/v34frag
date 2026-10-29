-- =============================================================================
-- VIP: quién es VIP y hasta cuándo
--
-- - vip_memberships: un período por cada vez que se da el VIP a una cuenta. ends_at null = lifetime.
--   No se borra nada: se revoca. Vigente = sin revocar, empezado y sin vencer; vence solo.
-- - is_vip(cuenta): tiene un período vigente.
-- - admin_vip_grant (1, 3, 6 o 12 meses, una fecha o lifetime; extender empieza donde termina el
--   vigente) y admin_vip_revoke (revoca los vigentes y los futuros, con motivo). Solo admins.
-- - vip_status: estado por cuenta (el dueño ve la suya; los admins, todas).
-- - vip_public: las cuentas VIP hoy y su ficha, pública y sin fechas.
--
-- Solo usa profiles, players e is_admin(), que la web vieja no cambia. El replanteo 32 suma los
-- avisos (vip_granted y vip_revoked) en el corte.
--
-- Bitácora: docs/bitacora/2026-10-28-vip-fase-0/
-- Cómo aplicarla: Supabase > SQL Editor > pegar todo el archivo > Run. Re-ejecutable antes del corte
-- (con el replanteo 32 aplicado, volver a correrla les saca los avisos a dar y quitar).
-- =============================================================================

begin;

-- ---------- Tabla ----------
create table if not exists public.vip_memberships (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null references public.profiles(id) on delete cascade,
  starts_at      timestamptz not null default now(),
  ends_at        timestamptz,
  source         text not null check (source in ('manual', 'import')),
  note           text check (char_length(note) <= 200),
  granted_by     uuid references public.profiles(id) on delete set null,
  created_at     timestamptz not null default now(),
  revoked_at     timestamptz,
  revoked_by     uuid references public.profiles(id) on delete set null,
  revoke_reason  text check (char_length(revoke_reason) <= 200),
  constraint vip_fin check (ends_at is null or ends_at > starts_at),
  constraint vip_revocado check (revoked_at is not null or (revoked_by is null and revoke_reason is null))
);
create index if not exists vip_memberships_user on public.vip_memberships (user_id);
comment on table public.vip_memberships is
  'VIP de las cuentas: un período por cada vez que se da. ends_at null = lifetime. Vigente: revoked_at null, starts_at pasado y ends_at null o futuro';

-- Cada uno lee los suyos; los admins, todos. Se escribe solo con las funciones.
alter table public.vip_memberships enable row level security;
revoke all on public.vip_memberships from anon, authenticated;
grant select on public.vip_memberships to authenticated;
drop policy if exists vip_memberships_read on public.vip_memberships;
create policy vip_memberships_read on public.vip_memberships for select to authenticated
  using (user_id = auth.uid() or is_admin());

-- ---------- is_vip ----------
create or replace function public.is_vip(p_user uuid default auth.uid()) returns boolean
  language sql stable security definer set search_path = public as $$
  select exists (select 1 from vip_memberships v
                  where v.user_id = p_user and v.revoked_at is null and v.starts_at <= now()
                    and (v.ends_at is null or v.ends_at > now()))
$$;
revoke all on function public.is_vip(uuid) from public;
grant execute on function public.is_vip(uuid) to anon, authenticated, service_role;

-- ---------- Dar y quitar ----------
-- Dar o extender el VIP. Una sola forma: p_months (1, 3, 6 o 12), p_until (fecha de fin) o p_lifetime.
-- Si tiene un VIP vigente (o uno futuro), el período nuevo empieza donde termina el último; si no, ahora.
-- Devuelve el id del período.
create or replace function public.admin_vip_grant(p_user uuid, p_months int default null, p_until timestamptz default null,
                                                  p_lifetime boolean default false, p_note text default null) returns uuid
  language plpgsql security definer set search_path = public as $$
declare v_life boolean := coalesce(p_lifetime, false); v_start timestamptz; v_end timestamptz; v_id uuid;
begin
  if not is_admin() then raise exception 'Solo un administrador puede dar VIP' using errcode = '42501'; end if;
  if (p_months is not null)::int + (p_until is not null)::int + v_life::int <> 1 then
    raise exception 'Elegí una duración: meses, una fecha o lifetime';
  end if;
  if p_months is not null and p_months not in (1, 3, 6, 12) then raise exception 'Los meses tienen que ser 1, 3, 6 o 12'; end if;
  if char_length(p_note) > 200 then raise exception 'La nota puede tener hasta 200 caracteres'; end if;
  if not exists (select 1 from profiles where id = p_user) then raise exception 'No existe ese usuario'; end if;

  perform pg_advisory_xact_lock(hashtext('vip:' || p_user::text));

  if exists (select 1 from vip_memberships where user_id = p_user and revoked_at is null and ends_at is null) then
    raise exception 'Ya es VIP lifetime';
  end if;
  select greatest(now(), coalesce(max(ends_at), now())) into v_start
    from vip_memberships where user_id = p_user and revoked_at is null and ends_at > now();

  if v_life then
    v_start := now();
    v_end := null;
  elsif p_months is not null then
    v_end := v_start + make_interval(months => p_months);
  else
    if p_until <= v_start then
      raise exception 'La fecha tiene que ser posterior al %', to_char(v_start at time zone 'America/Bogota', 'YYYY-MM-DD HH24:MI');
    end if;
    v_end := p_until;
  end if;

  insert into vip_memberships (user_id, starts_at, ends_at, source, note, granted_by)
  values (p_user, v_start, v_end, 'manual', nullif(btrim(p_note), ''), auth.uid())
  returning id into v_id;
  return v_id;
end $$;

-- Quitar el VIP: revoca los períodos vigentes y los futuros, también un lifetime. Devuelve cuántos revocó.
create or replace function public.admin_vip_revoke(p_user uuid, p_reason text) returns int
  language plpgsql security definer set search_path = public as $$
declare n int;
begin
  if not is_admin() then raise exception 'Solo un administrador puede quitar VIP' using errcode = '42501'; end if;
  if char_length(btrim(coalesce(p_reason, ''))) not between 1 and 200 then
    raise exception 'El motivo es obligatorio (hasta 200 caracteres)';
  end if;
  perform pg_advisory_xact_lock(hashtext('vip:' || p_user::text));
  update vip_memberships set revoked_at = now(), revoked_by = auth.uid(), revoke_reason = btrim(p_reason)
   where user_id = p_user and revoked_at is null and (ends_at is null or ends_at > now());
  get diagnostics n = row_count;
  if n = 0 then raise exception 'No tiene VIP vigente'; end if;
  return n;
end $$;

revoke all on function public.admin_vip_grant(uuid, int, timestamptz, boolean, text), public.admin_vip_revoke(uuid, text) from public, anon;
grant execute on function public.admin_vip_grant(uuid, int, timestamptz, boolean, text), public.admin_vip_revoke(uuid, text)
  to authenticated, service_role;

-- ---------- Vistas ----------
-- Una fila por cuenta que fue VIP alguna vez. El dueño ve la suya y los admins, todas (filtra la vista: profiles solo
-- deja leer la cuenta propia).
-- status: lifetime, active, revoked (el último período cargado se revocó) o expired.
-- until: el fin más lejano de los períodos sin revocar, solo si está activo y no es lifetime.
create or replace view public.vip_status as
with v as (
  select user_id,
         bool_or(revoked_at is null and starts_at <= now() and (ends_at is null or ends_at > now())) as active,
         bool_or(revoked_at is null and starts_at <= now() and ends_at is null) as lifetime,
         max(ends_at) filter (where revoked_at is null) as max_end,
         min(starts_at) as since,
         greatest(max(created_at), max(revoked_at)) as last_change,
         (array_agg(revoked_at is not null order by created_at desc, starts_at desc))[1] as last_revoked
    from vip_memberships group by user_id
)
select v.user_id, pr.tag as alias, p.id as player_id, p.photo_url,
       v.active, v.lifetime,
       case when v.active and not v.lifetime then v.max_end end as until,
       v.since, v.last_change,
       case when v.lifetime then 'lifetime' when v.active then 'active' when v.last_revoked then 'revoked' else 'expired' end as status
  from v
  join profiles pr on pr.id = v.user_id
  left join players p on p.user_id = v.user_id
 where v.user_id = auth.uid() or is_admin();
comment on view public.vip_status is 'Estado VIP de cada cuenta que lo tuvo. El dueño ve la suya; los admins, todas';
revoke all on public.vip_status from anon;
grant select on public.vip_status to authenticated;

-- Las cuentas VIP hoy y su ficha, sin fechas: para el `vip` público de la ficha, el ranking y el comparador.
create or replace view public.vip_public as
select distinct v.user_id, p.id as player_id
  from vip_memberships v
  left join players p on p.user_id = v.user_id
 where v.revoked_at is null and v.starts_at <= now() and (v.ends_at is null or v.ends_at > now());
comment on view public.vip_public is 'Cuentas VIP hoy y su ficha, públicas y sin fechas';
revoke all on public.vip_public from anon, authenticated;
grant select on public.vip_public to anon, authenticated;

commit;
