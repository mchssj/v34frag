-- Después de la inversa del 68: todo como en la 66.
do $$ begin
  if exists (select 1 from information_schema.columns where table_name = 'team_config' and column_name = 'rename_days')
     or to_regprocedure('public.set_team_config(integer,integer,integer)') is not null
     or to_regprocedure('public.set_team_config(integer,integer)') is null
     or position('is_moderator()' in pg_get_functiondef('public.mm_admin_resolve_report(uuid,text,integer)'::regprocedure)) = 0
     or position('interval ''30 days''' in pg_get_functiondef('public.team_rename(uuid,text,text)'::regprocedure)) = 0
     or manual_valores() ? 'equipo.dias_nombre' then
    raise exception 'FALLA inversa';
  end if;
  raise notice 'OK: la inversa deja todo como en la 66';
end $$;
