-- Permisos exactos de la base, como sentencias SQL (docs/bitacora/2026-11-26-migracion-vps-brasil). Lo corre respaldar.sh
-- en cada respaldo y la salida queda al lado de base.dump como permisos.sql; restaurar.sh la aplica después del pg_restore.
--
-- Hace falta porque pg_restore sobre un Supabase nuevo deja los objetos de public con los permisos por defecto de Supabase
-- (anon y authenticated pueden ejecutar o leer todo) y el volcado no trae los revoke: pg_dump compara con los permisos por
-- defecto de Postgres, no con los de Supabase (lo mismo que docs/bitacora/2026-11-12-permisos-funciones). En el ensayo de
-- la migración quedaron así 539 funciones y 132 tablas o vistas.
--
-- Salida: una sentencia por línea. Por objeto de public: REVOKE ALL a los roles de la API y después cada GRANT que tiene
-- (el del dueño no hace falta). Después, los permisos por columna (el REVOKE de la tabla también se los lleva) y el uso
-- de los esquemas graphql y graphql_public, que el pg_restore deja vacíos.
\pset format unaligned
\pset tuples_only on
\pset footer off
with o as (
  select format('%s %s', case c.relkind when 'S' then 'SEQUENCE' else 'TABLE' end, c.oid::regclass) obj, c.relacl acl, c.relowner own
    from pg_class c join pg_namespace n on n.oid = c.relnamespace
   where n.nspname = 'public' and c.relkind in ('r', 'p', 'v', 'm', 'S', 'f')
  union all
  select format('FUNCTION %s', p.oid::regprocedure), p.proacl, p.proowner
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public' and p.prokind in ('f', 'p')
)
select format('REVOKE ALL ON %s FROM PUBLIC, anon, authenticated, service_role, mm_listener;', obj)
       || coalesce((select string_agg(format(' GRANT %s ON %s TO %s%s;', x.privilege_type, obj,
                      case when x.grantee = 0 then 'PUBLIC' else quote_ident(pg_get_userbyid(x.grantee)) end,
                      case when x.is_grantable then ' WITH GRANT OPTION' else '' end), '')
                      from aclexplode(acl) x where x.grantee <> own), '')
  from o where acl is not null
union all
-- Sin ACL propia, una función se puede ejecutar por todos (el valor por defecto de Postgres).
select format('REVOKE ALL ON %s FROM PUBLIC, anon, authenticated, service_role, mm_listener; GRANT ALL ON %s TO PUBLIC;', obj, obj)
  from o where acl is null and obj like 'FUNCTION %'
union all
select format('GRANT %s (%I) ON TABLE %s TO %s%s;', x.privilege_type, a.attname, c.oid::regclass,
              case when x.grantee = 0 then 'PUBLIC' else quote_ident(pg_get_userbyid(x.grantee)) end,
              case when x.is_grantable then ' WITH GRANT OPTION' else '' end)
  from pg_attribute a join pg_class c on c.oid = a.attrelid join pg_namespace n on n.oid = c.relnamespace,
       aclexplode(a.attacl) x
 where a.attacl is not null and n.nspname = 'public' and x.grantee <> c.relowner
union all
select format('GRANT %s ON SCHEMA %I TO %s%s;', x.privilege_type, n.nspname,
              case when x.grantee = 0 then 'PUBLIC' else quote_ident(pg_get_userbyid(x.grantee)) end,
              case when x.is_grantable then ' WITH GRANT OPTION' else '' end)
  from pg_namespace n, aclexplode(n.nspacl) x
 where n.nspname in ('graphql', 'graphql_public') and x.grantee <> n.nspowner;
