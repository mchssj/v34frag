-- =============================================================================
-- VIP: días que lleva cada cuenta como VIP
--
-- vip_status suma dos columnas al final:
-- - active_since: inicio de la racha actual (períodos sin revocar, ya empezados y sin cortes entre ellos). Una extensión
--   empieza donde termina el anterior y un lifetime dado sobre un temporal se pisa con él: los dos siguen la racha.
--   Si venció o se quitó y se volvió a dar, cuenta desde la vuelta.
-- - days_active: días desde active_since, en fechas de Colombia (el día de la compra es 0: comprado el 25, el 29 lleva 4).
-- Las dos en null si no tiene VIP vigente. Se calculan al leer: suman solas cada día.
--
-- Necesita 20261028120000_vip.sql. El resto de la vista y sus permisos quedan igual.
--
-- Bitácora: docs/bitacora/2026-10-29-vip-dias/
-- Cómo aplicarla: Supabase > SQL Editor > pegar todo el archivo > Run. Re-ejecutable.
-- =============================================================================

begin;

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
),
-- Períodos que cuentan para la racha, con el fin más lejano de los que empezaron antes (lifetime = infinity).
per as (
  select user_id, starts_at,
         max(coalesce(ends_at, 'infinity')) over (partition by user_id order by starts_at, coalesce(ends_at, 'infinity')
                                                  rows between unbounded preceding and 1 preceding) as prev_end
    from vip_memberships
   where revoked_at is null and starts_at <= now()
),
-- Inicio de la última racha: el último período que no se toca con los anteriores.
r as (
  select user_id, max(starts_at) as streak_start
    from per where prev_end is null or starts_at > prev_end
   group by user_id
)
select v.user_id, pr.tag as alias, p.id as player_id, p.photo_url,
       v.active, v.lifetime,
       case when v.active and not v.lifetime then v.max_end end as until,
       v.since, v.last_change,
       case when v.lifetime then 'lifetime' when v.active then 'active' when v.last_revoked then 'revoked' else 'expired' end as status,
       case when v.active then r.streak_start end as active_since,
       case when v.active then (now() at time zone 'America/Bogota')::date - (r.streak_start at time zone 'America/Bogota')::date
       end as days_active
  from v
  join profiles pr on pr.id = v.user_id
  left join players p on p.user_id = v.user_id
  left join r on r.user_id = v.user_id
 where v.user_id = auth.uid() or is_admin();
comment on view public.vip_status is
  'Estado VIP de cada cuenta que lo tuvo. El dueño ve la suya; los admins, todas. active_since y days_active: racha actual (null sin VIP vigente)';
comment on column public.vip_status.active_since is 'Inicio de la racha VIP actual, sin cortes. Null si no tiene VIP vigente';
comment on column public.vip_status.days_active is 'Días que lleva como VIP en la racha actual, en fechas de Colombia (el día de la compra es 0). Null si no tiene VIP vigente';
revoke all on public.vip_status from anon;
grant select on public.vip_status to authenticated;

commit;
