-- Replanteo 70: team_staff_action vuelve a tener categoría (bitácora docs/bitacora/2026-11-03-aviso-staff-equipos).
-- La 43 la sumó a notification_category reemplazando texto, pero la 56 y la 58 rehacen la función completa desde una
-- copia anterior a la 43 y la perdieron: el aviso al líder quedaba con category null (not null) y toda acción del staff
-- sobre un equipo (team_staff_*: disolver, renombrar, logo, miembros, rol, líder) fallaba. Va después de la 69.
begin;

do $$
declare d text := pg_get_functiondef('public.notification_category(text)'::regprocedure);
begin
  if position('''team_staff_action''' in d) = 0 then
    if position('''team_dissolved'') then ''team''' in d) = 0 then raise exception 'replanteo 70: notification_category cambió'; end if;
    execute replace(d, '''team_dissolved'') then ''team''', '''team_dissolved'', ''team_staff_action'') then ''team'' -- (replanteo 70) team_staff_action');
  end if;
  if notification_category('team_staff_action') is distinct from 'team' then
    raise exception 'replanteo 70: team_staff_action sigue sin categoría';
  end if;
  if not notification_required('team_staff_action') then
    raise exception 'replanteo 70: team_staff_action dejó de ser obligatorio';
  end if;
end $$;

commit;
