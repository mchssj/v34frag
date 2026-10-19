-- Pruebas de supabase/replanteo/19_listado_servidor.sql (correr con la migración aplicada). Todo con rollback.
begin;

create function pg_temp.ok(c boolean, msg text) returns void language plpgsql as $$
begin
  if not coalesce(c, false) then raise exception 'FALLA: %', msg; end if;
  raise notice 'OK: %', msg;
end $$;
grant execute on function pg_temp.ok(boolean, text) to anon, authenticated;

insert into public.game_servers(id, name, token_hash) values
  ('aaaaaaaa-1900-4000-8000-000000000001', 'Servidor 19 A', 'hash-19-a'),
  ('aaaaaaaa-1900-4000-8000-000000000002', 'Servidor 19 B', 'hash-19-b');
insert into public.matches(id, kind, status, map, played_at, server_id, side1_name, side2_name) values
  ('aaaaaaaa-1900-4000-8000-0000000000a1', 'mix', 'finished', 'de_dust2', now(), 'aaaaaaaa-1900-4000-8000-000000000001', 'A', 'B'),
  ('aaaaaaaa-1900-4000-8000-0000000000a2', 'mix', 'finished', 'de_inferno', now(), 'aaaaaaaa-1900-4000-8000-000000000002', 'A', 'B'),
  ('aaaaaaaa-1900-4000-8000-0000000000a3', 'mix', 'finished', 'de_nuke', now(), null, 'A', 'B');

set local role anon;
select set_config('request.jwt.claims', '{"role":"anon"}', true);
do $$ begin
  perform pg_temp.ok((select server_id from public.match_list where id = 'aaaaaaaa-1900-4000-8000-0000000000a1') = 'aaaaaaaa-1900-4000-8000-000000000001', 'match_list trae server_id');
  perform pg_temp.ok((select count(*) from public.match_list where server_id = 'aaaaaaaa-1900-4000-8000-000000000002') = 1, 'filtrar por servidor da solo sus partidas');
  perform pg_temp.ok((select server_id from public.match_list where id = 'aaaaaaaa-1900-4000-8000-0000000000a3') is null, 'una partida sin servidor queda en null');
  perform pg_temp.ok((select review from public.match_list where id = 'aaaaaaaa-1900-4000-8000-0000000000a1') is null, 'el resto de las columnas sigue igual');
end $$;
reset role;

rollback;
