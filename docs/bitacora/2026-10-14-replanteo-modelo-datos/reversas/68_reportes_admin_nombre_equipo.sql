-- Inversa del replanteo 68: los reportes vuelven a moderadores y admins, el nombre de un equipo vuelve a los 30 días fijos,
-- set_team_config vuelve a dos parámetros y manual_valores() pierde equipo.dias_nombre (el manual usa el valor por defecto).
begin;

create or replace function pg_temp.reemplazar(fn regprocedure, cambios text[][]) returns void language plpgsql as $$
declare d text := pg_get_functiondef(fn); i int; a text; b text;
begin
  for i in 1 .. array_length(cambios, 1) loop
    a := replace(cambios[i][1], E'\r', ''); b := replace(cambios[i][2], E'\r', '');
    if position(a in d) = 0 then
      raise exception 'inversa 68: en % no se encontró: %', fn, left(a, 80);
    end if;
    d := replace(d, a, b);
  end loop;
  execute d;
end $$;

select pg_temp.reemplazar('public.mm_admin_resolve_report(uuid,text,integer)', array[
  ['if not is_admin() then raise exception ''Solo un admin puede resolver reportes'' using errcode = ''42501''; end if;',
   'if not is_moderator() then raise exception ''Solo moderadores y admins'' using errcode = ''42501''; end if;']
]);

select pg_temp.reemplazar('public.mm_admin_lists(text,text)', array[
  ['if p_what = ''reports'' and not is_admin() then raise exception ''Solo un admin ve los reportes'' using errcode = ''42501''; end if;
  ', '']
]);

select pg_temp.reemplazar('public.team_rename(uuid,text,text)', array[
  ['  v_days int := coalesce((select rename_days from team_config where id = 1), 30);
', ''],
  ['  if not adm and v_days > 0 and t.name_changed_at > now() - make_interval(days => v_days) then
    v_next := t.name_changed_at + make_interval(days => v_days);
    raise exception ''El nombre y la sigla se cambian una vez cada % días'', v_days',
   '  if not adm and t.name_changed_at > now() - interval ''30 days'' then
    v_next := t.name_changed_at + interval ''30 days'';
    raise exception ''El nombre y la sigla se cambian una vez cada 30 días''']
]);

select pg_temp.reemplazar('public.manual_valores()', array[
  ['''claim.max_steam_ids'', k.max_steam_ids,
    ''equipo.dias_nombre'', t.rename_days)', '''claim.max_steam_ids'', k.max_steam_ids)']
]);

drop function public.set_team_config(integer, integer, integer);
create function public.set_team_config(p_max_members integer, p_max_led integer default null)
  returns void language plpgsql security definer set search_path = public as $$
begin
  if not is_admin() then raise exception 'Solo un administrador puede cambiar la configuración de los equipos' using errcode = '42501'; end if;
  if p_max_members is null or p_max_members not between 2 and 30 then
    raise exception 'El máximo de miembros tiene que estar entre 2 y 30';
  end if;
  if p_max_led is not null and p_max_led not between 1 and 10 then
    raise exception 'El máximo de equipos por capitán tiene que estar entre 1 y 10';
  end if;
  update team_config set max_members = p_max_members, max_led = coalesce(p_max_led, max_led), updated_at = now() where id = 1;
end $$;
revoke all on function public.set_team_config(integer, integer) from public, anon;
grant execute on function public.set_team_config(integer, integer) to authenticated, service_role;

alter table public.team_config drop column rename_days;

commit;
