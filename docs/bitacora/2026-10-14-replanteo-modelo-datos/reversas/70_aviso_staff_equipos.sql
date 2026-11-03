-- Inversa del replanteo 70: team_staff_action vuelve a quedar sin categoría (las acciones del staff sobre un equipo fallan).
begin;

do $$
declare d text := pg_get_functiondef('public.notification_category(text)'::regprocedure);
declare nuevo text := '''team_dissolved'', ''team_staff_action'') then ''team'' -- (replanteo 70) team_staff_action';
begin
  if position(nuevo in d) = 0 then raise exception 'inversa 70: notification_category no tiene lo del replanteo 70'; end if;
  execute replace(d, nuevo, '''team_dissolved'') then ''team''');
end $$;

commit;
