-- Replanteo 68: reportes del matchmaking solo para el admin y espera configurable del nombre de un equipo
-- (plan docs/bitacora/2026-11-03-reportes-clips-nombre-equipo, aprobado por Daniel).
--   1. mm_admin_resolve_report y mm_admin_lists('reports'): solo admin (antes, moderadores y admins).
--   2. team_config.rename_days (0 a 365, 0 = sin espera, 30 por defecto): team_rename lo usa en lugar de los 30 días fijos.
--   3. set_team_config con p_rename_days.
--   4. manual_valores() con equipo.dias_nombre.
-- El 67 lo usa 67_imagen_login.sql (feat/frontend-fase-1). Va después de la 66.
-- NO aplicar en producción antes del corte (ver README.md).
begin;

do $$
begin
  if to_regprocedure('public.manual_valores()') is null then
    raise exception 'replanteo 68: falta la 65 (manual_valores)';
  end if;
  if exists (select 1 from information_schema.columns where table_name = 'team_config' and column_name = 'rename_days') then
    raise exception 'replanteo 68: team_config.rename_days ya existe (¿ya se aplicó?)';
  end if;
end $$;

create or replace function pg_temp.reemplazar(fn regprocedure, cambios text[][]) returns void language plpgsql as $$
declare d text := pg_get_functiondef(fn); i int; a text; b text;
begin
  for i in 1 .. array_length(cambios, 1) loop
    a := replace(cambios[i][1], E'\r', ''); b := replace(cambios[i][2], E'\r', '');
    if position(a in d) = 0 then
      raise exception 'replanteo 68: en % no se encontró: %', fn, left(a, 80);
    end if;
    d := replace(d, a, b);
  end loop;
  execute d;
end $$;

-- 1. Reportes: solo admin ---------------------------------------------------------------------------------------------
select pg_temp.reemplazar('public.mm_admin_resolve_report(uuid,text,integer)', array[
  ['if not is_moderator() then raise exception ''Solo moderadores y admins'' using errcode = ''42501''; end if;',
   'if not is_admin() then raise exception ''Solo un admin puede resolver reportes'' using errcode = ''42501''; end if;']
]);

select pg_temp.reemplazar('public.mm_admin_lists(text,text)', array[
  ['if p_what in (''reports'', ''bans'', ''penalties'') then',
   'if p_what = ''reports'' and not is_admin() then raise exception ''Solo un admin ve los reportes'' using errcode = ''42501''; end if;
  if p_what in (''reports'', ''bans'', ''penalties'') then']
]);

-- 2. Espera entre cambios de nombre -----------------------------------------------------------------------------------
alter table public.team_config
  add column rename_days smallint not null default 30 check (rename_days between 0 and 365);
comment on column public.team_config.rename_days is
  'Días entre cambios de nombre o sigla de un equipo por su capitán (0 = sin espera). El admin no tiene espera. Replanteo 68.';

select pg_temp.reemplazar('public.team_rename(uuid,text,text)', array[
  ['  v_next timestamptz;
begin',
   '  v_next timestamptz;
  v_days int := coalesce((select rename_days from team_config where id = 1), 30);
begin'],
  ['  if not adm and t.name_changed_at > now() - interval ''30 days'' then
    v_next := t.name_changed_at + interval ''30 days'';
    raise exception ''El nombre y la sigla se cambian una vez cada 30 días''',
   '  if not adm and v_days > 0 and t.name_changed_at > now() - make_interval(days => v_days) then
    v_next := t.name_changed_at + make_interval(days => v_days);
    raise exception ''El nombre y la sigla se cambian una vez cada % días'', v_days']
]);

-- 3. set_team_config con la espera ------------------------------------------------------------------------------------
drop function public.set_team_config(integer, integer);
create function public.set_team_config(p_max_members integer, p_max_led integer default null, p_rename_days integer default null)
  returns void language plpgsql security definer set search_path = public as $$
begin
  if not is_admin() then raise exception 'Solo un administrador puede cambiar la configuración de los equipos' using errcode = '42501'; end if;
  if p_max_members is null or p_max_members not between 2 and 30 then
    raise exception 'El máximo de miembros tiene que estar entre 2 y 30';
  end if;
  if p_max_led is not null and p_max_led not between 1 and 10 then
    raise exception 'El máximo de equipos por capitán tiene que estar entre 1 y 10';
  end if;
  if p_rename_days is not null and p_rename_days not between 0 and 365 then
    raise exception 'Los días entre cambios de nombre tienen que estar entre 0 y 365';
  end if;
  update team_config
     set max_members = p_max_members, max_led = coalesce(p_max_led, max_led),
         rename_days = coalesce(p_rename_days, rename_days), updated_at = now()
   where id = 1;
end $$;
revoke all on function public.set_team_config(integer, integer, integer) from public, anon;
grant execute on function public.set_team_config(integer, integer, integer) to authenticated, service_role;

-- 4. El manual --------------------------------------------------------------------------------------------------------
select pg_temp.reemplazar('public.manual_valores()', array[
  ['''claim.max_steam_ids'', k.max_steam_ids)', '''claim.max_steam_ids'', k.max_steam_ids,
    ''equipo.dias_nombre'', t.rename_days)']
]);

commit;
