-- Contraseñas de los roles internos de Supabase (como volumes/db/roles.sql del compose oficial, sin
-- supabase_functions_admin: ese rol lo crea webhooks.sql, que no se usa). Corre una sola vez, al crear la base.
\set pgpass `echo "$POSTGRES_PASSWORD"`

ALTER USER authenticator WITH PASSWORD :'pgpass';
ALTER USER pgbouncer WITH PASSWORD :'pgpass';
ALTER USER supabase_auth_admin WITH PASSWORD :'pgpass';
ALTER USER supabase_storage_admin WITH PASSWORD :'pgpass';
