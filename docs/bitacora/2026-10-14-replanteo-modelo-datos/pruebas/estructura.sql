-- Foto de la estructura del esquema public, ordenada, para comparar antes y después de una migración
-- y su inversa. Ignora el orden de las columnas (una columna recreada queda al final de la tabla).
select 'col' k, table_name || '.' || column_name || ' ' || data_type || ' null=' || is_nullable || ' def=' || coalesce(column_default, '')
  from information_schema.columns where table_schema = 'public'
union all
select 'con', conrelid::regclass || ' ' || conname || ' ' || pg_get_constraintdef(oid)
  from pg_constraint where connamespace = 'public'::regnamespace
union all
select 'pol', tablename || ' ' || policyname || ' ' || cmd || ' ' || roles::text || ' ' || coalesce(qual, '') || ' ' || coalesce(with_check, '')
  from pg_policies where schemaname = 'public'
union all
select 'rls', relname || ' ' || relrowsecurity from pg_class where relnamespace = 'public'::regnamespace and relkind = 'r'
union all
select 'idx', indexdef from pg_indexes where schemaname = 'public'
union all
select 'acl', table_name || ' ' || grantee || ' ' || privilege_type
  from information_schema.role_table_grants where table_schema = 'public'
union all
-- Funciones: firma, hash de la definición completa (cuerpo, SECURITY DEFINER, search_path) y permisos.
select 'fn', p.proname || '(' || pg_get_function_identity_arguments(p.oid) || ') ' || md5(pg_get_functiondef(p.oid))
       || ' acl=' || coalesce(array_to_string(array(select x::text from unnest(p.proacl) x order by 1), ','), '')
  from pg_proc p where p.pronamespace = 'public'::regnamespace and p.prokind = 'f'
union all
select 'trg', tgrelid::regclass || ' ' || tgname || ' ' || md5(pg_get_triggerdef(oid))
  from pg_trigger where not tgisinternal and tgrelid::regclass::text not like 'auth.%'
  and tgrelid in (select oid from pg_class where relnamespace = 'public'::regnamespace)
order by 1, 2;
