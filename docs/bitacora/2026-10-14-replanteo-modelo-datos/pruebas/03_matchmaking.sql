-- Pruebas de supabase/replanteo/03_matchmaking.sql (correr con la migración aplicada).
do $$
begin
  assert not exists (select 1 from pg_class where relnamespace = 'public'::regnamespace and relname like 'matchmaking%'),
    'quedó alguna tabla o índice de matchmaking';
  assert not exists (select 1 from pg_proc where pronamespace = 'public'::regnamespace and proname like 'matchmaking%'),
    'quedó alguna función de matchmaking';
  assert not exists (select 1 from information_schema.columns where table_schema = 'public' and
    (table_name, column_name) in (('game_servers', 'matchmaking_enabled'), ('game_servers', 'last_assigned_at'), ('matches', 'matchmaking_mode'))),
    'quedó alguna columna de matchmaking';
  -- Se quedan: connect_address (para "Conectarse") y panel_server_id (lo usa el Worker de demos).
  assert (select count(*) from information_schema.columns where table_schema = 'public' and table_name = 'game_servers'
          and column_name in ('connect_address', 'panel_server_id')) = 2,
    'se borró connect_address o panel_server_id';
  -- Ninguna función que quede menciona el matchmaking.
  assert not exists (select 1 from pg_proc where pronamespace = 'public'::regnamespace and prosrc ~* 'matchmaking'),
    'una función que quedó todavía usa el matchmaking';
  raise notice 'replanteo 03: ok';
end $$;
