-- Datos de prueba de !match en la Supabase LOCAL (nunca en producción). Los SteamID son los falsos que la
-- build CSSTV_DEBUG les da a los bots según su nombre (csstv/stats.inc). Se carga con:
--   docker exec -i supabase_db_v34frag-api psql -U postgres < servidor_local.sql
begin;
insert into public.game_servers (name, token_hash)
  values ('servidor local de pruebas', encode(sha256(convert_to('tok-servidor-local', 'UTF8')), 'hex'));
insert into public.players (id, nick, steam_id) values
  ('dddddddd-5000-4000-8000-000000000001', 'Simba1', '76561199958424770'),
  ('dddddddd-5000-4000-8000-000000000002', 'Simba2', '76561199958424771'),
  ('dddddddd-5000-4000-8000-000000000003', 'Simba3', '76561199958424772'),
  ('dddddddd-5000-4000-8000-000000000004', 'Simba4', '76561199958424773'),
  ('dddddddd-5000-4000-8000-000000000005', 'Simba5', '76561199958424774'),
  ('dddddddd-5000-4000-8000-000000000006', 'Strix1', '76561199958457968'),
  ('dddddddd-5000-4000-8000-000000000007', 'Strix2', '76561199958457969'),
  ('dddddddd-5000-4000-8000-000000000008', 'Strix3', '76561199958457970'),
  ('dddddddd-5000-4000-8000-000000000009', 'Strix4', '76561199958457971'),
  ('dddddddd-5000-4000-8000-000000000010', 'Strix5', '76561199958457972');
insert into public.teams (id, name, kind) values
  ('eeeeeeee-5000-4000-8000-000000000001', 'Simbations', 'official'),
  ('eeeeeeee-5000-4000-8000-000000000002', 'Strix', 'official');
insert into public.team_members (team_id, player_id)
  select 'eeeeeeee-5000-4000-8000-000000000001'::uuid, ('dddddddd-5000-4000-8000-0000000000' || lpad(i::text, 2, '0'))::uuid from generate_series(1, 5) i
  union all
  select 'eeeeeeee-5000-4000-8000-000000000002'::uuid, ('dddddddd-5000-4000-8000-0000000000' || lpad(i::text, 2, '0'))::uuid from generate_series(6, 10) i;
insert into public.events (id, name, stage) values ('abababab-5000-4000-8000-000000000001', 'Copa Local', 'Playoffs');
insert into public.matches (id, team1, team2, kind, status, best_of, event_id, stage) values
  ('ffffffff-5000-4000-8000-000000000001', 'eeeeeeee-5000-4000-8000-000000000001', 'eeeeeeee-5000-4000-8000-000000000002', 'pcw', 'upcoming', 3, null, null),
  ('ffffffff-5000-4000-8000-000000000002', 'eeeeeeee-5000-4000-8000-000000000001', 'eeeeeeee-5000-4000-8000-000000000002', 'official', 'upcoming', 1, 'abababab-5000-4000-8000-000000000001', 'Final');
commit;
select kind, best_of, link_code from public.matches where id in ('ffffffff-5000-4000-8000-000000000001', 'ffffffff-5000-4000-8000-000000000002');
